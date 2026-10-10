/* Original project code; governed by the unchanged project LICENSE. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OriginalRadar=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PROTOCOL='original-radar-v1',STATES=['idle','starting','running','stopping','fault'];
const uint=x=>Number.isSafeInteger(x)&&x>=0;
function validate(r){
 const finite=v=>{if(typeof v==='number'&&!Number.isFinite(v))throw Error('Non-finite JSON number');if(v&&typeof v==='object')for(const x of Object.values(v))finite(x);};finite(r);
 if(!r||r.protocol!==PROTOCOL)throw Error('Wrong or missing protocol');
 if(r.type==='ack'){if(typeof r.command!=='string'||!Number.isInteger(r.code)||!STATES.includes(r.state)||typeof r.configured!=='boolean')throw Error('Invalid ACK');}
 else if(r.type==='status'){if(!STATES.includes(r.state)||typeof r.configured!=='boolean'||!uint(r.fault)||!uint(r.frames))throw Error('Invalid status');}
 else if(r.type==='identity'){if(r.baud!==115200||typeof r.version!=='string'||r.classifier!==false)throw Error('Unsupported identity');}
 else if(r.type==='frame'){
  if(!uint(r.sequence)||!uint(r.timestamp_us)||typeof r.complete!=='boolean'||!uint(r.capture_fault)||!uint(r.missed_frames)||!uint(r.deadline_misses)||!uint(r.quality)||!uint(r.count)||r.count>3||!uint(r.detected_count)||r.detected_count>8||r.detected_count<r.count||typeof r.truncated!=='boolean'||r.truncated!==(r.detected_count>r.count)||!Array.isArray(r.detections)||r.detections.length!==r.count||!Array.isArray(r.profile_energy)||r.profile_energy.length!==3||!r.profile_energy.every(x=>Number.isFinite(x)&&x>=0))throw Error('Invalid frame shape');
  if(!r.mount||!Number.isFinite(r.mount.bracket_top_m)||!Number.isFinite(r.mount.down_tilt_deg)||![r.mount.antenna_offset_m,r.mount.antenna_height_m].every(v=>v===null||Number.isFinite(v))||typeof r.mount.world_height_valid!=='boolean'||!uint(r.frame_events)||!uint(r.processing_us)||!uint(r.previous_tx_us)||!Number.isFinite(r.range_bin_m)||r.range_bin_m<=0||!Number.isFinite(r.velocity_bin_mps)||r.velocity_bin_mps<=0)throw Error('Invalid frame metadata');
  for(const d of r.detections){if(!d||!Number.isFinite(d.range_m)||d.range_m<0||!Number.isFinite(d.velocity_mps)||!Number.isFinite(d.power)||d.power<0||!uint(d.spatial_flags)||d.activity!==null||!Array.isArray(d.phasors)||d.phasors.length!==4||!d.phasors.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||![d.sensor_xyz_m,d.world_xyz_m].every(p=>p===null||(Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))))throw Error('Invalid detection');}
 }else throw Error('Unknown record type');
 return r;
}
class Decoder{
 constructor(onRecord,onIssue){this.onRecord=onRecord;this.onIssue=onIssue;this.line=[];this.discard=false;this.lines=0;}
 push(bytes){for(const b of bytes){if(b===10){this.lines++;if(!this.discard){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(this.line));this.onRecord(validate(JSON.parse(text)),this.lines);}catch(e){this.onIssue(e.message,this.lines);}}this.line=[];this.discard=false;}else if(!this.discard){this.line.push(b);if(this.line.length>4096){this.onIssue('Overlong JSONL record',this.lines+1);this.line=[];this.discard=true;}}}}
 finish(){if(this.line.length||this.discard)this.onIssue('Incomplete final JSONL record',this.lines+1);this.line=[];this.discard=false;}
}
class Session{
 constructor({write,onChange=()=>{},setUnconfirmed=()=>{},unconfirmed=false,timeoutMs=5000,rfEnabled=false,now=()=>Date.now(),maxBytes=8*1024*1024}={}){
  Object.assign(this,{write,onChange,setUnconfirmed,unconfirmed,timeoutMs,rfEnabled,now,maxBytes});this.connected=false;this.state='unknown';this.configured=false;this.pending=null;this.busy=false;this.cancelled=false;this.desynced=false;this.raw=[];this.bytes=0;this.issues=[];this.events=[];this.droppedIssues=0;this.droppedEvents=0;this.annotations=[];this.frames=0;this.lastFrame=null;this.identity=null;this.lastSequence=null;this.epoch=0;this.connectionEpoch=0;this.openTransition=null;this.overflow=false;this.unsavedBytes=0;this.createdAt=now();this.stateRevision=0;this.decoder=this.newDecoder();
 }
 newDecoder(){return new Decoder((r,line)=>this.record(r,line),(message,line)=>this.issue(message,{line}));}
 event(type,detail={}){if(this.events.length>=2048){this.droppedEvents++;this.onChange();return;}this.events.push({type,host_utc_ms:this.now(),epoch:this.epoch,connection_epoch:this.connectionEpoch,raw_byte_offset:this.bytes,observed_byte_offset:this.bytes+this.unsavedBytes,...detail});this.onChange();}
 issue(message,detail={}){if(this.issues.length>=2048){this.droppedIssues++;this.onChange();return;}this.issues.push({message,host_utc_ms:this.now(),epoch:this.epoch,connection_epoch:this.connectionEpoch,raw_byte_offset:this.bytes,observed_byte_offset:this.bytes+this.unsavedBytes,...detail});this.onChange();}
 uncertain(value){this.unconfirmed=value;this.setUnconfirmed(value);this.onChange();}
 attach(write){if(this.connected)throw Error('Already connected');this.write=write;this.connectionEpoch++;this.lastSequence=null;this.decoder=this.newDecoder();this.connected=true;this.lastFrame=null;this.state='unknown';this.configured=false;this.desynced=false;this.uncertain(true);this.event('connected');}
 detach(reason='disconnected'){
  if(['running','starting','stopping'].includes(this.state)||this.pending?.command==='start'||this.unconfirmed)this.uncertain(true);
  this.connected=false;this.configured=false;this.decoder.finish();if(this.pending)this.pending.finish(Error(reason));this.closeTransition(true,reason);this.event('disconnected',{reason});this.state='unknown';this.onChange();
 }
 ingest(input){const bytes=Uint8Array.from(input);if(this.overflow||this.bytes+bytes.length>this.maxBytes){if(!this.overflow){this.overflow=true;this.issue('Capture memory limit reached; incoming bytes are no longer saved');this.uncertain(true);this.cancelled=true;}this.unsavedBytes+=bytes.length;this.decoder.push(bytes);this.onChange();return;}
  let at=0;while(at<bytes.length){const index=Math.floor(this.bytes/65536),offset=this.bytes%65536;if(!this.raw[index])this.raw[index]=new Uint8Array(65536);const n=Math.min(65536-offset,bytes.length-at);this.raw[index].set(bytes.subarray(at,at+n),offset);this.bytes+=n;at+=n;}this.decoder.push(bytes);this.onChange();
 }
 record(r,line){
  if(r.type==='identity')this.identity=JSON.parse(JSON.stringify(r));
  if(r.type==='frame'){
   this.stateRevision++;this.frames++;this.lastFrame=JSON.parse(JSON.stringify(r));
   if(!r.complete||r.capture_fault||r.missed_frames||r.deadline_misses)this.issue('Frame acquisition fault/incomplete data',{line,sequence:r.sequence,capture_fault:r.capture_fault,missed_frames:r.missed_frames,deadline_misses:r.deadline_misses});
   if(r.truncated)this.issue('Top-three output truncated; detections omitted',{line,sequence:r.sequence});
   if(this.lastSequence!==null&&r.sequence!==this.lastSequence+1)this.issue('Sequence gap/reset/duplicate',{line,sequence:r.sequence,previous:this.lastSequence});this.lastSequence=r.sequence;
   this.state='running';this.uncertain(true);
  }
  if(r.type==='status'){
   this.stateRevision++;this.state=r.state;this.configured=r.configured;
   if(r.fault||r.state==='fault'){this.issue('Firmware fault',{line,fault:r.fault});this.uncertain(true);}
   if(['running','starting','stopping'].includes(r.state))this.uncertain(true);
   // An explicit fresh status request is needed to clear uncertainty, never an unrelated ACK/identity.
   if(this.pending?.command==='status'&&this.pending.sent){this.pending.status=r;this.pending.statusRevision=this.stateRevision;this.pending.check();}
   if(r.state==='idle')this.closeTransition(true,'Firmware session ended');
  }
  if(r.type==='ack'){
   const p=this.pending;if(p&&p.sent&&r.command===p.command){if(r.code!==0)p.finish(Error('Command rejected: '+r.command+' ('+r.code+')'));else{p.ack=r;p.check();}}
   else this.event('unmatched_ack',{command:r.command,code:r.code});
  }
  this.onChange();
 }
 command(text){
  if(!this.connected||!this.write)return Promise.reject(Error('Not connected'));
  if(this.pending)return Promise.reject(Error('Another command is awaiting acknowledgement'));
  const command=text.split(' ')[0];
  if(this.desynced&&!['stop','status'].includes(command))return Promise.reject(Error('Command timeout/cancellation: reconnect and query status before configuring'));
  return new Promise((resolve,reject)=>{
   const p={command,ack:null,status:null,finish:err=>{if(this.pending!==p)return;clearTimeout(p.timer);this.pending=null;err?reject(err):resolve(p);this.onChange();},check:()=>{if(p.ack&&(command!=='status'||p.status)){if(command==='status'&&(p.statusRevision!==this.stateRevision||p.ack.state!==p.status.state||p.ack.configured!==p.status.configured)){p.finish(Error('State changed after status; query again'));return;}if(command==='status'&&p.status.state==='idle'&&p.status.fault===0&&!this.desynced){this.uncertain(false);this.closeTransition(true,'Observed idle status');}p.finish();}}};
   this.pending=p;p.timer=setTimeout(()=>{this.desynced=true;p.finish(Error('No matching acknowledged response for '+command));},this.timeoutMs);
   this.event('command',{command:text});Promise.resolve().then(()=>{if(this.pending!==p||!this.connected)throw Error('Command cancelled before write');p.sent=true;return this.write(new TextEncoder().encode(text+'\n'));}).catch(e=>{if(p.sent){this.desynced=true;this.uncertain(true);}p.finish(e);});
  });
 }
 async status(){if(this.busy)throw Error('An operation is in progress');this.busy=true;this.cancelled=false;this.onChange();try{const p=await this.command('status');if(this.cancelled)throw Error('Cancelled');if(this.desynced)throw Error('Command stream is desynchronized; reconnect before trusting idle');return p.status;}finally{this.busy=false;this.onChange();}}
 async configure(seconds){
  if(!Number.isInteger(seconds)||seconds<1||seconds>600)throw Error('Session must be an integer from 1 to 600 seconds');
  if(this.busy||this.unconfirmed||this.state!=='idle')throw Error('Query status and confirm idle before configuring');
  this.busy=true;this.cancelled=false;this.configured=false;this.onChange();
  try{for(const line of ['orConfig 1','profile room64_v1','mount 1219 0 unknown','detect 4 30 64 8','session '+seconds,'commit']){if(this.cancelled)throw Error('Cancelled');const p=await this.command(line);if(p.ack.state!=='idle')throw Error('Configuration ACK did not report idle');}if(this.cancelled)throw Error('Cancelled');const p=await this.command('status');if(this.cancelled)throw Error('Cancelled');if(p.status.state!=='idle'||!p.status.configured||p.status.fault)throw Error('Configuration not confirmed idle/committed');this.seconds=seconds;this.event('configured',{seconds});}finally{this.busy=false;this.onChange();}
 }
 async start(){
  if(!this.rfEnabled)throw Error('RF tests paused: fixed firmware acceptance is required');
  if(this.busy||!this.configured||this.state!=='idle'||this.unconfirmed||this.overflow)throw Error('Start requires a confirmed idle, configured device and complete capture');
  this.busy=true;this.cancelled=false;this.epoch++;this.lastSequence=null;this.lastFrame=null;this.uncertain(true);this.event('session_requested',{seconds:this.seconds});
  try{await this.command('start');if(this.cancelled)throw Error('Cancelled');let p=await this.command('status');if(this.cancelled)throw Error('Cancelled');if(p.status.state!=='running'||p.status.fault)throw Error('Running state not confirmed; Stop and query status');this.event('running_confirmed');}finally{this.busy=false;this.onChange();}
 }
 async stop(){
  if(this.busy)throw Error('Cancel the pending operation first');this.busy=true;this.cancelled=false;this.uncertain(true);this.closeTransition(true,'Stop requested');
  try{await this.command('stop');if(this.cancelled)throw Error('Cancelled');const p=await this.command('status');if(this.cancelled)throw Error('Cancelled');if(p.status.state!=='idle'||p.status.fault||this.unconfirmed)throw Error('Idle not confirmed; device may still be running');this.event('stopped_confirmed');}finally{this.busy=false;this.onChange();}
 }
 cancel(){this.cancelled=true;this.desynced=true;if(this.pending?.command==='start'||['running','starting','stopping'].includes(this.state))this.uncertain(true);if(this.pending)this.pending.finish(Error('Cancelled; command may already have reached device'));this.event('operation_cancelled');}
 annotate(kind,label){if(this.annotations.length>=10000)throw Error('Annotation limit reached; save this capture');if(!this.connected||this.state!=='running'||this.overflow)throw Error('Annotations require a receiving run');if(!['activity','transition_start','transition_end'].includes(kind)||!['sitting','standing','walking','unknown','sit-to-stand','movement-onset'].includes(label))throw Error('Unsupported annotation');
  if((kind==='activity'&&!['sitting','standing','walking','unknown'].includes(label))||(kind!=='activity'&&!['sit-to-stand','movement-onset'].includes(label)))throw Error('Annotation kind/label mismatch');
  if(kind==='transition_start'&&this.openTransition)throw Error('End the open transition first');if(kind==='transition_end'&&(!this.openTransition||this.openTransition.label!==label))throw Error('No matching transition');
  const a={kind,label,host_utc_ms:this.now(),sensor_timestamp_us:this.lastFrame?.timestamp_us??null,sequence:this.lastFrame?.sequence??null,epoch:this.epoch,connection_epoch:this.connectionEpoch,source:'human-observed',review_status:'unreviewed',observer_latency_ms:null};this.annotations.push(a);if(kind==='transition_start')this.openTransition=a;if(kind==='transition_end')this.openTransition=null;this.onChange();
 }
 closeTransition(incomplete,reason){if(this.openTransition){this.annotations.push({kind:'transition_end',label:this.openTransition.label,epoch:this.openTransition.epoch,connection_epoch:this.openTransition.connection_epoch,host_utc_ms:this.now(),sensor_timestamp_us:this.lastFrame?.timestamp_us??null,source:'system',review_status:'unreviewed',incomplete,reason});this.openTransition=null;}}
 rawBytes(){const bytes=new Uint8Array(this.bytes);let n=0;for(const c of this.raw){const count=Math.min(c.length,this.bytes-n);bytes.set(c.subarray(0,count),n);n+=count;}return bytes;}
 snapshot(){let binary='';for(const byte of this.rawBytes())binary+=String.fromCharCode(byte);const base64=typeof btoa==='function'?btoa(binary):Buffer.from(binary,'binary').toString('base64');return JSON.parse(JSON.stringify({schema:'original-radar-capture',version:1,protocol:PROTOCOL,created_utc_ms:this.createdAt,exported_utc_ms:this.now(),serial:{baud:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'},raw_encoding:'base64',raw_jsonl_bytes:base64,raw_byte_count:this.bytes,identity:this.identity,events:this.events,annotations:this.annotations,issues:this.issues.concat(this.decoder.line.length||this.decoder.discard?[{message:'Incomplete final JSONL record at export',host_utc_ms:this.now(),epoch:this.epoch}]:[]),frames:this.frames,state:this.state,stop_unconfirmed:this.unconfirmed,capture_overflow:this.overflow,dropped_issue_count:this.droppedIssues,dropped_event_count:this.droppedEvents,unsaved_byte_count:this.unsavedBytes,buffered_bytes:this.decoder.line.length,open_transition:this.openTransition,limits:{spatial_estimator_defect:true,rf_tests_paused:true,activity_inference:false,people_count_inference:false,host_clock:'Date.now, unsynchronized with sensor',annotation_timing:'human click, latency unknown',license_status:'capture rights not granted by source license'}}));}
}
return {PROTOCOL,validate,Decoder,Session};
});
