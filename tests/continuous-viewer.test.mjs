import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={module:{exports:{}},TextEncoder,TextDecoder,Uint8Array,Buffer,setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync(new URL('../original_dual.js',import.meta.url),'utf8'),context);
const {Session,ByteWindow}=context.module.exports;
const policy={approved:true,firmwareVersion:'0.3.1-rc1',buildId:'old-test-build',selftestVersion:2,maxSeconds:5,continuous:{approved:true,firmwareVersion:'0.3.2-rc1',buildId:'continuous-test-build',leaseMs:5000,heartbeatMs:1000}};
const nonce='a'.repeat(32),common={protocol:'original-radar-v2',channel:'control',dual_uart:true,control_baud:115200,data_baud:921600};
const mount={bracket_top_mm:1219,down_tilt_mdeg:0,antenna_offset_mm:null,confirmed:true};
const encoded=r=>new TextEncoder().encode(JSON.stringify(r)+'\n');
const plain=x=>JSON.parse(JSON.stringify(x));
async function mock({old=false,timeoutMs=100}={}){
 let clock=1800000000000,mode='bounded',seconds=5,state='idle',paired=false,hold=false,reject=false;
 const writes=[],status=()=>({...common,type:'status',state,configured:true,fault:0,frames:0,firmware_version:old?policy.firmwareVersion:policy.continuous.firmwareVersion,build_id:old?policy.buildId:policy.continuous.buildId,selftest_version:2,selftest_ok:true,selftest_mask:0,capture_fault:0,rf_fault:0,rf_error:0,deadline_misses:0,control_tx_fault:false,data_tx_fault:false,paired,pair_nonce:paired?nonce:'',config_generation:1,session_id:1,session_mode:mode,session_seconds:seconds,keepalive_lease_ms:seconds===0?5000:0});
 const ack=(command,extra={})=>({...common,type:'ack',command,state,configured:true,code:0,...extra});
 const s=new Session({rfPolicy:policy,rfEnabled:true,timeoutMs,now:()=>clock});
 s.attach(async bytes=>{const text=new TextDecoder().decode(bytes).trim(),[command,arg]=text.split(' ');writes.push(text);
  if(command==='session'){mode=arg==='continuous'?'continuous':'bounded';seconds=arg==='continuous'?0:Number(arg);}
  if(command==='pair')s.ingestData(encoded({...status(),type:'data_probe',channel:'data',pair_nonce:nonce}));
  if(command==='pairConfirm')paired=true;
  if(command==='start')state='running';
  if(command==='stop'){state='idle';paired=false;}
  if(command==='status')s.ingest(encoded(status()));
  if(command==='keepalive'){if(hold)return;s.ingest(encoded(ack(command,{code:reject?-34:0,pair_nonce:nonce,config_generation:1,session_id:1,keepalive_tick_ms:clock%4294967296})));return;}
  s.ingest(encoded(ack(command)));
 });s.attachData();await s.status();
 const frame=(sequence,extra={})=>({protocol:'original-radar-v2',type:'frame',channel:'data',pair_nonce:nonce,config_generation:1,session_id:1,sequence,timestamp_us:(sequence+1)*200000,complete:true,missed_frames:0,capture_fault:0,quality:44,frame_events:sequence+1,processing_us:19000,previous_tx_us:16000,deadline_misses:0,mount:{bracket_top_m:1.219,down_tilt_deg:0,antenna_offset_m:null,antenna_height_m:null,world_height_valid:false},range_bin_m:.1953,velocity_bin_mps:.30811,profile_energy:[1,1,1],detected_count:0,count:0,truncated:false,detections:[],session_mode:mode,session_seconds:seconds,keepalive_lease_ms:seconds===0?5000:0,timestamp_basis:'session_elapsed',...extra});
 return {s,writes,status,ack,frame,advance(ms){clock+=ms;},hold(value=true){hold=value;},reject(){reject=true;},async start(){await s.configure(0,mount);await s.pair(nonce);await s.start();}};
}
test('byte window retains exact suffix and global offsets with oversized and fragmented chunks',()=>{
 const w=new ByteWindow(5);w.push(Uint8Array.of(1,2,3));w.push(Uint8Array.of(4,5,6,7,8,9));assert.deepEqual([...w.bytes()],[5,6,7,8,9]);assert.equal(w.start,4);assert.equal(w.end,9);assert.equal(w.length,5);
});
test('old firmware cannot configure continuous and sends no such command',async()=>{
 const m=await mock({old:true});await assert.rejects(m.s.configure(0,mount),/0.3.2-rc1/);assert(!m.writes.includes('session continuous'));
});
test('continuous configuration and paired Start use exact mode and accepted build',async()=>{
 const m=await mock();await m.start();assert(m.writes.includes('session continuous'));assert.equal(m.s.state,'running');assert.equal(m.s.seconds,0);await m.s.heartbeat();assert.equal(m.writes.at(-1),'keepalive '+nonce+' 1 1');await m.s.stop();assert.equal(m.s.state,'idle');assert.equal(m.s.unconfirmed,false);
});
test('100-minute synthetic run crosses 32-bit microseconds and storage cap without duration Stop',async()=>{
 const m=await mock();await m.start();for(let i=0;i<30000;i++){m.advance(200);m.s.ingestData(encoded(m.frame(i)));if(i%5===0)await m.s.heartbeat();m.s.checkDataFreshness();}
 assert.equal(m.s.frames,30000);assert.equal(m.s.transportFault,false);assert.equal(m.s.overflow,false);assert.equal(m.s.state,'running');assert(!m.writes.includes('stop'));
 const snap=m.s.snapshot(),lane=snap.raw_streams.data,raw=Buffer.from(lane.raw_jsonl_bytes,'base64');
 assert.equal(snap.schema,'original-radar-monitor-window');assert.equal(snap.complete_recording,false);assert(lane.evicted_byte_count>0);assert(raw.length<=4*1024*1024);assert.equal(raw.length,lane.global_byte_end-lane.global_byte_start);assert(snap.accepted_data_frames.length<=256);
 for(const admitted of snap.accepted_data_frames){const slice=raw.subarray(admitted.raw_byte_start-lane.global_byte_start,admitted.raw_byte_end-lane.global_byte_start);assert.deepEqual(JSON.parse(slice.toString()),plain(admitted.frame));}
 assert.equal(snap.accepted_data_frames.at(-1).frame.sequence,29999);assert(m.s.lastFrame.timestamp_us>2**32);await m.s.stop();assert.equal(m.s.unconfirmed,false);
});
test('Stop takes priority over an outstanding pulse and late pulse ACK cannot revive the run',async()=>{
 const m=await mock();await m.start();m.hold();const pulse=m.s.heartbeat();await Promise.resolve();assert.equal(m.s.pending.command,'keepalive');await m.s.stop();await pulse;assert.equal(m.s.unconfirmed,false);m.s.ingest(encoded(m.ack('keepalive',{state:'running',pair_nonce:nonce,config_generation:1,session_id:1})));assert.equal(m.s.state,'idle');assert.equal(m.s.unconfirmed,false);const n=m.writes.length;m.advance(2000);await m.s.heartbeat();assert.equal(m.writes.length,n);
});
test('negative or missing keepalive ACK invalidates the run without restart',async()=>{
 for(const missing of [false,true]){const m=await mock({timeoutMs:10});await m.start();if(missing)m.hold();else m.reject();await m.s.heartbeat();assert.equal(m.s.transportFault,true);assert.equal(m.s.activeStream,null);assert.equal(m.s.unconfirmed,true);assert.equal(m.writes.filter(x=>x==='start').length,1);}
});
test('continuous mode, sequence, timestamp, tuple and acquisition faults revoke the active stream',async()=>{
 for(const bad of [{session_mode:'bounded'},{session_seconds:5},{keepalive_lease_ms:0},{timestamp_basis:'uptime32'},{sequence:4},{timestamp_us:0},{pair_nonce:'b'.repeat(32)},{capture_fault:1}]){const m=await mock();await m.start();m.advance(200);m.s.ingestData(encoded(m.frame(0)));m.advance(200);m.s.ingestData(encoded(m.frame(1,bad)));assert.equal(m.s.transportFault,true,JSON.stringify(bad));assert.equal(m.s.activeStream,null);}
});
test('stale data and lost data connection stop acceptance independently of window eviction',async()=>{
 for(const loss of ['silence','disconnect']){const m=await mock();await m.start();m.s.ingestData(encoded(m.frame(0)));if(loss==='silence'){m.advance(1001);m.s.checkDataFreshness();}else m.s.detachData();assert.equal(m.s.activeStream,null);assert.equal(m.s.unconfirmed,true);}
});
