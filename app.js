'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['cliConnect','dataConnect','cliStatus','dataStatus','listen','disconnect','configFile','configInfo','configSummary','configWarning','sendConfig','replayFile','demo','stopPlayback','modeBadge','sourceTitle','frameStat','objectsStat','bytesStat','framesStat','frameWarnings','topCanvas','frontCanvas','vitalsSection','vitalsCards','presentation','range','log','clearLog','compatibility'].map(id => [id,$(id)]));
  const state = {cli:null,data:null,cliReader:null,dataReader:null,cliTask:null,dataTask:null,writer:null,choosing:false,closing:false,sending:false,listening:false,source:'offline',generation:0,playback:null,decoder:null,bytes:0,frames:0,frame:null,commands:[],configKind:null,ack:null,cliPartial:'',lastCliRead:0,lastFrameAt:0,dataBusy:false};
  const supported = isSecureContext && 'serial' in navigator;
  ui.compatibility.textContent = supported ? 'Web Serial ready. Select the correct two interfaces.' : 'Live serial requires a secure localhost/HTTPS page in a browser with Web Serial (Chrome on Chromebook). Replay and demo are still available.';
  const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
  function log(message) { const t = new Date().toLocaleTimeString(); ui.log.textContent += `[${t}] ${message}\n`; if (ui.log.textContent.length > 50000) ui.log.textContent=ui.log.textContent.slice(-40000); ui.log.scrollTop=ui.log.scrollHeight; }
  function error(e) { return e && e.message ? e.message : String(e); }
  function refresh() {
    ui.cliConnect.disabled=!supported||state.choosing||state.closing||!!state.cli;
    ui.dataConnect.disabled=!supported||state.choosing||state.closing||!!state.data;
    ui.listen.disabled=!state.data||state.closing||state.choosing||state.dataBusy;
    ui.listen.textContent=state.listening?'Stop listening':'Start listening';
    ui.disconnect.disabled=state.closing||state.choosing||(!state.cli&&!state.data);
    ui.sendConfig.disabled=!state.cli||!state.writer||!state.commands.length||state.sending||state.closing;
    ui.configFile.disabled=state.sending||state.closing;
    ui.stopPlayback.disabled=!['demo','replay'].includes(state.source);
    ui.demo.disabled=state.closing;
    ui.cliStatus.textContent=state.cli?(state.sending?'Sending configuration…':'Connected · 115200 baud'):'Not connected';
    ui.dataStatus.textContent=state.data?(state.listening?'Listening · 921600 baud':'Connected · not listening'):'Not connected';
    ui.modeBadge.textContent=({offline:'OFFLINE',live:'LIVE SERIAL',demo:'SYNTHETIC DEMO',replay:'FILE REPLAY'})[state.source];
    ui.modeBadge.className='badge '+state.source;
    ui.sourceTitle.textContent=({offline:'Waiting for a data source',live:'Reading your radar',demo:'Synthetic data · demonstration only',replay:'Recorded data · file replay'})[state.source];
    ui.vitalsSection.style.display=ui.presentation.value==='vitals'?'block':'none';
    ui.configSummary.textContent=state.configKind==='vitals'?'Vital-signs configuration':state.configKind==='people'?'People-tracking configuration (inferred)':'';
    ui.configWarning.textContent=state.configKind&&state.configKind!==ui.presentation.value?'The selected presentation differs from this configuration. Change it manually if needed. No commands have been sent automatically.':'';
  }
  function reset(source) { state.source=source; state.decoder=new RadarProtocol.StreamDecoder(); state.bytes=0; state.frames=0; state.frame=null;state.lastFrameAt=0; ui.frameStat.textContent='—'; ui.objectsStat.textContent='0 / 0'; ui.bytesStat.textContent='0 B'; ui.framesStat.textContent='0'; ui.frameWarnings.textContent=''; render(); refresh(); }
  function ingest(bytes) {
    state.bytes+=bytes.length;
    const priorErrors=state.decoder.errors||0;const frames=state.decoder.push(bytes);if((state.decoder.errors||0)>priorErrors)log(`Decoder rejected malformed data (${state.decoder.errors} total): ${state.decoder.lastError||'invalid frame'}`);
    state.frames+=frames.length;
    if(frames.length) { state.frame=frames[frames.length-1];state.lastFrameAt=Date.now(); ui.frameStat.textContent=String(state.frame.frameNumber); ui.objectsStat.textContent=`${(state.frame.points||[]).length} / ${(state.frame.tracks||[]).length}`; ui.frameWarnings.textContent=(state.frame.warnings||[]).join(' · '); render(); }
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
    if(state.source==='live'){state.source='offline';refresh();}
  }
  function stopPlayback(){state.generation++;if(state.playback)clearInterval(state.playback);state.playback=null;if(['demo','replay'].includes(state.source)){state.source='offline';refresh();}}
  async function startListening() {
    if(state.dataBusy)return;if(state.listening)return stopListening();
    if(!state.data||state.closing)return;
    stopPlayback();reset('live');state.listening=true;refresh();
    const port=state.data;
    state.dataTask=(async()=>{let reader;
      try{reader=port.readable.getReader();state.dataReader=reader;while(state.listening&&state.data===port){const {value,done}=await reader.read();if(done)break;if(value)ingest(value);}}
      catch(e){if(!state.closing)log(`Data read error: ${error(e)}`);}
      finally{if(reader)reader.releaseLock();state.dataReader=null;state.listening=false;if(state.source==='live')state.source='offline';refresh();}
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
    if(state.sending||!state.writer||!state.commands.length)return;state.sending=true;refresh();
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
    const request=++sourceRequest;stopPlayback();await stopListening();if(request!==sourceRequest||state.closing)return;
    reset('demo');log('Synthetic demo started. All displayed values are simulated.');let n=0;
    state.playback=setInterval(()=>{try{ingest(RadarProtocol.makeSyntheticFrame(n++));}catch(e){log(`Demo stopped: ${error(e)}`);stopPlayback();}},100);
  }
  async function replay(file) {
    if(!file)return;if(/^(?:3D_people_track_6843_demo|vital_signs_tracking_6843AOP_demo)\.bin$/i.test(file.name)){log('Replay rejected: '+file.name+' is a firmware image, not a recorded serial capture. Flash firmware only with the official TI workflow; choose a raw UART recording for replay.');return;}const request=++sourceRequest;stopPlayback();await stopListening();
    try{if(file.size>128*1024*1024)throw new Error('Replay file limit is 128 MB. Split larger recordings first.');const bytes=new Uint8Array(await file.arrayBuffer());if(request!==sourceRequest||state.closing)return;reset('replay');log(`Replaying local file: ${file.name}. Playback is chunk-paced, not original capture timing.`);const generation=state.generation;
      for(let offset=0;offset<bytes.length;offset+=8192){if(generation!==state.generation||request!==sourceRequest)return;ingest(bytes.subarray(offset,offset+8192));await sleep(20);}
      if(generation===state.generation){log(`Replay complete. ${state.frames} frames decoded. Display remains labeled FILE REPLAY.`);if(!state.frames)log('No complete supported frames found. The file may be empty, truncated, or use a different firmware protocol.');const remaining=state.decoder.buffer?.length||0;if(remaining)log(`Replay ended with ${remaining} buffered bytes: possible incomplete final frame.`);}
    }catch(e){log(`Replay error: ${error(e)}`);stopPlayback();}
  }
  function setupCanvas(canvas) {const r=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;const w=Math.max(200,r.width),h=Math.max(70,r.height);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.scale(dpr,dpr);return {c,w,h};}
  function plot(canvas,front) {
    const {c,w,h}=setupCanvas(canvas),range=+ui.range.value,pad=35;
    const xy=(x,y)=>[pad+(x+range)/(2*range)*(w-2*pad),h-pad-(front?(y+range)/(2*range):y/range)*(h-2*pad)];
    c.strokeStyle='#253346';c.lineWidth=1;c.font='10px system-ui';c.fillStyle='#8295ad';
    for(let i=0;i<=4;i++){let x=-range+i*range/2;let [px]=xy(x,0);c.beginPath();c.moveTo(px,pad);c.lineTo(px,h-pad);c.stroke();c.fillText(x.toFixed(1),px-10,h-12);let y=front?-range+i*range/2:i*range/4;let [,py]=xy(0,y);c.beginPath();c.moveTo(pad,py);c.lineTo(w-pad,py);c.stroke();c.fillText(y.toFixed(1),3,py+3);}
    c.save();c.beginPath();c.rect(pad,pad,w-pad*2,h-pad*2);c.clip();
    for(const p of state.frame?.points||[]){if(!Number.isFinite(p.x)||!Number.isFinite(front?p.z:p.y))continue;const [x,y]=xy(p.x,front?p.z:p.y);c.fillStyle='#65decd';c.globalAlpha=.8;c.beginPath();c.arc(x,y,2.5,0,Math.PI*2);c.fill();}c.globalAlpha=1;
    for(const t of state.frame?.tracks||[]){if(!Number.isFinite(t.x)||!Number.isFinite(front?t.z:t.y))continue;const [x,y]=xy(t.x,front?t.z:t.y);c.strokeStyle='#74a7ff';c.lineWidth=2;c.beginPath();c.arc(x,y,9,0,Math.PI*2);c.stroke();c.fillStyle='#b2ceff';c.fillText(`ID ${t.id}`,x+12,y-7);}
    c.restore();const [sx,sy]=xy(0,0);c.fillStyle='#e6edf7';c.beginPath();c.moveTo(sx,sy-5);c.lineTo(sx-4,sy+3);c.lineTo(sx+4,sy+3);c.fill();
    if(!state.frame){c.fillStyle='#92a4bb';c.textAlign='center';c.fillText('No decoded frames yet',w/2,h/2);c.textAlign='start';}
  }
  function wave(canvas,values,color) {const {c,w,h}=setupCanvas(canvas);c.strokeStyle='#263447';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();const good=Array.from(values||[]).filter(Number.isFinite);if(good.length<2)return;const min=Math.min(...good),max=Math.max(...good),span=Math.max(.001,max-min);c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();good.forEach((v,i)=>{const x=i/(good.length-1)*w,y=h-8-(v-min)/span*(h-16);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}
  function vitals() {ui.vitalsCards.replaceChildren();const values=state.frame?.vitals||[];if(!values.length){const p=document.createElement('p');p.className='muted empty';p.textContent='No vital-sign samples in the current frame.';ui.vitalsCards.append(p);return;}
    for(const v of values){const card=document.createElement('div');card.className='vital-card';const title=document.createElement('h3');title.textContent=`Subject ${v.id} · range bin ${v.rangeBin ?? '—'}`;card.append(title);const row=document.createElement('div');row.className='vital-values';for(const [name,value,unit] of [['Heart rate',v.heartRate,'bpm'],['Breathing',v.breathRate,'/min']]){const box=document.createElement('div'),strong=document.createElement('strong'),label=document.createElement('span');strong.textContent=Number.isFinite(value)?value.toFixed(1):'—';label.textContent=`${name} · ${unit}`;box.append(strong,label);row.append(box);}card.append(row);ui.vitalsCards.append(card);for(const [label,values,color] of [['Heart waveform',v.heartWaveform,'#ff9eac'],['Breath waveform',v.breathWaveform,'#65decd']]){const text=document.createElement('p');text.className='fine';text.textContent=label+' · auto-scaled';const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',label);card.append(text,canvas);wave(canvas,values,color);}}
  }
  function render(){plot(ui.topCanvas,false);plot(ui.frontCanvas,true);if(ui.presentation.value==='vitals')vitals();}
  ui.cliConnect.onclick=()=>connect('cli');ui.dataConnect.onclick=()=>connect('data');ui.listen.onclick=()=>{sourceRequest++;startListening().catch(e=>log(error(e)));};ui.disconnect.onclick=()=>{sourceRequest++;disconnect().catch(e=>log(error(e)));};ui.sendConfig.onclick=sendConfig;ui.demo.onclick=demo;ui.stopPlayback.onclick=()=>{sourceRequest++;stopPlayback();};ui.clearLog.onclick=()=>{ui.log.textContent='';};
  ui.configFile.onchange=async()=>{const file=ui.configFile.files[0];state.commands=[];state.configKind=null;if(file){try{if(file.size>1024*1024)throw new Error('Configuration exceeds 1 MB limit.');const text=await file.text();state.commands=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('%')&&!l.startsWith('#'));state.configKind=state.commands.length?(state.commands.some(l=>/vitalsign/i.test(l))?'vitals':'people'):null;ui.configInfo.textContent=`${file.name} · ${state.commands.length} commands`;log('Configuration loaded locally. Review the file before sending.');}catch(e){ui.configInfo.textContent=error(e);}}refresh();};
  ui.replayFile.onchange=()=>{const file=ui.replayFile.files[0];ui.replayFile.value='';replay(file);};ui.presentation.onchange=()=>{refresh();render();};ui.range.onchange=render;window.addEventListener('resize',render);
  if('serial' in navigator)navigator.serial.addEventListener('disconnect',event=>{if(event.target===state.cli||event.target===state.data){log('A selected device was unplugged.');sourceRequest++;disconnect();}});
  setInterval(()=>{const el=$('freshness');if(!state.lastFrameAt){el.textContent='No decoded samples';return;}const age=(Date.now()-state.lastFrameAt)/1000;el.textContent=state.source==='live'?(age>2?`STALE · last decoded frame ${age.toFixed(0)} s ago`:'Receiving · updated '+age.toFixed(1)+' s ago'):`Last displayed frame · ${age.toFixed(0)} s ago`;el.className=state.source==='live'&&age>2?'stale':'';},500);
  refresh();render();log('Ready. Connect two serial interfaces, replay a local recording, or run a labeled synthetic demo.');
})();
