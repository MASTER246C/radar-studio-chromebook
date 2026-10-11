'use strict';
// Synthetic protocol fixtures and in-memory writers only. Never opens a serial port,
// requests hardware, performs network I/O, or transmits RF. A synthetic approved
// policy is supplied only inside mock sessions to exercise gated start controls.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../original_radar.js'),'utf8');
const {PROTOCOL,validate,Decoder,Session}=require('../original_radar.js');
const tests=[];const test=(name,run)=>tests.push({name,run});
const TEST_POLICY=Object.freeze({approved:true,firmwareVersion:'0.2.2-rc1',buildId:'synthetic-test-only-build',selftestVersion:1,maxSeconds:5});
const clone=x=>JSON.parse(JSON.stringify(x));
const wire=(r,eol='\n')=>new TextEncoder().encode(JSON.stringify(r)+eol);
const ack=(command='status',extra={})=>({type:'ack',protocol:PROTOCOL,command,code:0,state:'idle',configured:true,...extra});
const status=(extra={})=>({type:'status',protocol:PROTOCOL,state:'idle',configured:true,fault:0,frames:0,capture_fault:0,rf_fault:0,rf_error:0,deadline_misses:0,firmware_version:TEST_POLICY.firmwareVersion,build_id:TEST_POLICY.buildId,selftest_version:TEST_POLICY.selftestVersion,selftest_ok:true,selftest_mask:0,...extra});
const identity=(extra={})=>({type:'identity',protocol:PROTOCOL,app:'original-radar-sensing',version:'0.2.0',baud:115200,sensing:true,classifier:false,...extra});
const detection=(extra={})=>({range_m:2.34,velocity_mps:0,power:100,phasors:[[10,0],[10,0],[10,0],[10,0]],sensor_xyz_m:[0,2.34,0],world_xyz_m:null,spatial_flags:3,activity:null,...extra});
const frame=(extra={})=>({type:'frame',protocol:PROTOCOL,sequence:0,timestamp_us:1234000,complete:true,missed_frames:0,capture_fault:0,quality:44,frame_events:1,processing_us:14000,previous_tx_us:85000,deadline_misses:0,mount:{bracket_top_m:2,down_tilt_deg:15,antenna_offset_m:null,antenna_height_m:null,world_height_valid:false},range_bin_m:0.195,velocity_bin_mps:0.305,profile_energy:[150,120,30],detected_count:1,count:1,truncated:false,detections:[detection()],...extra});
function parse(bytes,chunkSize=bytes.length){const records=[],issues=[];const d=new Decoder((record,line)=>records.push({record,line}),(message,line)=>issues.push({message,line}));for(let i=0;i<bytes.length;i+=chunkSize)d.push(bytes.subarray(i,i+chunkSize));return{d,records,issues};}
async function flush(){for(let i=0;i<30;i++)await Promise.resolve();}
function mock(options={}){
 let time=1000,next=1;const timers=new Map(),writes=[],uncertainty=[];
 const context={module:{exports:{}},TextEncoder,TextDecoder,Uint8Array,Buffer,Date,JSON,Number,Math,Error,Object,Array,String,Promise,
  setTimeout(fn,delay){const id=next++;timers.set(id,{fn,at:time+delay});return id;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(source,context,{filename:'original_radar.js'});
 const s=new context.module.exports.Session({now:()=>time,timeoutMs:50,setUnconfirmed:value=>uncertainty.push(value),rfPolicy:TEST_POLICY,...options});
 const m={s,writes,timers,uncertainty,respond:null,feed:r=>s.ingest(wire(r)),advance:async delta=>{time+=delta;for(const[id,t]of Array.from(timers)){if(t.at<=time){timers.delete(id);t.fn();}}await flush();}};
 m.writer=async bytes=>{const text=new TextDecoder().decode(bytes);writes.push(text);if(m.respond)await m.respond(text.trim(),m);};s.attach(m.writer);return m;
}
function auto(m,{running='running',stopState='idle'}={}){let state='idle';m.respond=(text)=>{const command=text.split(' ')[0];if(command==='start')state=running;if(command==='stop')state=stopState;m.feed(ack(command,{state,configured:command!=='orConfig'}));if(command==='status')m.feed(status({state}));};return m;}
async function confirmed(m){await m.s.status();return m;}
function observe(p){let settled=false;const done=p.then(x=>{settled=true;return x;},e=>{settled=true;throw e;});return{done,settled:()=>settled};}

test('Synthetic protocol records validate without adding inference or calibration',()=>{
 for(const r of [identity(),ack(),status(),frame(),frame({count:0,detected_count:0,detections:[]})])assert.equal(validate(r),r);
 const r=frame();assert.equal(r.detections[0].activity,null);assert.equal(r.detections[0].world_xyz_m,null);assert.equal(r.mount.antenna_height_m,null);assert.equal(r.mount.world_height_valid,false);
});
test('Decoder handles every possible two-chunk boundary and byte-at-a-time UTF-8',()=>{
 const expected=identity({version:'synthetic-界-🛰'}),bytes=wire(expected);for(let cut=0;cut<=bytes.length;cut++){const a=parse(new Uint8Array());a.d.push(bytes.subarray(0,cut));a.d.push(bytes.subarray(cut));a.d.finish();assert.deepEqual(a.records,[{record:expected,line:1}]);assert.deepEqual(a.issues,[]);}
 const a=parse(bytes,1);a.d.finish();assert.deepEqual(a.records,[{record:expected,line:1}]);assert.deepEqual(a.issues,[]);
});
test('Batched JSONL and CRLF preserve order and physical line numbers',()=>{
 const records=[identity(),ack('commit'),status(),frame()],bytes=Buffer.concat(records.map(r=>Buffer.from(wire(r,'\r\n'))));const a=parse(bytes,7);a.d.finish();assert.deepEqual(a.records.map(x=>x.record),records);assert.deepEqual(a.records.map(x=>x.line),[1,2,3,4]);assert.deepEqual(a.issues,[]);
});
test('Invalid JSON, foreign protocol, blank lines and unknown records recover at LF',()=>{
 const bad=['{','{}','{"type":"identity","protocol":"ti-tlv"}','','{"protocol":"original-radar-v1","type":"not-known"}'];const bytes=Buffer.from(bad.join('\n')+'\n'+JSON.stringify(status())+'\n');const a=parse(bytes,3);a.d.finish();assert.equal(a.issues.length,5);assert.deepEqual(a.issues.map(x=>x.line),[1,2,3,4,5]);assert.equal(a.records.length,1);assert.equal(a.records[0].line,6);
});
test('Malformed UTF-8 is rejected instead of replacement-decoded; next record survives',()=>{
 const bytes=Buffer.concat([Buffer.from('{"bad":"'),Buffer.from([0xc3,0x28]),Buffer.from('"}\n'),wire(identity())]);const a=parse(bytes,1);a.d.finish();assert.equal(a.issues.length,1);assert.equal(a.records.length,1);assert.equal(a.records[0].line,2);
});
test('Incomplete final JSON and split UTF-8 are flagged and never promoted to records',()=>{
 for(const bytes of [wire(frame()).subarray(0,-1),Uint8Array.of(0xe7,0x95)]){const a=parse(bytes,1);assert.equal(a.records.length,0);a.d.finish();assert.equal(a.issues.length,1);assert.match(a.issues[0].message,/Incomplete/);assert.equal(a.d.line.length,0);a.d.finish();assert.equal(a.issues.length,1);}
});
test('Overlong record is reported once, discarded through LF, and then recovers',()=>{
 const a=parse(Buffer.concat([Buffer.alloc(5000,65),Buffer.from('\n'),wire(status())]),1);a.d.finish();assert.equal(a.issues.length,1);assert.match(a.issues[0].message,/Overlong/);assert.equal(a.records.length,1);assert.equal(a.records[0].line,2);
 const b=parse(Buffer.alloc(5000,65),10);b.d.finish();assert.deepEqual(b.issues.map(x=>x.message),['Overlong JSONL record','Incomplete final JSONL record']);
});
test('Line-size cap is inclusive at 4096 bytes excluding LF',()=>{
 const r=identity({padding:''}),base=JSON.stringify(r).length;r.padding='x'.repeat(4096-base);assert.equal(wire(r).length,4097);const a=parse(wire(r));a.d.finish();assert.equal(a.records.length,1);assert.equal(a.issues.length,0);
 r.padding+='x';const b=parse(wire(r));b.d.finish();assert.equal(b.records.length,0);assert.equal(b.issues.length,1);
});
test('ACK/status invalid types, unsafe counters, states and malformed identity reject',()=>{
 for(const r of [ack('status',{command:null}),ack('status',{code:0.1}),ack('status',{state:'ready'}),ack('status',{configured:1}),status({fault:-1}),status({frames:Number.MAX_SAFE_INTEGER+1}),status({configured:null}),identity({baud:921600}),identity({version:2}),identity({classifier:true})])assert.throws(()=>validate(r));
});
test('Frames reject bad counts, missing/negative counters and incompatible truncation',()=>{
 for(const extra of [{sequence:-1},{timestamp_us:1.2},{complete:1},{capture_fault:-1},{missed_frames:null},{deadline_misses:NaN},{quality:-1},{count:4},{detected_count:0},{truncated:true},{detections:[]},{profile_energy:[1,2]},{profile_energy:[1,2,-1]}])assert.throws(()=>validate(frame(extra)),JSON.stringify(extra));
});
test('Detection shape rejects invented activity, nonfinite fields and invalid phasors',()=>{
 for(const extra of [{range_m:-1},{velocity_mps:Infinity},{power:-1},{spatial_flags:-1},{activity:'sitting'},{phasors:[[1,0]]},{phasors:[[1,0],[1,0],[1,0],[NaN,0]]},{sensor_xyz_m:[0,1]},{world_xyz_m:[0,Infinity,1]}])assert.throws(()=>validate(frame({detections:[detection(extra)]})),JSON.stringify(extra));
});
test('DSP count cannot exceed documented eight detections',()=>{assert.throws(()=>validate(frame({detected_count:9,truncated:true})),/frame|count|detection/i);});
test('Non-finite JSON numbers are rejected even in otherwise unknown diagnostic fields',()=>{
 const a=parse(Buffer.from(JSON.stringify(status()).replace(/}$/,',"extra":1e999}\n')));a.d.finish();assert.equal(a.records.length,0);assert.equal(a.issues.length,1);
});
test('Frame calibration and timing fields are required rather than silently discarded',()=>{
 for(const key of ['mount','range_bin_m','velocity_bin_mps','frame_events','processing_us','previous_tx_us']){const r=frame();delete r[key];assert.throws(()=>validate(r),'Missing '+key+' must reject');}
});

test('New session is disconnected, unknown, RF-paused and sends nothing',async()=>{
 const writes=[],s=new Session({write:b=>writes.push(b),now:()=>1000});assert.equal(s.rfEnabled,false);assert.equal(s.connected,false);assert.equal(s.state,'unknown');assert.equal(s.configured,false);await assert.rejects(s.start(),/RF tests paused/);await assert.rejects(s.command('status'),/Not connected/);assert.deepEqual(writes,[]);
});
test('Attach is passive and rejects duplicate attachment',()=>{const m=mock();assert.deepEqual(m.writes,[]);assert.equal(m.s.state,'unknown');assert.equal(m.s.rfEnabled,false);assert.throws(()=>m.s.attach(m.writer),/Already connected/);m.feed(identity());assert.equal(m.s.state,'unknown');assert.equal(m.s.identity.classifier,false);});
test('Commands use canonical first-token ACK matching and reject concurrent commands',async()=>{
 const m=mock(),p=observe(m.s.command('session 60'));await flush();assert.deepEqual(m.writes,['session 60\n']);await assert.rejects(m.s.command('commit'),/awaiting acknowledgement/);m.feed(ack('commit'));m.feed(ack('invalid'));await flush();assert.equal(p.settled(),false);assert.equal(m.s.events.filter(e=>e.type==='unmatched_ack').length,2);m.feed(ack('session'));const result=await p.done;assert.equal(result.ack.command,'session');assert.equal(m.timers.size,0);
});
test('Negative matching ACK rejects immediately and stops the command timer',async()=>{
 const m=mock(),p=m.s.command('commit'),rejected=assert.rejects(p,/Command rejected: commit \(-7\)/);await flush();m.feed(ack('commit',{code:-7}));await rejected;assert.equal(m.s.pending,null);assert.equal(m.timers.size,0);
});
for(const order of ['ack-first','status-first'])test('Status requires both successful ACK and status ('+order+')',async()=>{
 const m=mock({unconfirmed:true}),p=observe(m.s.status());await flush();m.feed(order==='ack-first'?ack():status());await flush();assert.equal(p.settled(),false);m.feed(order==='ack-first'?status():ack());const r=await p.done;assert.equal(r.state,'idle');assert.equal(m.s.unconfirmed,false);assert.equal(m.s.busy,false);assert.equal(m.timers.size,0);
});
test('Unrelated ACK, unsolicited idle status and identity never clear RF uncertainty',async()=>{
 const m=mock({unconfirmed:true});m.feed(identity());m.feed(status());m.feed(ack('stop'));assert.equal(m.s.unconfirmed,true);const p=m.s.status();await flush();m.feed(ack());m.feed(status());await p;assert.equal(m.s.unconfirmed,false);
});
test('Idle status cannot clear uncertainty before its successful matching ACK',async()=>{
 const m=mock({unconfirmed:true}),p=m.s.status(),rejected=assert.rejects(p,/rejected/);await flush();m.feed(status());const before=m.s.unconfirmed;m.feed(ack('status',{code:-1}));await rejected;assert.equal(before,true);assert.equal(m.s.unconfirmed,true);
});
test('Responses received before command dispatch cannot satisfy a fresh query',async()=>{
 const m=mock({unconfirmed:true}),p=observe(m.s.status());m.feed(status());m.feed(ack());await flush();const prematurelySettled=p.settled(),writesBeforeReply=m.writes.slice();if(!prematurelySettled){m.feed(status());m.feed(ack());}await p.done;assert.equal(prematurelySettled,false);assert.deepEqual(writesBeforeReply,['status\n']);
});
test('A frame between idle status and ACK prevents stale idle clearing uncertainty',async()=>{
 const m=mock({unconfirmed:true}),p=m.s.status(),rejected=assert.rejects(p,/State changed after status/);await flush();m.feed(status());m.feed(frame());m.feed(ack('status',{state:'running'}));await rejected;assert.equal(m.s.state,'running');assert.equal(m.s.unconfirmed,true);
});
test('Configure is serialized, acknowledged, non-RF and confirmed by final status',async()=>{
 const m=auto(mock());await confirmed(m);m.writes.length=0;await m.s.configure(5);assert.deepEqual(m.writes,['orConfig 1\n','profile room64_v1\n','mount 1219 0 unknown\n','detect 4 30 64 8\n','session 5\n','commit\n','status\n']);assert.equal(m.s.configured,true);assert.equal(m.s.seconds,5);assert.equal(m.s.state,'idle');assert.equal(m.s.unconfirmed,false);assert.equal(m.s.busy,false);assert.equal(m.s.events.some(e=>e.type==='configured'),true);assert.equal(m.writes.some(x=>x==='start\n'),false);
});
test('Configure accepts only finite integer durations 1 through 5',async()=>{
 const m=auto(mock());await confirmed(m);m.writes.length=0;for(const value of [0,6,600,601,1.5,NaN,Infinity,'5',null])await assert.rejects(m.s.configure(value),/integer/);assert.deepEqual(m.writes,[]);await m.s.status();await m.s.configure(1);await m.s.configure(5);
});
test('Configure refuses unknown/running/unconfirmed state without sending commands',async()=>{
 for(const extra of [{state:'unknown'},{state:'running'},{state:'idle',unconfirmed:true}]){const m=mock();Object.assign(m.s,extra);await assert.rejects(m.s.configure(5),/before Configure/);assert.deepEqual(m.writes,[]);}
});
test('Configure halts at rejection and never commits or starts',async()=>{
 const m=auto(mock());await confirmed(m);m.writes.length=0;m.respond=text=>m.feed(ack(text.split(' ')[0],{code:text.startsWith('mount')?-3:0}));await assert.rejects(m.s.configure(5),/rejected/);assert.deepEqual(m.writes,['orConfig 1\n','profile room64_v1\n','mount 1219 0 unknown\n']);assert.equal(m.s.busy,false);assert.equal(m.s.configured,false);
});
test('Configure does not succeed when committed status is false or faulted',async()=>{
 for(const bad of [{configured:false},{fault:2},{state:'running'}]){const m=auto(mock());await confirmed(m);m.respond=text=>{m.feed(ack(text.split(' ')[0],text==='status'?bad:{}));if(text==='status')m.feed(status(bad));};await assert.rejects(m.s.configure(5),bad.configured===false?/not confirmed/:/Configuration interrupted/);assert.equal(m.s.busy,false);assert.equal(m.s.events.some(e=>e.type==='configured'),false);}
});
test('Start remains paused by default even after successful configuration',async()=>{
 const m=auto(mock());await confirmed(m);await m.s.configure(5);m.writes.length=0;await assert.rejects(m.s.start(),/RF tests paused/);assert.deepEqual(m.writes,[]);assert.equal(m.s.epoch,0);
});
test('Mock-only start needs confirmed idle/configured and increments recording epoch',async()=>{
 const m=auto(mock({rfEnabled:true}));await assert.rejects(m.s.start(),/confirmed idle/);assert.deepEqual(m.writes,[]);await confirmed(m);await m.s.configure(5);m.s.lastSequence=91;m.writes.length=0;await m.s.start();assert.deepEqual(m.writes,['start\n','status\n']);assert.equal(m.s.state,'running');assert.equal(m.s.unconfirmed,true);assert.equal(m.s.epoch,1);assert.equal(m.s.lastSequence,null);assert.equal(m.s.busy,false);assert.equal(m.s.events.some(e=>e.type==='running_confirmed'),true);await assert.rejects(m.s.start(),/confirmed idle/);
});
test('Mock start rejection stays uncertain and does not issue another start',async()=>{
 const m=auto(mock({rfEnabled:true}));await confirmed(m);await m.s.configure(5);m.writes.length=0;m.respond=text=>m.feed(ack(text,{code:-2}));await assert.rejects(m.s.start(),/rejected/);assert.deepEqual(m.writes,['start\n']);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.busy,false);
});
test('Mock start fails unless status confirms running without faults',async()=>{
 const m=auto(mock({rfEnabled:true}),{running:'starting'});await confirmed(m);await m.s.configure(5);await assert.rejects(m.s.start(),/Running state and accepted self-test not confirmed/);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.events.some(e=>e.type==='running_confirmed'),false);
});
test('Stop verifies an idle status before reporting confirmation',async()=>{
 const m=auto(mock());m.s.state='running';m.s.unconfirmed=true;await m.s.stop();assert.deepEqual(m.writes,['stop\n','status\n']);assert.equal(m.s.state,'idle');assert.equal(m.s.unconfirmed,false);assert.equal(m.s.events.some(e=>e.type==='stopped_confirmed'),true);assert.equal(m.s.busy,false);
});
test('Rejected stop and running/fault status keep stop uncertain',async()=>{
 for(const bad of [{state:'running'},{state:'idle',fault:1}]){const m=mock();m.s.state='running';m.respond=text=>{m.feed(ack(text,text==='status'?bad:{}));if(text==='status')m.feed(status(bad));};await assert.rejects(m.s.stop(),/Idle not confirmed/);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.events.some(e=>e.type==='stopped_confirmed'),false);assert.equal(m.s.busy,false);}
 const m=mock();m.respond=text=>m.feed(ack(text,{code:-1}));await assert.rejects(m.s.stop(),/rejected/);assert.equal(m.s.unconfirmed,true);assert.deepEqual(m.writes,['stop\n']);
});
test('Busy controls reject repeated operations without sending extra commands',async()=>{
 const m=mock(),p=m.s.status(),rejected=assert.rejects(p,/Cancelled/);await flush();await assert.rejects(m.s.status(),/progress/);await assert.rejects(m.s.stop(),/Cancel/);await assert.rejects(m.s.configure(5),/before Configure/);assert.deepEqual(m.writes,['status\n']);m.s.cancel();await rejected;assert.equal(m.s.busy,false);assert.equal(m.s.desynced,true);
});
test('Timeout is deterministic, clears pending work, and gates unsafe commands',async()=>{
 const m=mock(),p=m.s.command('commit'),rejected=assert.rejects(p,/No matching acknowledged response/);await flush();await m.advance(49);assert.equal(m.s.pending.command,'commit');await m.advance(1);await rejected;assert.equal(m.s.pending,null);assert.equal(m.s.desynced,true);assert.equal(m.timers.size,0);await assert.rejects(m.s.command('orConfig 1'),/reconnect/);m.feed(ack('commit'));assert.equal(m.s.events.at(-1).type,'unmatched_ack');auto(m);await assert.rejects(m.s.status(),/desynchronized.*reconnect/);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.desynced,true);await assert.rejects(m.s.command('commit'),/reconnect/);
});
test('Mock start timeout remains uncertain through disconnect and fresh session state',async()=>{
 const m=auto(mock({rfEnabled:true}));await confirmed(m);await m.s.configure(5);m.respond=null;const p=m.s.start(),rejected=assert.rejects(p,/No matching/);await flush();await m.advance(50);await rejected;assert.equal(m.s.unconfirmed,true);m.s.detach('lost port');assert.equal(m.s.connected,false);assert.equal(m.s.state,'unknown');assert.equal(m.s.configured,false);m.s.attach(m.writer);assert.equal(m.s.desynced,false);assert.equal(m.s.unconfirmed,true);await assert.rejects(m.s.configure(5),/before Configure/);auto(m);await m.s.status();assert.equal(m.s.unconfirmed,false);
});
test('Cancellation rejects pending command, keeps RF uncertainty, and prevents continuation',async()=>{
 const m=auto(mock({rfEnabled:true}));await confirmed(m);await m.s.configure(5);m.writes.length=0;m.respond=null;const p=m.s.start(),rejected=assert.rejects(p,/Cancelled/);await flush();m.s.cancel();await rejected;assert.equal(m.s.unconfirmed,true);assert.equal(m.s.desynced,true);assert.equal(m.s.busy,false);assert.deepEqual(m.writes,['start\n']);assert.equal(m.timers.size,0);auto(m);await assert.rejects(m.s.stop(),/Idle not confirmed/);assert.equal(m.s.unconfirmed,true);m.s.detach();m.s.attach(m.writer);await m.s.status();assert.equal(m.s.unconfirmed,false);
});
test('Desynchronized idle replies never clear uncertainty until a new attachment is queried',async()=>{
 const m=mock({unconfirmed:true}),p=m.s.status(),rejected=assert.rejects(p,/No matching/);await flush();await m.advance(50);await rejected;auto(m);for(let i=0;i<2;i++){await assert.rejects(m.s.status(),/desynchronized.*reconnect/);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.desynced,true);}const before=m.writes.length;await assert.rejects(m.s.stop(),/Idle not confirmed/);assert.deepEqual(m.writes.slice(before),['stop\n','status\n']);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.events.some(e=>e.type==='stopped_confirmed'),false);m.s.detach('fresh transport required');m.s.attach(async bytes=>m.writer(bytes));assert.equal(m.s.unconfirmed,true);assert.equal(m.s.desynced,false);await m.s.status();assert.equal(m.s.unconfirmed,false);
});
test('Immediate cancellation prevents a not-yet-dispatched command from being written',async()=>{
 const m=mock(),p=m.s.command('commit'),rejected=assert.rejects(p,/Cancelled/);m.s.cancel();await rejected;await flush();assert.deepEqual(m.writes,[]);
});
test('Immediate detach/reconnect cannot redirect an old queued write to the new port',async()=>{
 const m=mock(),newWrites=[],p=m.s.command('commit'),rejected=assert.rejects(p,/lost port/);m.s.detach('lost port');m.s.attach(async bytes=>newWrites.push(new TextDecoder().decode(bytes)));await rejected;await flush();assert.deepEqual(m.writes,[]);assert.deepEqual(newWrites,[]);
});
test('Cancellation just after the final configure ACK does not report configured success',async()=>{
 const m=auto(mock());await confirmed(m);m.writes.length=0;m.respond=text=>{m.feed(ack(text.split(' ')[0]));if(text==='commit')m.s.cancel();if(text==='status')m.feed(status());};await assert.rejects(m.s.configure(5),/Cancelled|cancelled/);assert.equal(m.writes.includes('status\n'),false);assert.equal(m.s.events.some(e=>e.type==='configured'),false);
});
test('Cancellation just after mock start ACK does not continue or report running success',async()=>{
 const m=auto(mock({rfEnabled:true}));await confirmed(m);await m.s.configure(5);m.writes.length=0;m.respond=text=>{m.feed(ack(text,{state:'running'}));if(text==='start')m.s.cancel();if(text==='status')m.feed(status({state:'running'}));};await assert.rejects(m.s.start(),/Cancelled|cancelled/);assert.deepEqual(m.writes,['start\n']);assert.equal(m.s.events.some(e=>e.type==='running_confirmed'),false);assert.equal(m.s.unconfirmed,true);
});
test('Cancellation just after stop ACK does not report stopped success',async()=>{
 const m=mock();m.s.state='running';m.respond=text=>{m.feed(ack(text));if(text==='stop')m.s.cancel();if(text==='status')m.feed(status());};await assert.rejects(m.s.stop(),/Cancelled|cancelled/);assert.deepEqual(m.writes,['stop\n']);assert.equal(m.s.events.some(e=>e.type==='stopped_confirmed'),false);assert.equal(m.s.unconfirmed,true);
});
test('Write rejection clears pending/timer and releases busy status',async()=>{
 const m=mock();m.respond=()=>{throw Error('synthetic write failure');};await assert.rejects(m.s.status(),/synthetic write failure/);assert.equal(m.s.pending,null);assert.equal(m.s.busy,false);assert.equal(m.timers.size,0);assert.equal(m.s.desynced,true);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.snapshot().stop_unconfirmed,true);
});
test('Dispatched stop write rejection preserves stop uncertainty and requires reconnect',async()=>{
 const m=mock();m.s.state='running';m.respond=()=>{throw Error('synthetic stop write failure');};await assert.rejects(m.s.stop(),/synthetic stop write failure/);assert.deepEqual(m.writes,['stop\n']);assert.equal(m.s.desynced,true);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.pending,null);assert.equal(m.timers.size,0);assert.equal(m.s.events.some(e=>e.type==='stopped_confirmed'),false);auto(m);await assert.rejects(m.s.status(),/desynchronized.*reconnect/);assert.equal(m.s.unconfirmed,true);
});
test('Dispatched configure write rejection halts later writes and marks the stream uncertain',async()=>{
 const m=auto(mock());await confirmed(m);m.writes.length=0;m.respond=text=>{if(text.startsWith('mount'))throw Error('synthetic partial write failure');m.feed(ack(text.split(' ')[0]));};await assert.rejects(m.s.configure(5),/synthetic partial write failure/);assert.deepEqual(m.writes,['orConfig 1\n','profile room64_v1\n','mount 1219 0 unknown\n']);assert.equal(m.s.desynced,true);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.events.some(e=>e.type==='configured'),false);
});
test('Detach flushes a partial record and rejects pending work while preserving capture',async()=>{
 const m=mock({unconfirmed:true});m.s.ingest(Buffer.from('{partial'));const p=m.s.status(),rejected=assert.rejects(p,/serial lost/);await flush();m.s.detach('serial lost');await rejected;assert.equal(m.s.bytes,8);assert.equal(m.s.rawBytes().length,8);assert.equal(m.s.issues.some(i=>/Incomplete/.test(i.message)),true);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.pending,null);assert.equal(m.s.state,'unknown');assert.equal(m.timers.size,0);
});

