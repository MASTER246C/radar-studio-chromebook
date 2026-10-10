/* No browser/device access: fake DOM + real Web Streams, explicit mock Web Serial. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const protocol=require('../radar_protocol.js');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<500;i++){if(fn())return;await pause(5);}throw Error('Timed out waiting for UI state');}
function environment(withSerial=true){
 const elements={},intervals=new Map();let timer=0;
 class Element{constructor(){this.textContent='';this.disabled=false;this.style={};this.files=[];this.value='';this.children=[];this.className='';}append(...e){this.children.push(...e);}replaceChildren(...e){this.children=e;}setAttribute(){}getBoundingClientRect(){return{width:500,height:310};}getContext(){return new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}}
 const document={getElementById(id){return elements[id]||(elements[id]=new Element());},createElement(){return new Element();}};
 document.getElementById('presentation').value='people';document.getElementById('range').value='5';
 let select=0,reply='done',writes=[];
 function port(cli){let control,cancelled=false;return{async open(){this.readable=new ReadableStream({start(c){control=c;cancelled=false;},cancel(){cancelled=true;}});this.writable=new WritableStream({async write(b){writes.push(new TextDecoder().decode(b));if(cli&&reply!=='silence'){const message=reply==='error'?'Error -1\r\n':'Done\r\nmmwDemo:/> ';setTimeout(()=>!cancelled&&control.enqueue(new TextEncoder().encode(message.slice(0,2))),2);setTimeout(()=>!cancelled&&control.enqueue(new TextEncoder().encode(message.slice(2))),4);}if(reply==='slowwrite')await pause(50);}});},async close(){},emit(b){control.enqueue(b);}};}
 const ports=[port(true),port(false)],serial={async requestPort(){return ports[select++%2];},addEventListener(){}};
 const context={document,navigator:withSerial?{serial}:{},isSecureContext:true,TextDecoder,TextEncoder,Uint8Array,Date,Math,Number,String,Array,Promise,Error,RadarProtocol:protocol,console,
 setTimeout:(f,ms)=>setTimeout(f,ms===5000?100:ms),clearTimeout,setInterval(f){intervals.set(++timer,f);return timer;},clearInterval(id){intervals.delete(id);}};
 context.window={devicePixelRatio:1,addEventListener(){}};vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'),'utf8'),context);
 return{ui:elements,intervals,ports,setReply:v=>reply=v,writes,select:n=>select=n};
}
(async()=>{
 const offline=environment(false);assert(offline.ui.cliConnect.disabled);assert(offline.ui.compatibility.textContent.includes('requires'));
 const e=environment(),u=e.ui;
 await u.demo.onclick();assert.equal(u.modeBadge.textContent,'SYNTHETIC DEMO');for(const f of e.intervals.values())f();assert.equal(u.framesStat.textContent,'1');assert.equal(u.objectsStat.textContent,'36 / 1');u.presentation.value='vitals';u.presentation.onchange();assert.equal(u.vitalsCards.children.length,1);u.stopPlayback.onclick();assert.equal(u.modeBadge.textContent,'OFFLINE');
 await u.cliConnect.onclick();assert.equal(e.writes.length,0);e.select(0);await u.dataConnect.onclick();assert(u.log.textContent.includes('already selected'));assert.equal(u.dataStatus.textContent,'Not connected');e.select(1);await u.dataConnect.onclick();assert.equal(e.writes.length,0);
 u.listen.onclick();e.ports[1].emit(protocol.makeSyntheticFrame(42));await until(()=>u.frameStat.textContent==='42');assert.equal(u.modeBadge.textContent,'LIVE SERIAL');
 u.configFile.files=[{name:'test.cfg',size:40,async text(){return '% comment\nprofileCfg 1\nsensorStart\n';}}];await u.configFile.onchange();assert.equal(u.configSummary.textContent,'People-tracking configuration (inferred)');assert(u.configWarning.textContent.includes('differs'));u.presentation.value='people';u.presentation.onchange();assert.equal(u.configWarning.textContent,'');await u.sendConfig.onclick();assert.deepEqual(e.writes,['profileCfg 1\n','sensorStart\n']);assert(u.log.textContent.includes('Configuration complete'));
 e.writes.length=0;e.setReply('error');await u.sendConfig.onclick();assert.deepEqual(e.writes,['profileCfg 1\n']);assert(u.log.textContent.includes('Device rejected command'));
 e.writes.length=0;e.setReply('silence');await u.sendConfig.onclick();assert.deepEqual(e.writes,['profileCfg 1\n']);assert(u.log.textContent.includes('No Done acknowledgement'));
 u.listen.onclick();u.listen.onclick();await until(()=>u.dataStatus.textContent==='Connected · not listening');assert(!u.log.textContent.includes('locked'));
 e.writes.length=0;e.setReply('slowwrite');const sending=u.sendConfig.onclick();await until(()=>e.writes.length===1);u.disconnect.onclick();await sending;await until(()=>u.log.textContent.includes('Disconnected.'));assert.deepEqual(e.writes,['profileCfg 1\n']);assert.equal(u.cliStatus.textContent,'Not connected');
 u.replayFile.files=[{name:'empty.bin',size:0,async arrayBuffer(){return new ArrayBuffer(0);}}];u.replayFile.onchange();await until(()=>u.log.textContent.includes('No complete supported frames'));assert.equal(u.modeBadge.textContent,'FILE REPLAY');
 u.configFile.files=[{name:'vitals.cfg',size:40,async text(){return 'sensorStop\nvitalsign 15 300\nsensorStart\n';}}];await u.configFile.onchange();assert.equal(u.configSummary.textContent,'Vital-signs configuration');assert(u.configWarning.textContent.includes('differs'));assert.equal(u.presentation.value,'people');assert.equal(e.writes.length,1);for(const name of ['3D_people_track_6843_demo.bin','vital_signs_tracking_6843AOP_demo.bin']){let read=false;u.replayFile.files=[{name,size:100,async arrayBuffer(){read=true;return new ArrayBuffer(0);}}];u.replayFile.onchange();await pause(5);assert(!read);assert(u.log.textContent.includes(name+' is a firmware image'));}assert.equal(u.modeBadge.textContent,'FILE REPLAY');
 console.log('PASS: unsupported browser, demo labeling/render paths, two-port selection, duplicate port rejection, no implicit writes, live frame decode, split Done, Error/timeout stop, repeated listening clicks, disconnect during config, empty replay, config summaries/mismatch without auto-change or send, both firmware replay guards. Mock DOM tests only; visual rendering not verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
