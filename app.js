'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['demoCatalog','profileStatus','telemetryPanel','legacyPanel','cliConnect','dataConnect','cliStatus','dataStatus','listen','disconnect','configFile','configInfo','configSummary','configWarning','sendConfig','replayFile','demo','stopPlayback','modeBadge','sourceTitle','frameStat','objectsStat','bytesStat','framesStat','frameWarnings','sceneCanvas','viewOrbit','viewTop','viewFront','viewReset','zoomIn','zoomOut','trailToggle','trailDuration','trailClear','vitalsSection','vitalsCards','presentation','range','log','clearLog','compatibility'].map(id => [id,$(id)]));
  const state = {profile:'people',profileChanging:false,cli:null,data:null,cliReader:null,dataReader:null,cliTask:null,dataTask:null,writer:null,choosing:false,closing:false,sending:false,listening:false,source:'offline',generation:0,playback:null,decoder:null,bytes:0,frames:0,frame:null,commands:[],configKind:null,ack:null,cliPartial:'',lastCliRead:0,lastFrameAt:0,dataBusy:false,vitals:new VitalsStore(),vitalCards:new Map(),trails:new TrailStore()};
  const telemetry = new TelemetryPanels(ui.telemetryPanel);
  const legacy = new LegacyPanels(ui.legacyPanel);
  const motion = typeof MotionPanel!=='undefined'?new MotionPanel(document,MotionCore,typeof CaptureRecorder!=='undefined'?CaptureRecorder:null):null;
  if(motion)motion.getDecoderInfo=()=>({bufferedBytes:state.decoder?.buffer?.length||0});
  const profileAllowed=()=>RadarProtocol.SUPPORTED_PROFILES.includes(state.profile);
  const configBlocked=()=>state.profile==='gesture'||state.profile==='cpd';
  const scene = new RadarScene(ui.sceneCanvas);scene.attachPointerControls();
  let configReadToken=0;
  const supported = isSecureContext && 'serial' in navigator;
  ui.compatibility.textContent = supported ? 'Web Serial ready. Select the correct two interfaces.' : 'Live serial requires a secure localhost/HTTPS page in a browser with Web Serial (Chrome on Chromebook). Replay and demo are still available.';
  const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
  function log(message) { const t = new Date().toLocaleTimeString(); ui.log.textContent += `[${t}] ${message}\n`; if (ui.log.textContent.length > 50000) ui.log.textContent=ui.log.textContent.slice(-40000); ui.log.scrollTop=ui.log.scrollHeight; }
  function error(e) { return e && e.message ? e.message : String(e); }
  function refresh() {
    if(motion)motion.setContext(state.source,state.profile,state.sending);
    ui.profileStatus.textContent='Active parser profile: '+state.profile+(profileAllowed()?' · experimental/partial, hardware unverified':' · NOT IMPLEMENTED; live decoding/config sending disabled');
    ui.cliConnect.disabled=state.profileChanging||!supported||state.choosing||state.closing||!!state.cli;
    ui.dataConnect.disabled=state.profileChanging||!supported||state.choosing||state.closing||!!state.data;
    ui.listen.disabled=!profileAllowed()||state.profileChanging||!state.data||state.closing||state.choosing||state.dataBusy;
    ui.listen.textContent=state.listening?'Stop listening':'Start listening';
    ui.disconnect.disabled=state.closing||state.choosing||(!state.cli&&!state.data);
    ui.sendConfig.disabled=!profileAllowed()||configBlocked()||state.profileChanging||!state.cli||!state.writer||!state.commands.length||state.sending||state.closing;
    ui.configFile.disabled=state.profileChanging||!profileAllowed()||configBlocked()||state.sending||state.closing;ui.replayFile.disabled=!profileAllowed()||state.profileChanging;
    ui.stopPlayback.disabled=!['demo','replay'].includes(state.source);
    ui.demo.disabled=!profileAllowed()||state.closing||state.profileChanging;
    ui.cliStatus.textContent=state.cli?(state.sending?'Sending configuration…':'Connected · 115200 baud'):'Not connected';
    ui.dataStatus.textContent=state.data?(state.listening?'Listening · 921600 baud':'Connected · not listening'):'Not connected';
    ui.modeBadge.textContent=({offline:'OFFLINE',live:'LIVE SERIAL',demo:'SYNTHETIC DEMO',replay:'FILE REPLAY'})[state.source];
    ui.modeBadge.className='badge '+state.source;
    ui.sourceTitle.textContent=({offline:'Waiting for a data source',live:'Reading your radar',demo:'Synthetic data · demonstration only',replay:'Recorded data · file replay'})[state.source];
    ui.vitalsSection.style.display=ui.presentation.value==='vitals'?'block':'none';vitalFreshness();
    ui.configSummary.textContent=state.configKind==='vitals'?'Vital-signs configuration':state.configKind==='people'?'People-tracking configuration (inferred)':state.configKind==='unverified'?'Configuration loaded · demo compatibility unverified':'';
    ui.configWarning.textContent=state.profile==='gesture'?'This TI gesture build uses a built-in configuration. External CFG sending is disabled.':state.profile==='cpd'?'CPD setup mixes firmware commands with MATLAB host metadata. CFG sending is disabled here; use the official TI setup, then listen to raw points. No occupancy/classification is performed.':!profileAllowed()?'This profile has no compatible decoder in this release.':state.configKind==='unverified'?'Confirm this file matches the selected firmware/profile before sending. No commands have been sent automatically.':state.configKind&&state.configKind!==ui.presentation.value?'The selected presentation differs from this configuration. Change it manually if needed. No commands have been sent automatically.':'';
  }
  function reset(source) { if(motion)motion.reset(source,state.profile);state.source=source; state.decoder=profileAllowed()?new RadarProtocol.StreamDecoder(state.profile):null;telemetry.reset();legacy.reset(); state.bytes=0; state.frames=0; state.frame=null;state.lastFrameAt=0;state.vitals.clear();state.vitalCards.clear();state.trails.clear();ui.vitalsCards.replaceChildren(); ui.frameStat.textContent='—'; ui.objectsStat.textContent='0 / 0'; ui.bytesStat.textContent='0 B'; ui.framesStat.textContent='0'; ui.frameWarnings.textContent=''; render(); refresh(); }
  function ingest(bytes) {
    const arrivedAt=Date.now();if(motion)motion.captureBytes(bytes,arrivedAt);
    state.bytes+=bytes.length;
    const priorErrors=state.decoder.errors||0;const frames=state.decoder.push(bytes);if((state.decoder.errors||0)>priorErrors)log(`Decoder rejected malformed data (${state.decoder.errors} total): ${state.decoder.lastError||'invalid frame'}`);
    if(motion){motion.captureFrames(frames,arrivedAt);if((state.decoder.errors||0)>priorErrors)motion.captureEvent('decode_warning',{previousErrors:priorErrors,errors:state.decoder.errors,lastError:state.decoder.lastError||'invalid frame'},arrivedAt);motion.ingest(frames,arrivedAt,state.source,state.profile);}
    state.frames+=frames.length;telemetry.ingest(frames,Date.now());legacy.ingest(frames,Date.now());state.vitals.ingest(frames,Date.now());state.trails.ingest(frames,Date.now());
    if(frames.length) { state.frame=frames[frames.length-1];state.lastFrameAt=Date.now(); ui.frameStat.textContent=String(state.frame.frameNumber); ui.objectsStat.textContent=`${(state.frame.points||[]).length} / ${(state.frame.tracks||[]).length}`; ui.frameWarnings.textContent=[...(state.frame.warnings||[]),...((state.frame.unknownTlvs||[]).length?['Unrendered TLVs: '+state.frame.unknownTlvs.join(', ')]:[])].join(' · '); render(); }
    ui.framesStat.textContent=state.frames.toLocaleString(); ui.bytesStat.textContent=state.bytes<1024?`${state.bytes} B`:`${(state.bytes/1024).toFixed(1)} KB`;
  }
  function cliChunk(chunk) {
    state.lastCliRead=Date.now(); state.cliPartial+=chunk;
    const lines=state.cliPartial.split(/\r\n|\n|\r/); state.cliPartial=lines.pop();
    lines.filter(Boolean).forEach(line=>log(`CLI ‹ ${line}`));
    if(state.cliPartial.length>4096) {log(`CLI ‹ ${state.cliPartial}`);state.cliPartial='';}
    if(state.ack) {
      const ack=state.ack; ack.response+=chunk;
      if(/(?:^|[\r\n])\s*(?:Error\b|Exception\b)|\b(?:not recognized|Invalid usage|failed)\b/i.test(ack.response)) ack.finish(new Error(`Device rejected command: ${ack.response.trim()}`));
      else if(/(?:^|[\r\n])\s*Done\s*(?:[\r\n]|$)/.test(ack.response)) ack.finish();
      else if(/(?:mmwDemo|sensor|cli)[^\r\n]*:\/>\s*$/i.test(ack.response)) ack.finish(new Error('CLI prompt arrived without a Done acknowledgement. Check firmware and command.'));
    }
  }
  async function readCli(port) {
    const reader=port.readable.getReader();state.cliReader=reader;const decoder=new TextDecoder();
    try { while(state.cli===port) {const {value,done}=await reader.read();if(done)break;if(value)cliChunk(decoder.decode(value,{stream:true}));} }
    catch(e){if(!state.closing)log(`CLI read error: ${error(e)}`);}
    finally {reader.releaseLock();if(state.cliReader===reader)state.cliReader=null;if(state.ack)state.ack.finish(new Error('CLI connection closed.'));if(!state.closing&&state.cli===port){log('CLI stream ended. Disconnect and reconnect before sending commands.');if(state.writer){state.writer.releaseLock();state.writer=null;}refresh();}}
  }
  async function connect(kind) {
    if(state.choosing||state.closing)return;state.choosing=true;refresh();let port=null,opened=false;
    try {
      port=await navigator.serial.requestPort();
      if(port===state.cli||port===state.data)throw new Error('That interface is already selected. Choose the other physical serial interface.');
      await port.open({baudRate:kind==='cli'?115200:921600});opened=true;
      state[kind]=port;
      if(kind==='cli'){state.writer=port.writable.getWriter();state.cliPartial='';state.cliTask=readCli(port);}
      log(`${kind.toUpperCase()} interface connected. No commands were sent.`);
    }catch(e){if(opened&&state[kind]!==port)await port.close().catch(()=>{});log(`Connect: ${error(e)}`);}
    finally{state.choosing=false;refresh();}
  }
  async function stopListening() {
    state.dataBusy=true;state.listening=false;refresh();
    if(state.dataReader)await state.dataReader.cancel().catch(()=>{});
    if(state.dataTask)await state.dataTask;
    state.dataTask=null;state.dataBusy=false;refresh();
    if(state.source==='live'){state.source='offline';if(motion)motion.reset('offline',state.profile);refresh();}
  }
  function stopPlayback(){state.generation++;if(state.playback)clearInterval(state.playback);state.playback=null;if(['demo','replay'].includes(state.source)){state.source='offline';if(motion)motion.reset('offline',state.profile);refresh();}}
  async function startListening() {
    if(state.dataBusy)return;if(state.listening)return stopListening();
    if(!profileAllowed()){log('This demo profile has no compatible decoder.');return;}if(!state.data||state.closing||state.profileChanging)return;
    stopPlayback();reset('live');state.listening=true;refresh();
    const port=state.data;
    state.dataTask=(async()=>{let reader;
      try{reader=port.readable.getReader();state.dataReader=reader;while(state.listening&&state.data===port){const {value,done}=await reader.read();if(done)break;if(value)ingest(value);}}
      catch(e){if(!state.closing)log(`Data read error: ${error(e)}`);}
      finally{if(reader)reader.releaseLock();state.dataReader=null;state.listening=false;if(state.source==='live')state.source='offline';if(motion)motion.reset('offline',state.profile);refresh();}
    })();
  }
  async function sendCommand(command) {
    // Wait for preceding response/prompt to drain before arming the next acknowledgement.
    const waitStart=Date.now();while(Date.now()-state.lastCliRead<120){if(Date.now()-waitStart>2000)throw new Error('CLI remains busy; configuration stopped.');await sleep(30);}
    if(state.closing||!state.writer)throw new Error('CLI disconnected.');
    state.cliPartial='';
    let timer;
    const response=new Promise((resolve,reject)=>{
      const ack={response:'',finish:err=>{if(state.ack!==ack)return;state.ack=null;clearTimeout(timer);err?reject(err):resolve();}};
      state.ack=ack;timer=setTimeout(()=>ack.finish(new Error(`No Done acknowledgement within 5 seconds for: ${command}`)),5000);
    });
    // Attach rejection handling before awaiting write, which may itself be delayed.
    const settled=response.then(()=>({}),e=>({error:e}));
    log(`CLI › ${command}`);
    try{await state.writer.write(new TextEncoder().encode(command+'\n'));}catch(e){if(state.ack)state.ack.finish(e);}
    const result=await settled;if(result.error)throw result.error;
    await sleep(120);
  }
  async function sendConfig() {
    if(!profileAllowed()||configBlocked()||state.profileChanging){log('Configuration sending is disabled for this profile.');return;}if(state.sending||!state.writer||!state.commands.length)return;if(motion)motion.configurationSending();state.sending=true;refresh();
    try{for(const line of state.commands){if(state.closing)throw new Error('Disconnected.');await sendCommand(line);}log(`Configuration complete: ${state.commands.length} commands acknowledged.`);}
    catch(e){log(`CONFIGURATION STOPPED: ${error(e)} Remaining commands were not sent.`);}
    finally{state.sending=false;refresh();}
  }
  async function disconnect() {
    if(state.closing)return;state.closing=true;refresh();stopPlayback();
    if(state.ack)state.ack.finish(new Error('Disconnected by user.'));
    await stopListening();
    if(state.cliReader)await state.cliReader.cancel().catch(()=>{});
    if(state.cliTask)await state.cliTask;
    if(state.writer){try{state.writer.releaseLock();}catch(e){log(`Writer cleanup: ${error(e)}`);}state.writer=null;}
    for(const kind of ['cli','data']){const port=state[kind];state[kind]=null;if(port)await port.close().catch(e=>log(`Close: ${error(e)}`));}
    state.closing=false;state.cliTask=null;state.source='offline';log('Disconnected. No sensorStop command was sent; the device may still be running.');refresh();
  }
  let sourceRequest=0;
  async function demo() {
    if(!profileAllowed()||state.profileChanging){log('Synthetic demo unavailable for unsupported profile.');return;}
    const request=++sourceRequest;stopPlayback();await stopListening();if(request!==sourceRequest||state.closing)return;
    reset('demo');log('Synthetic demo started. All displayed values are simulated.');let n=0;
    state.playback=setInterval(()=>{try{ingest(RadarProtocol.makeSyntheticFrame(n++,state.profile));}catch(e){log(`Demo stopped: ${error(e)}`);stopPlayback();}},100);
  }
  async function replay(file) {
    if(!profileAllowed()||state.profileChanging){log('Replay disabled: unsupported or changing profile.');return;}
    if(!file)return;if(DemoCatalog.profiles.some(p=>p.binary.some(b=>b.basename.toLowerCase()===file.name.toLowerCase()))){log('Replay rejected: '+file.name+' is a firmware image, not a recorded serial capture. Flash firmware only with the official TI workflow; choose a raw UART recording for replay.');return;}const request=++sourceRequest;stopPlayback();await stopListening();
    try{if(file.size>128*1024*1024)throw new Error('Replay file limit is 128 MB. Split larger recordings first.');const bytes=new Uint8Array(await file.arrayBuffer());if(request!==sourceRequest||state.closing)return;reset('replay');log(`Replaying local file: ${file.name}. Playback is chunk-paced, not original capture timing.`);const generation=state.generation;
      for(let offset=0;offset<bytes.length;offset+=8192){if(generation!==state.generation||request!==sourceRequest)return;ingest(bytes.subarray(offset,offset+8192));await sleep(20);}
      if(generation===state.generation){log(`Replay complete. ${state.frames} frames decoded. Display remains labeled FILE REPLAY.`);if(!state.frames)log('No complete supported frames found. The file may be empty, truncated, or use a different firmware protocol.');const remaining=state.decoder.buffer?.length||0;if(remaining)log(`Replay ended with ${remaining} buffered bytes: possible incomplete final frame.`);}
    }catch(e){log(`Replay error: ${error(e)}`);stopPlayback();}
  }
  function setupCanvas(canvas) {const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;const w=Math.max(200,r.width),h=Math.max(70,r.height);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);return {c,w,h};}
  function wave(canvas,values,color) {const {c,w,h}=setupCanvas(canvas);c.strokeStyle='#263447';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();const good=Array.from(values||[]).filter(Number.isFinite);if(good.length<2)return;const min=Math.min(...good),max=Math.max(...good),span=Math.max(.001,max-min);c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();good.forEach((v,i)=>{const x=i/(good.length-1)*w,y=h-8-(v-min)/span*(h-16);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}
  function vitalFreshness() {
    for(const v of state.vitals.values()) {
      const card=state.vitalCards.get(v.id);if(!card)continue;
      const age=Math.max(0,(Date.now()-v.receivedAt)/1000),stale=age>5;
      const source=state.source==='live'?(stale?'STALE · held last received estimates':'Last received estimates'):state.source==='demo'?'SYNTHETIC · held demo samples':state.source==='replay'?'REPLAY · held recorded samples':'OFFLINE · held last samples';
      card.status.textContent=`${source} · received ${new Date(v.receivedAt).toLocaleTimeString()} (${age.toFixed(1)} s ago), frame ${v.frameNumber}`;
      card.status.className='fine'+(stale||state.source==='offline'?' stale':'');
    }
  }
  function vitals() {
    const values=state.vitals.values();
    if(!values.length){if(!ui.vitalsCards.children.length){const p=document.createElement('p');p.className='muted empty';p.textContent='No vital-sign samples received in this session.';ui.vitalsCards.append(p);}return;}
    if(!state.vitalCards.size)ui.vitalsCards.replaceChildren();
    for(const v of values){
      let c=state.vitalCards.get(v.id);
      if(!c){
        const card=document.createElement('div');card.className='vital-card';const title=document.createElement('h3'),status=document.createElement('p'),row=document.createElement('div');row.className='vital-values';card.append(title,status,row);
        c={card,title,status,revision:0,rates:[],canvases:[]};
        for(const [name,unit] of [['Heart rate','bpm'],['Breathing','/min']]){const box=document.createElement('div'),strong=document.createElement('strong'),label=document.createElement('span');label.textContent=`${name} · ${unit}`;box.append(strong,label);row.append(box);c.rates.push(strong);}
        ui.vitalsCards.append(card);
        for(const label of ['Heart waveform','Breath waveform']){const text=document.createElement('p');text.className='fine';text.textContent=label+' · last 150 received samples · auto-scaled';const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',label);card.append(text,canvas);c.canvases.push(canvas);}
        state.vitalCards.set(v.id,c);
      }
      c.title.textContent=`Subject ${v.id} · range bin ${v.rangeBin??'—'}`;c.rates[0].textContent=v.heartRate.toFixed(1);c.rates[1].textContent=v.breathRate.toFixed(1);
      // Reuse the same card/canvas nodes; sparse frames never clear the plot.
      wave(c.canvases[0],v.heartWaveform,'#ff9eac');wave(c.canvases[1],v.breathWaveform,'#65decd');c.revision=v.revision;
    }
    vitalFreshness();
  }
  function render(){telemetry.render(ui.presentation.value,state.source,Date.now());legacy.render(ui.presentation.value,state.source,Date.now());scene.setFrame(state.frame);scene.setRange(+ui.range.value);state.trails.setDuration(+ui.trailDuration.value);scene.setTrails(ui.trailToggle.checked?state.trails.values(Date.now()):[]);scene.render();if(ui.presentation.value==='vitals')vitals();}
  for(const [id,preset] of [['viewOrbit','orbit'],['viewTop','top'],['viewFront','front'],['viewReset','reset']])ui[id].onclick=()=>{scene.preset(preset);scene.render();};
  ui.trailToggle.onchange=render;ui.trailDuration.onchange=render;ui.trailClear.onclick=()=>{state.trails.clear();render();};
  ui.zoomIn.onclick=()=>{scene.zoom(1.2);scene.render();};ui.zoomOut.onclick=()=>{scene.zoom(1/1.2);scene.render();};
  ui.cliConnect.onclick=()=>connect('cli');ui.dataConnect.onclick=()=>connect('data');ui.listen.onclick=()=>{sourceRequest++;startListening().catch(e=>log(error(e)));};ui.disconnect.onclick=()=>{sourceRequest++;disconnect().catch(e=>log(error(e)));};ui.sendConfig.onclick=sendConfig;ui.demo.onclick=demo;ui.stopPlayback.onclick=()=>{sourceRequest++;stopPlayback();};ui.clearLog.onclick=()=>{ui.log.textContent='';};
  ui.configFile.onchange=async()=>{
    if(state.profileChanging||state.sending||state.closing||!profileAllowed()||configBlocked()){log('Configuration loading is disabled for this profile or current action.');return;}
    const request=++configReadToken,profile=state.profile,file=ui.configFile.files[0];if(motion)motion.configFile(null,profile);state.commands=[];state.configKind=null;refresh();
    if(file){try{
      if(file.size>1024*1024)throw new Error('Configuration exceeds 1 MB limit.');
      const text=await file.text();if(request!==configReadToken||profile!==state.profile||state.profileChanging||state.sending||state.closing)return;
      if(motion)motion.configFile(file,profile);
      state.commands=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('%')&&!l.startsWith('#'));
      state.configKind=state.commands.length?(state.commands.some(l=>/vitalsign/i.test(l))?'vitals':(['people','people-low-power','overhead','vitals','small-obstacle'].includes(state.profile)?'people':'unverified')):null;
      ui.configInfo.textContent=`${file.name} · ${state.commands.length} commands`;log('Configuration loaded locally. Review the file before sending.');
    }catch(e){if(request===configReadToken)ui.configInfo.textContent=error(e);}}else ui.configInfo.textContent='No configuration loaded';refresh();
  };
  ui.replayFile.onchange=()=>{const file=ui.replayFile.files[0];ui.replayFile.value='';replay(file);};ui.presentation.onchange=()=>{refresh();render();};ui.range.onchange=render;window.addEventListener('resize',render);
  if('serial' in navigator)navigator.serial.addEventListener('disconnect',event=>{if(event.target===state.cli||event.target===state.data){log('A selected device was unplugged.');sourceRequest++;disconnect();}});
  setInterval(()=>{if(motion)motion.tick(Date.now());telemetry.render(ui.presentation.value,state.source,Date.now());legacy.render(ui.presentation.value,state.source,Date.now());scene.setTrails(ui.trailToggle.checked?state.trails.values(Date.now()):[]);scene.render();vitalFreshness();const el=$('freshness');if(!state.lastFrameAt){el.textContent='No decoded samples';return;}const age=(Date.now()-state.lastFrameAt)/1000;el.textContent=state.source==='live'?(age>2?`STALE · last decoded frame ${age.toFixed(0)} s ago`:'Receiving · updated '+age.toFixed(1)+' s ago'):`Last displayed frame · ${age.toFixed(0)} s ago`;el.className=state.source==='live'&&age>2?'stale':'';},500);
  window.addEventListener('radar-profile-change',event=>{
    const id=event.detail?.id;if(!id||!DemoCatalog.get(id)){event.preventDefault();log('Unknown demo profile rejected.');return;}
    if(state.sending||state.choosing||state.closing||state.dataBusy||state.profileChanging){event.preventDefault();log('Finish the current connection/configuration action before changing profiles.');return;}
    state.profileChanging=true;configReadToken++;sourceRequest++;stopPlayback();refresh();
    (async()=>{await stopListening();state.profile=id;if(motion)motion.configFile(null,id);state.commands=[];state.configKind=null;ui.configFile.value='';ui.configInfo.textContent='No configuration loaded';ui.presentation.value=['gesture','speed','vitals','level'].includes(id)?id:'people';reset('offline');log('Selected '+id+'. Histories cleared. No device command or firmware change was made.');})().catch(e=>log(error(e))).finally(()=>{state.profileChanging=false;refresh();});
  });
  window.addEventListener('radar-transport-change',event=>{
    if(state.cli||state.data||state.choosing||state.sending||state.closing||state.profileChanging){event.preventDefault();log('Disconnect TI interfaces before changing firmware protocol.');if(typeof alert==='function')alert('Disconnect the TI interfaces before changing firmware protocol.');return;}
    sourceRequest++;stopPlayback();reset('offline');
  });
  CatalogUI.mount(ui.demoCatalog);
  refresh();render();log('Ready. Connect two serial interfaces, replay a local recording, or run a labeled synthetic demo.');
})();
