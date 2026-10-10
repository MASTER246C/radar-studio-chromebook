'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Core=require('../motion_core.js'),Recorder=require('../capture_recorder.js'),{MotionPanel}=require('../motion_panel.js');
function fixture(){
 const elements={};class Element{constructor(){this.value='';this.textContent='';this.checked=false;this.disabled=false;this.files=[];this.children=[];}replaceChildren(...children){this.children=children;}appendChild(e){this.children.push(e);}click(){}remove(){}}
 const doc={getElementById(id){return elements[id]||(elements[id]=new Element());},createElement(){return new Element();},body:new Element()};
 const panel=new MotionPanel(doc,Core,Recorder),u=panel.ui;u.Radius.value='.75';u.Role.value='train';u.Session.value='take-one';u.Height.value='1.1';u.Offset.value='.05';u.Tilt.value='0';u.Tolerance.value='.02';u.PointsFrame.value='sensor';u.TracksFrame.value='world';u.Setup.value='fixture firmware';u.Target.value='1';return{panel,u};
}
function frame(n){return {frameNumber:n,profile:'people',tracks:[{id:1,x:0,y:2,z:1.3,vx:0,vy:0,vz:0}],points:Array.from({length:8},(_,i)=>({x:(i%2)*.05,y:2+(i%3)*.03,z:.1+i*.04,doppler:.01*i}))};}
(async()=>{
 const previous=global.confirm;global.confirm=()=>true;
 try{
  const {panel:p,u}=fixture();assert(u.Start.disabled);assert.equal(u.Prediction.textContent,'unknown');u.Apply.onclick();assert.match(u.Message.textContent,/Verify/);assert(!p.engine.snapshot().config.calibrated);
  u.Verified.checked=true;u.Apply.onclick();assert(p.engine.snapshot().config.calibrated);assert(Math.abs(p.engine.snapshot().config.height-1.15)<1e-9);assert.match(p.engine.snapshot().config.setupIdentity,/parser people/);
  p.setContext('demo','people');u.Start.onclick();assert.match(u.Message.textContent,/requires live/);assert.equal(p.engine.snapshot().sessions.length,0);
  p.reset('live','people');p.ingest([frame(1)],Date.now(),'live','people');u.Start.onclick();assert.equal(p.engine.snapshot().currentSession.id,'take-one');assert.equal(p.engine.snapshot().label,null);u.Sitting.onclick();assert.equal(p.engine.snapshot().label,'sitting');u.Pause.onclick();assert.equal(p.engine.snapshot().label,null);
  u.CaptureStart.onclick();assert.match(u.Message.textContent,/consent/);u.Consent.checked=true;u.CaptureStart.onclick();assert(p.recorder.snapshot().active);const at=Date.now();p.captureBytes(new Uint8Array([1,2,3,4]),at);p.captureFrames([frame(2),frame(3)],at);p.ingest([frame(2),frame(3)],at,'live','people');assert.equal(p.recorder.snapshot().rawBytes,4);assert.equal(p.recorder.snapshot().frameCount,2);assert.equal(p.engine.snapshot().counts.total,0);
  u.Standing.onclick();u.StandUpEvent.onclick();assert.equal(p.engine.snapshot().label,null);assert.equal(p.activeEvent.type,'sit_to_stand');u.Standing.onclick();assert.equal(p.engine.snapshot().label,null);assert.match(u.Message.textContent,/End the observed transition/);u.MoveEvent.onclick();assert.match(u.Message.textContent,/End the current/);u.EndEvent.onclick();assert.equal(p.activeEvent,null);u.MoveEvent.onclick();assert.equal(p.activeEvent.type,'movement_onset');u.CaptureStop.onclick();assert.equal(p.activeEvent,null);assert(!p.recorder.snapshot().active);const capture=JSON.parse(await p.recorder.exportBlob().text());assert.equal(capture.privacy.dataset_license_status,'pending');assert(capture.events.some(e=>JSON.stringify(e).includes('standing')));
  p.reset('offline','people');assert.equal(p.engine.snapshot().currentSession,null);assert(u.Start.disabled);p.reset('live','vitals');assert(!p.engine.snapshot().config.calibrated);assert(!u.Verified.checked);assert.equal(u.Prediction.textContent,'unknown');
  let read=false;await p.configFile({size:1024*1024+1,arrayBuffer(){read=true;throw Error('should not read');}},'people');assert(!read);
  // The UI import is atomic replacement; malformed input keeps existing state.
  const before=p.engine;u.Import.files=[{size:3,async text(){return 'bad';}}];await u.Import.onchange();assert.equal(p.engine,before);assert.match(u.Message.textContent,/Invalid/);
  u.Import.files=[{size:2*1024*1024+1,text(){throw Error('should not read');}}];await u.Import.onchange();assert.match(u.Message.textContent,/2 MiB/);
  const {panel:q,u:v}=fixture();v.Verified.checked=true;v.Apply.onclick();q.reset('live','people');v.Start.onclick();v.Sitting.onclick();const base=Date.now();for(let n=1;n<=32;n++)q.ingest([frame(n)],base+n*100,'live','people');assert.equal(q.engine.snapshot().counts.total,1);const data=q.engine.exportDataset(),identity=q.engine.snapshot().config.setupIdentity;v.Import.files=[{size:data.length,async text(){return data;}}];await v.Import.onchange();assert.equal(q.engine.snapshot().counts.total,1);v.Verified.checked=true;v.Apply.onclick();assert.equal(q.engine.snapshot().config.setupIdentity,identity);assert.equal(q.engine.snapshot().counts.total,1);
  q.configurationSending();assert(!q.engine.snapshot().config.calibrated);v.Verified.checked=true;v.Apply.onclick();assert.match(v.Message.textContent,/transmission/);assert(!q.engine.snapshot().config.calibrated);q.setContext('live','people',false);v.Apply.onclick();assert(q.engine.snapshot().config.calibrated);
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert(html.includes('<option value="sensor">Sensor-relative XYZ</option>'));assert(!html.includes('</option value='));
  console.log('PASS motion panel: measured/mixed coordinates, observed-label pause, synthetic exclusion, raw capture independent of classifier rejection, consent gate, source/profile reset, bounded config/import, atomic bad import, pending licensing, option markup. Mock DOM only.');
 }finally{global.confirm=previous;}
})().catch(e=>{console.error(e);process.exitCode=1;});
