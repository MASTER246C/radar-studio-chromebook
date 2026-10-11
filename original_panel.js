/* Local one-port original firmware workflow; original project LICENSE applies. */
(function(){
'use strict';
const $=id=>document.getElementById(id),selector=$('transportProtocol');if(!selector)return;
let port=null,writer=null,reader=null,readTask=null,choosing=false,closing=false,selected='ti',message='',overflowStopping=false,operation=null;
// Persist only a safety bit, never captures, annotations, device identity or coordinates.
let remembered=false;try{remembered=localStorage.getItem('original-radar-stop-unconfirmed')==='true';}catch(_){remembered=true;}
const tracker=new OriginalTracker.Tracker(),scene=new RadarScene($('originalScene'));let trackingEpoch=null;const derivedFrames=[];let derivedDropped=0;scene.attachPointerControls();
const session=new OriginalRadar.Session({onFrame:frame=>{const result=tracker.update(frame,Date.now());if(derivedFrames.length===256){derivedFrames.shift();derivedDropped++;}derivedFrames.push({connection_epoch:session.connectionEpoch,session_epoch:session.epoch,sequence:frame.sequence,sensor_timestamp_us:frame.timestamp_us,host_utc_ms:Date.now(),...result});},unconfirmed:remembered,rfEnabled:true,rfPolicy:OriginalRadarAcceptance,onChange:refresh,setUnconfirmed:value=>{try{localStorage.setItem('original-radar-stop-unconfirmed',String(value));}catch(_){message='Safety warning storage unavailable. Confirm idle before leaving this page.';}}});
function renderTracking(){
 const result=tracker.snapshot(),observed=result.tracks.filter(t=>t.observed);
 scene.setFrame(observed.length?{points:[],tracks:observed.map(t=>({id:t.id,x:t.xyz[0],y:t.xyz[1],z:t.xyz[2]}))}:null);
 scene.setTrails(result.tracks.filter(t=>t.observed).map(t=>({id:t.id,points:t.trail})));scene.render();
 $('originalTracks').textContent=result.reason+' · '+result.rejected+' invalid/unusable observations omitted.\n'+(result.tracks.map(t=>t.id+' · '+t.state+' · '+t.motion+' · confidence: '+t.confidence+' · '+t.uncertainty).join('\n')||'No candidate tracks.');
}
function refresh(){
 const epoch=session.connectionEpoch+':'+session.bootGeneration+':'+session.epoch;
 if(epoch!==trackingEpoch||!session.connected){tracker.reset('Connection/session reset; no live candidates');trackingEpoch=epoch;}
 renderTracking();
 const active=!!port,busy=session.busy||choosing||closing;
 $('originalConnect').disabled=active||busy||!('serial' in navigator)||!isSecureContext;
 $('originalConfigure').disabled=!active||busy||!!session.configureBlockReason();
 $('originalStatus').disabled=!active||busy;
 const startReason=session.startBlockReason();$('originalStart').disabled=!!startReason;
 $('originalStart').textContent=startReason?'Start · bring-up gate locked':'Start '+session.seconds+'-second bring-up test';
 const report=session.lastSelftestReport;const summary=report?JSON.stringify(report):'No current-connection onboard self-test report';
 $('originalSelftest').textContent=summary+' · Locally configured duration: '+(session.seconds??'none')+' seconds · '+(startReason||'Manual 1–5 second bring-up only; physical sensing remains unvalidated.');
 $('originalStop').disabled=!active||busy;
 $('originalCancel').disabled=!session.busy;
 $('originalDisconnect').disabled=!active||choosing||closing;
 $('originalSeconds').disabled=busy||session.state==='running';
 $('originalSave').disabled=!session.bytes;$('originalSaveRaw').disabled=!session.bytes;
 const annotations=!active||session.state!=='running'||session.overflow;
 for(const id of ['originalActivity','originalTransitionStart','originalTransitionEnd'])$(id).disabled=annotations;
 $('originalState').textContent=(active?'Connected · ':'Disconnected · ')+session.state+' · '+session.frames+' received frames · '+session.bytes+' bytes';
 $('originalWarning').textContent=session.unconfirmed?'STOP UNCONFIRMED: RF may still be running. Reconnect and query status; use Stop until a fresh status confirms idle. Closing this page does not stop the board.':'';
 $('originalMessage').textContent=message;
 const f=session.lastFrame;
 $('originalTelemetry').textContent=f?JSON.stringify({sequence:f.sequence,timestamp_us:f.timestamp_us,complete:f.complete,capture_fault:f.capture_fault,missed_frames:f.missed_frames,deadline_misses:f.deadline_misses,quality:f.quality,emitted_detection_count:f.count,detected_count:f.detected_count,truncated:f.truncated,profile_energy:f.profile_energy,detections:f.detections},null,2):'No original-radar-v1 frames received. No people count or activity is inferred.';
 $('originalIssues').textContent=session.issues.slice(-12).map(i=>i.message+(i.sequence!==undefined?' · frame '+i.sequence:'')).join('\n')||'No input issues reported yet.';
 if(session.droppedIssues||session.droppedEvents)$('originalIssues').textContent+='\nDiagnostic memory limit: '+session.droppedIssues+' issues / '+session.droppedEvents+' events omitted; export is flagged.';
 $('originalAnnotations').textContent=session.annotations.slice(-12).map(a=>new Date(a.host_utc_ms).toISOString()+' · '+a.kind+' · '+a.label+(a.incomplete?' · INCOMPLETE':'')).join('\n')||'No annotations yet.';
 if(session.overflow&&active&&!overflowStopping){overflowStopping=true;setTimeout(async()=>{if(session.busy||operation)session.cancel();if(operation)await operation.catch(()=>{});try{await session.stop();}catch(e){message='Capture limit: '+e.message;}refresh();},0);}
}
async function run(fn){if(operation||closing){message='Finish or cancel the pending action first.';refresh();return;}const task=Promise.resolve().then(fn);operation=task;try{await task;message='Action completed. See acknowledged device state above.';}catch(e){message=e.message;}finally{if(operation===task)operation=null;refresh();}}
async function connect(){
 if(choosing||port||closing)return;choosing=true;refresh();let candidate=null,opened=false;
 try{candidate=await navigator.serial.requestPort();await candidate.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});opened=true;writer=candidate.writable.getWriter();port=candidate;session.attach(bytes=>writer.write(bytes));
  readTask=(async()=>{try{reader=port.readable.getReader();while(port===candidate){const {value,done}=await reader.read();if(done)break;if(value)session.ingest(value);}}catch(e){message='Serial read: '+e.message;}finally{if(reader){reader.releaseLock();reader=null;}session.detach('Serial read ended');refresh();}})();
  message='Connected at 115200 8N1. No command was sent. Query status first.';
 }catch(e){if(opened&&!port)await candidate.close().catch(()=>{});message='Connect: '+e.message;}finally{choosing=false;refresh();}
}
async function disconnect(){
 if(!port||closing)return;closing=true;refresh();
 // Cancel in-flight config/start/status; then attempt a bounded stop + fresh status.
 if(session.busy||operation){session.cancel();if(operation)await operation.catch(()=>{});}
 if(session.connected&&(session.unconfirmed||['running','starting','stopping'].includes(session.state))){try{await session.stop();}catch(e){message='Disconnect: '+e.message;session.uncertain(true);}}
 const old=port;port=null;if(reader)await reader.cancel().catch(()=>{});if(readTask)await readTask;
 if(writer){writer.releaseLock();writer=null;}await old.close().catch(e=>{message='Port close: '+e.message;});
 if(session.connected)session.detach('User disconnected');closing=false;message=session.unconfirmed?'Disconnected; stop remains unconfirmed.':'Disconnected after observed idle (or no RF start observed).';refresh();
}
function save(rawOnly){const data=rawOnly?session.rawBytes():JSON.stringify({...session.snapshot(),derived_candidate_tracking:{schema:"original-candidate-tracks-v1",experimental:true,algorithm:"conservative-nearest-prediction-v1",stable_human_identity:false,people_count_inference:false,activity_inference:false,coordinate_space:"sensor-exploratory",frames:derivedFrames,dropped_derived_frames:derivedDropped}},null,2);const blob=new Blob([data],{type:rawOnly?'application/x-ndjson':'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='original-radar-'+new Date().toISOString().replace(/[:.]/g,'-')+(rawOnly?'.jsonl':'.capture.json');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message='Local download requested. Keep both data and labels private. Saving does not stop RF.';refresh();}
selector.onchange=()=>{
 const next=selector.value;if(next===selected)return;
 if(port||choosing||closing||session.busy){selector.value=selected;message='Disconnect before changing protocol.';refresh();return;}
 const event=new CustomEvent('radar-transport-change',{detail:{protocol:next},cancelable:true});window.dispatchEvent(event);
 if(event.defaultPrevented){selector.value=selected;return;}
 selected=next;$('tiDashboard').hidden=next==='original';$('originalPanel').hidden=next!=='original';$('modeBadge').textContent=next==='original'?'ORIGINAL JSON · BRING-UP ONLY':'OFFLINE';
};
$('originalConnect').onclick=connect;$('originalStatus').onclick=()=>run(()=>session.status());
$('originalConfigure').onclick=()=>run(()=>session.configure(Number($('originalSeconds').value)));
$('originalSeconds').oninput=()=>{session.invalidateConfiguration();message='Duration edited. Configure again before Start.';refresh();};
$('originalStart').onclick=()=>run(()=>{if(Number($('originalSeconds').value)!==session.seconds){session.invalidateConfiguration();throw Error('Duration changed. Configure again before Start.');}return session.start();});$('originalStop').onclick=()=>run(()=>session.stop());
$('originalCancel').onclick=()=>{session.cancel();message='Cancelled. Commands already sent may still execute. Stop/query status before proceeding.';refresh();};
$('originalDisconnect').onclick=disconnect;$('originalSave').onclick=()=>save(false);$('originalSaveRaw').onclick=()=>save(true);
$('originalActivity').onclick=()=>run(()=>session.annotate('activity',$('originalLabel').value));
$('originalTransitionStart').onclick=()=>run(()=>session.annotate('transition_start',$('originalTransition').value));
$('originalTransitionEnd').onclick=()=>run(()=>session.annotate('transition_end',session.openTransition?.label||$('originalTransition').value));
window.addEventListener('beforeunload',event=>{if(session.unconfirmed||session.bytes){if(session.unconfirmed)session.uncertain(true);event.preventDefault();event.returnValue='';}});
if('serial' in navigator)navigator.serial.addEventListener('disconnect',event=>{if(event.target===port){message='Device unplugged. RF stop cannot be assumed.';session.detach('Device unplugged');disconnect();}});
$('originalViewReset').onclick=()=>scene.preset('reset');
window.addEventListener('resize',renderTracking);
setInterval(()=>{tracker.expire(Date.now());renderTracking();},250);
refresh();
})();