test('Frame arrival retains unknowns and faults/truncation/gaps rather than labeling',()=>{
 const m=mock();m.feed(frame());m.feed(frame({sequence:2,complete:false,capture_fault:3,missed_frames:1,deadline_misses:2,detected_count:4,truncated:true}));assert.equal(m.s.frames,2);assert.equal(m.s.state,'running');assert.equal(m.s.unconfirmed,true);assert.equal(m.s.lastFrame.detections[0].activity,null);assert.equal(m.s.lastFrame.detections[0].world_xyz_m,null);assert.equal(m.s.issues.length,3);assert.equal(m.s.issues.some(i=>/acquisition/.test(i.message)),true);assert.equal(m.s.issues.some(i=>/truncated/.test(i.message)),true);assert.equal(m.s.issues.some(i=>/Sequence/.test(i.message)),true);
});
test('Raw capture copies input and rawBytes output and keeps malformed/partial bytes',()=>{
 const m=mock(),bytes=Buffer.concat([wire(identity()),Buffer.from('not-json\n'),wire(frame()),Buffer.from('{partial')]),original=Buffer.from(bytes);m.s.ingest(bytes);bytes.fill(0);const exported=m.s.rawBytes();assert.deepEqual(Buffer.from(exported),original);exported.fill(9);assert.deepEqual(Buffer.from(m.s.rawBytes()),original);assert.equal(m.s.frames,1);assert.equal(m.s.issues.length,1);assert.equal(m.s.snapshot().buffered_bytes,8);
});
test('Snapshot is isolated and exports exact base64 raw bytes with explicit limitations',()=>{
 const m=mock({rfPolicy:null}),bytes=Buffer.concat([wire(identity()),wire(frame()),Buffer.from([0,255,0])]);m.s.ingest(bytes);m.s.annotate('activity','sitting');const a=m.s.snapshot();assert.equal(a.schema,'original-radar-capture');assert.equal(a.version,1);assert.equal(a.protocol,PROTOCOL);assert.equal(a.raw_encoding,'base64');assert.deepEqual(Buffer.from(a.raw_jsonl_bytes,'base64'),bytes);assert.equal(a.raw_byte_count,bytes.length);assert.deepEqual(clone(a.serial),{baud:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});assert.equal(a.limits.rf_tests_paused,true);assert.equal(a.limits.activity_inference,false);assert.equal(a.limits.people_count_inference,false);assert.match(a.limits.host_clock,/unsynchronized/);assert.match(a.limits.license_status,/not granted/);a.identity.version='mutated';a.annotations[0].label='walking';a.events[0].type='changed';a.limits.rf_tests_paused=false;const b=m.s.snapshot();assert.equal(b.identity.version,'0.2.0');assert.equal(b.annotations[0].label,'sitting');assert.equal(b.events[0].type,'connected');assert.equal(b.limits.rf_tests_paused,true);assert.equal(m.s.connected,true);
});
test('One-byte chunks reconstruct exactly across a fixed 64-KiB raw block boundary',()=>{
 const length=65536+17,expected=Uint8Array.from({length},(_,i)=>i%256),input=new Uint8Array(1),s=new Session({now:()=>1000});for(let i=0;i<expected.length;i++){input[0]=expected[i];s.ingest(input);}input[0]=123;assert.equal(s.bytes,length);assert.equal(s.raw.length,2);assert.deepEqual(s.raw.map(block=>block.length),[65536,65536]);assert.deepEqual(Buffer.from(s.rawBytes()),Buffer.from(expected));const out=s.snapshot();assert.equal(out.raw_byte_count,length);assert.deepEqual(Buffer.from(out.raw_jsonl_bytes,'base64'),Buffer.from(expected));assert.equal(out.unsaved_byte_count,0);assert.equal(out.capture_overflow,false);const returned=s.rawBytes();returned.fill(0);assert.deepEqual(Buffer.from(s.rawBytes()),Buffer.from(expected));
});
test('Large chunks crossing multiple raw blocks have no padding or omitted bytes',()=>{
 const s=new Session({now:()=>1000}),bytes=Uint8Array.from({length:2*65536+31},(_,i)=>(i*17+3)%256);s.ingest(bytes.subarray(0,65535));s.ingest(bytes.subarray(65535));assert.equal(s.raw.length,3);assert.equal(s.rawBytes().length,bytes.length);assert.deepEqual(Buffer.from(s.rawBytes()),Buffer.from(bytes));assert.deepEqual(Buffer.from(s.snapshot().raw_jsonl_bytes,'base64'),Buffer.from(bytes));
});
test('Issue/event histories cap at 2048 with exact dropped counts in export',async()=>{
 const m=auto(mock());for(let i=0;i<2060;i++){m.s.issue('synthetic issue',{index:i});m.s.event('synthetic_event',{index:i});}assert.equal(m.s.issues.length,2048);assert.equal(m.s.events.length,2048);assert.equal(m.s.droppedIssues,12);assert.equal(m.s.droppedEvents,13);assert.equal(m.s.issues[0].index,0);assert.equal(m.s.issues.at(-1).index,2047);assert.equal(m.s.events[0].type,'connected');assert.equal(m.s.events.at(-1).index,2046);let out=m.s.snapshot();assert.equal(out.dropped_issue_count,12);assert.equal(out.dropped_event_count,13);assert.equal(out.issues.length,2048);assert.equal(out.events.length,2048);assert.equal(out.capture_overflow,false);await m.s.status();assert.equal(m.s.state,'idle');assert.equal(m.s.unconfirmed,false);out=m.s.snapshot();assert.equal(out.dropped_event_count,14);assert.equal(out.dropped_issue_count,12);assert.equal(out.events.length,2048);out.events[0].type='edited';out.issues[0].message='edited';assert.equal(m.s.events[0].type,'connected');assert.equal(m.s.issues[0].message,'synthetic issue');
});
test('Malformed input flood keeps exact raw bytes while bounding diagnostics',()=>{
 const bytes=Buffer.from('not-json\n'.repeat(2061)),m=mock();m.s.ingest(bytes);assert.equal(m.s.issues.length,2048);assert.equal(m.s.droppedIssues,13);assert.deepEqual(Buffer.from(m.s.rawBytes()),bytes);const out=m.s.snapshot();assert.equal(out.dropped_issue_count,13);assert.equal(out.buffered_bytes,0);assert.equal(out.issues.length,2048);assert.equal(out.raw_byte_count,bytes.length);
});
test('Memory cap accepts exact boundary and rejects an oversized chunk atomically',()=>{
 const m=mock({maxBytes:4});m.s.ingest(Uint8Array.of(1,2));m.s.ingest(Uint8Array.of(3,4));assert.equal(m.s.bytes,4);m.s.ingest(Uint8Array.of(5));assert.equal(m.s.bytes,4);assert.equal(m.s.overflow,true);assert.equal(m.s.cancelled,true);assert.equal(m.s.unconfirmed,true);assert.equal(m.s.issues.length,1);assert.deepEqual(Array.from(m.s.rawBytes()),[1,2,3,4]);m.s.ingest(Uint8Array.of(6));assert.equal(m.s.issues.length,1);
});
test('Once overflowed, smaller later chunks cannot silently resume capture',()=>{
 const m=mock({maxBytes:4});m.s.ingest(Uint8Array.of(1,2));m.s.ingest(Uint8Array.of(3,4,5));assert.equal(m.s.overflow,true);m.s.ingest(Uint8Array.of(6));assert.deepEqual(Array.from(m.s.rawBytes()),[1,2]);assert.equal(m.s.bytes,2);
});
test('Overflow retains control parsing so a safety stop can still receive confirmation',async()=>{
 const initial=wire(identity()),overflowFrame=wire(frame()),m=auto(mock({maxBytes:initial.length}));m.s.ingest(initial);m.s.ingest(overflowFrame);assert.equal(m.s.overflow,true);assert.equal(m.s.state,'running');assert.equal(m.s.frames,1);const before=Buffer.from(m.s.rawBytes());await m.s.stop();assert.deepEqual(m.writes,['stop\n','status\n']);assert.equal(m.s.state,'idle');assert.equal(m.s.unconfirmed,false);assert.equal(m.s.events.some(e=>e.type==='stopped_confirmed'),true);assert.deepEqual(Buffer.from(m.s.rawBytes()),before);const dropped=overflowFrame.length+wire(ack('stop')).length+wire(ack('status')).length+wire(status()).length;assert.equal(m.s.unsavedBytes,dropped);const out=m.s.snapshot();assert.equal(out.unsaved_byte_count,dropped);assert.equal(out.capture_overflow,true);assert.equal(out.raw_byte_count,initial.length);assert.deepEqual(Buffer.from(out.raw_jsonl_bytes,'base64'),Buffer.from(initial));
});
test('Every post-cap dropped byte is counted while raw saving stays permanently latched off',()=>{
 const m=mock({maxBytes:4});m.s.ingest(Uint8Array.of(1,2));m.s.ingest(Uint8Array.of(3,4,5));m.s.ingest(Uint8Array.of(6));m.s.ingest(Uint8Array.of(7,8));assert.equal(m.s.unsavedBytes,6);assert.equal(m.s.snapshot().unsaved_byte_count,6);assert.deepEqual(Array.from(m.s.rawBytes()),[1,2]);assert.equal(m.s.decoder.line.length,8);
});
test('Export reports partial JSONL without flushing or mutating the live decoder',()=>{
 const m=mock(),bytes=wire(frame()),cut=bytes.length-7;m.s.ingest(bytes.subarray(0,cut));const buffered=Array.from(m.s.decoder.line),liveIssues=m.s.issues.length;for(let i=0;i<2;i++){const out=m.s.snapshot();assert.equal(out.issues.filter(x=>/Incomplete final JSONL record at export/.test(x.message)).length,1);assert.equal(out.buffered_bytes,cut);assert.deepEqual(Array.from(m.s.decoder.line),buffered);assert.equal(m.s.issues.length,liveIssues);assert.equal(m.s.frames,0);}m.s.ingest(bytes.subarray(cut));assert.equal(m.s.frames,1);assert.equal(m.s.decoder.line.length,0);assert.equal(m.s.snapshot().issues.some(x=>/Incomplete final JSONL/.test(x.message)),false);assert.deepEqual(Buffer.from(m.s.rawBytes()),Buffer.from(bytes));
});
test('Export marks an overlong unfinished record even with an empty discard buffer',()=>{
 const m=mock();m.s.ingest(Buffer.alloc(5000,65));assert.equal(m.s.decoder.discard,true);assert.equal(m.s.decoder.line.length,0);const before=m.s.issues.length;assert.equal(m.s.snapshot().issues.some(x=>/Incomplete final JSONL record at export/.test(x.message)),true);assert.equal(m.s.issues.length,before);assert.equal(m.s.decoder.discard,true);m.s.ingest(wire(status()));assert.equal(m.s.decoder.discard,false);assert.equal(m.s.snapshot().issues.some(x=>/Incomplete final JSONL record at export/.test(x.message)),false);
});
test('Connection events locate preserved raw boundaries and reset sequence continuity',()=>{
 const m=mock(),first=Buffer.concat([wire(frame({sequence:42})),Buffer.from('{partial')]);m.s.ingest(first);m.s.detach('synthetic reconnect');m.s.attach(m.writer);assert.equal(m.s.lastSequence,null);assert.equal(m.s.lastFrame,null);const second=wire(frame({sequence:0,timestamp_us:200}));m.s.ingest(second);const out=m.s.snapshot(),connections=out.events.filter(e=>e.type==='connected'),disconnected=out.events.find(e=>e.type==='disconnected');assert.deepEqual(clone(connections.map(e=>[e.connection_epoch,e.raw_byte_offset])),[[1,0],[2,first.length]]);assert.equal(disconnected.connection_epoch,1);assert.equal(disconnected.raw_byte_offset,first.length);for(const e of out.events){assert.ok(Number.isInteger(e.raw_byte_offset));assert.ok(Number.isInteger(e.connection_epoch));}assert.equal(out.issues.some(i=>/Sequence gap/.test(i.message)),false);assert.deepEqual(Buffer.from(m.s.rawBytes()),Buffer.concat([first,second]));assert.deepEqual(Buffer.from(out.raw_jsonl_bytes,'base64'),Buffer.concat([first,second]));
});
test('Annotations require connected running data and never overwrite raw records',()=>{
 const m=mock();assert.throws(()=>m.s.annotate('activity','sitting'),/receiving run/);m.feed(frame());const before=Buffer.from(m.s.rawBytes());for(const label of ['sitting','standing','walking','unknown'])m.s.annotate('activity',label);assert.deepEqual(clone(m.s.annotations.map(a=>a.label)),['sitting','standing','walking','unknown']);for(const a of m.s.annotations){assert.equal(a.source,'human-observed');assert.equal(a.review_status,'unreviewed');assert.equal(a.observer_latency_ms,null);assert.equal(a.sensor_timestamp_us,1234000);assert.equal(a.sequence,0);assert.equal(a.host_utc_ms,1000);}assert.equal(m.s.lastFrame.detections[0].activity,null);assert.deepEqual(Buffer.from(m.s.rawBytes()),before);assert.throws(()=>m.s.annotate('invented','sitting'),/Unsupported/);assert.throws(()=>m.s.annotate('activity','running'),/Unsupported/);m.s.detach();assert.throws(()=>m.s.annotate('activity','sitting'),/receiving run/);
});
test('New-epoch annotations cannot inherit the previous run sensor timestamp or sequence',async()=>{
 const m=auto(mock({rfEnabled:true}));await confirmed(m);await m.s.configure(5);await m.s.start();m.feed(frame({sequence:42,timestamp_us:9876543}));await m.s.stop();await m.s.start();m.s.annotate('activity','standing');const a=m.s.annotations.at(-1);assert.equal(a.epoch,2);assert.equal(a.sensor_timestamp_us,null);assert.equal(a.sequence,null);assert.equal(m.s.lastFrame,null);
});
test('Transitions are paired by label and reject overlaps/mismatched endings',()=>{
 const m=mock();m.feed(frame());assert.throws(()=>m.s.annotate('transition_end','sit-to-stand'),/No matching/);m.s.annotate('transition_start','sit-to-stand');assert.throws(()=>m.s.annotate('transition_start','movement-onset'),/End the open/);assert.throws(()=>m.s.annotate('transition_end','movement-onset'),/No matching/);m.feed(frame({sequence:1,timestamp_us:1400000}));m.s.annotate('transition_end','sit-to-stand');assert.equal(m.s.openTransition,null);assert.equal(m.s.annotations.length,2);assert.equal(m.s.annotations[1].sensor_timestamp_us,1400000);assert.equal(m.s.annotations[1].sequence,1);assert.equal(m.s.annotations[1].source,'human-observed');
});
test('Stop, disconnect and observed idle close open transitions as incomplete system events',async()=>{
 for(const action of ['stop','detach','idle']){const m=auto(mock());m.feed(frame());m.s.annotate('transition_start','movement-onset');if(action==='stop')await m.s.stop();else if(action==='detach')m.s.detach('synthetic cable loss');else m.feed(status());assert.equal(m.s.openTransition,null);assert.equal(m.s.annotations.length,2);const end=m.s.annotations[1];assert.equal(end.kind,'transition_end');assert.equal(end.label,'movement-onset');assert.equal(end.source,'system');assert.equal(end.review_status,'unreviewed');assert.equal(end.incomplete,true);assert.ok(end.reason);assert.equal(end.epoch,m.s.annotations[0].epoch);}
});
test('Overflow blocks further annotation and mock RF restart',async()=>{
 const m=mock({maxBytes:1,rfEnabled:true});m.s.state='running';m.s.ingest(Uint8Array.of(1,2));assert.throws(()=>m.s.annotate('activity','walking'),/receiving run/);m.s.state='idle';m.s.unconfirmed=false;m.s.configured=true;await assert.rejects(m.s.start(),/complete capture/);assert.deepEqual(m.writes,[]);
});
test('Browser global export works with no CommonJS, Buffer, network or serial APIs',()=>{
 const c={TextEncoder,TextDecoder,Uint8Array,btoa:s=>Buffer.from(s,'binary').toString('base64'),setTimeout,clearTimeout};vm.runInNewContext(source,c);assert.equal(typeof c.OriginalRadar.Session,'function');const s=new c.OriginalRadar.Session({now:()=>1000});s.ingest(Uint8Array.of(0,255,2));assert.equal(s.snapshot().raw_jsonl_bytes,'AP8C');assert.equal(s.rfEnabled,false);
});

(async()=>{let failed=0;for(const{name,run}of tests){try{await run();console.log('PASS '+name);}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(`${tests.length-failed}/${tests.length} original radar tests passed (synthetic fixtures and mock transport only; no hardware or RF verification).`);if(failed)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
