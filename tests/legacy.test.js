'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../radar_protocol.js');
const fixtures=JSON.parse(fs.readFileSync(__dirname+'/legacy-fixtures.json')).fixtures;
const bytes=name=>Uint8Array.from(fixtures[name]);
const cat=(...parts)=>Uint8Array.from(parts.flatMap(v=>Array.from(v)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
let count=0;function test(name,run){run();count++;console.log('PASS '+name);}
function mutate(name,offset,value,method='setUint32'){const b=bytes(name);new DataView(b.buffer)[method](offset,value,true);return b;}

test('Explicit immutable framing profiles retain different header sizes/offsets',()=>{
 for(const [name,size]of [['people',40],['area',44],['doors',44],['level',36],['cpd',48]]){assert(P.SUPPORTED_PROFILES.includes(name));assert.equal(P.PROFILE_FRAMING[name].headerBytes,size);assert(Object.isFrozen(P.PROFILE_FRAMING[name]));}
 assert.equal(P.PROFILE_FRAMING.area.staticPointsOffset,40);assert.equal(P.PROFILE_FRAMING.level.subFrameOffset,null);
 assert(Object.isFrozen(P.PROFILE_FRAMING));for(const id of ['unknown','__proto__','constructor'])assert.throws(()=>new P.StreamDecoder(id),/Unsupported/);
});
test('Area header separates dynamic/static counts and preserves CPU counter',()=>{
 const f=P.parseFrame(bytes('area_full'),'area');assert.equal(f.profile,'area');assert.equal(f.headerBytes,44);assert.equal(f.frameNumber,73);assert.equal(f.subFrame,2);assert.equal(f.timeCpuCycles,123456);assert.equal(f.declaredPoints,2);assert.equal(f.declaredStaticPoints,2);assert.equal(f.points.length,4);assert.deepEqual(f.warnings,[]);assert.deepEqual(f.unknownTlvs,[7000]);
});
test('Area dynamic TLV1 is spherical; static TLV8 is Cartesian with independent signed side info',()=>{
 const f=P.parseFrame(bytes('area_full'),'area'),moving=f.points.filter(p=>p.static===false),fixed=f.points.filter(p=>p.static===true);
 assert.deepEqual(fixed[0],{x:1,y:-2,z:3,doppler:0,static:true,snr:18,noise:-1});assert.equal(fixed[1].snr,19);
 near(moving[0].x,0);near(moving[0].y,5);near(moving[0].z,0);assert.equal(moving[0].doppler,-1.25);near(moving[0].snr,12.5);assert.equal(moving[0].noise,4);
 near(moving[1].x,Math.sqrt(3));near(moving[1].y,0);near(moving[1].z,1);near(moving[1].snr,-2.5);
});
test('40-byte legacy target layout reorders z, velocity, and acceleration exactly',()=>{
 const f=P.parseFrame(bytes('area_full'),'area');assert.deepEqual(f.tracks,[{id:42,x:1,y:2,vx:3,vy:4,ax:5,ay:6,z:7,vz:8,az:9}]);assert.deepEqual(f.trackIndexes,[42,255]);assert.equal(f.points[0].trackId,undefined);
});
test('Doors deliberately shares area wire layout, while preserving chosen profile',()=>{
 const a=P.parseFrame(bytes('area_full'),'area'),d=P.parseFrame(bytes('doors_full'),'doors');assert.deepEqual(d.points,a.points);assert.deepEqual(d.tracks,a.tracks);assert.equal(d.profile,'doors');assert.equal(d.frameNumber,91);assert.equal(P.parseFrame(bytes('area_full'),'doors').profile,'doors');
});
test('Empty/suppressed/static-only/track-only area packets remain valid',()=>{
 for(const name of ['area_empty','area_suppressed_clouds'])assert.deepEqual(P.parseFrame(bytes(name),'area').points,[]);
 const f=P.parseFrame(bytes('area_static_only'),'area');assert.equal(f.declaredPoints,0);assert.equal(f.points.length,1);assert.equal(f.points[0].static,true);assert.equal(f.points[0].snr,20);assert.equal(P.parseFrame(bytes('area_track_only'),'area').tracks.length,1);
});
test('Malformed area record sizes, header counts, and duplicates are rejected',()=>{
 for(const name of ['area_bad_track_size','area_bad_static_size','area_bad_side_size','area_bad_dynamic_count','area_bad_static_count','area_bad_side_count','area_duplicate_cloud'])assert.throws(()=>P.parseFrame(bytes(name),'area'),/record size|count|Duplicate/);
});
test('Non-finite static coordinates and all track motion fields are rejected',()=>{
 assert.throws(()=>P.parseFrame(mutate('area_static_only',52,Infinity,'setFloat32'),'area'),/Non-finite/);
 for(const off of [56,60,64,68,72,76,80,84,88])assert.throws(()=>P.parseFrame(mutate('area_track_only',off,NaN,'setFloat32'),'area'),/Non-finite/);
});
test('Level descriptor reconstructs all three signed Q20 ranges from split words',()=>{
 const f=P.parseFrame(bytes('level_full'),'level');assert.equal(f.profile,'level');assert.equal(f.headerBytes,36);assert.equal(f.subFrame,null);assert.equal(f.frameNumber,0);assert.equal(f.timeCpuCycles,123456);assert.equal(f.declaredPoints,1);assert.deepEqual(f.points,[]);assert.deepEqual(f.tracks,[]);assert.deepEqual(f.level,{qFormat:20,rangesMeters:[1572880/1048576,-2359296/1048576,3211265/1048576]});assert.deepEqual(f.warnings,[]);
});
test('Q20 signed limits and unsigned low halves do not become IEEE float coordinates',()=>{
 assert.deepEqual(P.parseFrame(bytes('level_signed_limits'),'level').level.rangesMeters,[-2048,2147483647/1048576,-1/1048576]);
 assert.throws(()=>P.parseFrame(bytes('level_foreign_float_point'),'level'),/descriptor/);
});
test('Level TLV2 decodes imag/real float input pairs, not uint16 bins or output spectrum',()=>{
 assert.deepEqual(P.parseFrame(bytes('level_full'),'level').fftInput,{sampleCount:4,samples:[{real:3,imag:-2},{real:-5,imag:4},{real:0,imag:0},{real:2.5,imag:1.25}],wireOrder:'imag-real'});
 const f=P.parseFrame(bytes('level_ranges_only'),'level');assert.equal(f.fftInput,undefined);assert.equal(f.points.length,0);
 assert.equal(P.parseFrame(bytes('level_max_fft'),'level').fftInput.sampleCount,1024);
});
test('Malformed level descriptors, duplicate/missing fields, and FFT bounds are rejected',()=>{
 for(const name of ['level_bad_q','level_bad_count','level_bad_header_count','level_bad_object_size','level_bad_fft_size','level_empty_fft','level_huge_fft','level_nonfinite_fft','level_duplicate_ranges','level_duplicate_fft','level_missing_ranges'])assert.throws(()=>P.parseFrame(bytes(name),'level'),/level|Level/);
});
test('Modern tracking TLVs cannot leak modern semantics into legacy profiles',()=>{
 for(const [name,profile]of [['area_modern_tlv','area'],['level_modern_tlv','level']]){const f=P.parseFrame(bytes(name),profile);assert.deepEqual(f.tracks,[]);assert.deepEqual(f.unknownTlvs,[1010]);}
});
test('Nonempty incompatible frame families fail instead of semantic auto-detection',()=>{
 for(const [data,right]of [[bytes('area_full'),'area'],[bytes('level_full'),'level'],[P.makeSyntheticFrame(7,'people'),'people'],[P.makeSyntheticFrame(7,'cpd'),'cpd']]){
  for(const wrong of ['people','area','level','cpd'])if(wrong!==right)assert.throws(()=>P.parseFrame(data,wrong),undefined,`${right} accepted as ${wrong}`);
 }
});
test('Every possible two-chunk split works for each legacy family and CPD wrapper',()=>{
 for(const [b,profile]of [[bytes('area_full'),'area'],[bytes('doors_full'),'doors'],[bytes('level_full'),'level'],[P.makeSyntheticFrame(4,'cpd'),'cpd']])for(let split=0;split<=b.length;split++){
  const decoder=new P.StreamDecoder(profile),frames=[...decoder.push(b.subarray(0,split)),...decoder.push(b.subarray(split))];assert.equal(frames.length,1,`${profile} split ${split}`);assert.equal(frames[0].profile,profile);assert.equal(decoder.errors,0);
 }
});
test('One-byte fragmentation, leading noise and consecutive legacy packets',()=>{
 for(const [name,profile]of [['area_full','area'],['doors_full','doors'],['level_full','level']]){const s=new P.StreamDecoder(profile),frames=[];for(const b of cat([9,9,9],bytes(name),bytes(name)))frames.push(...s.push(Uint8Array.of(b)));assert.equal(frames.length,2);assert.equal(s.discardedBytes,3);assert.equal(s.errors,0);}
});
test('Header and payload truncation never emit incomplete legacy frames',()=>{
 for(const [name,profile,header]of [['area_full','area',44],['doors_full','doors',44],['level_full','level',36]]){
  assert.throws(()=>P.parseFrame(bytes(name).slice(0,header-1),profile),/Short frame/);
  for(const length of [8,header-1,header,bytes(name).length-1]){const s=new P.StreamDecoder(profile),b=bytes(name);assert.equal(s.push(b.slice(0,length)).length,0);assert.equal(s.push(b.slice(length)).length,1);assert.equal(s.errors,0);}
 }
});
test('Profile-specific invalid length/count headers resynchronize onto the next frame',()=>{
 for(const [name,profile,header]of [['area_full','area',44],['doors_full','doors',44],['level_full','level',36]])for(const [off,value]of [[12,header-1],[12,0xffffffff],[32,0xffffffff]]){const s=new P.StreamDecoder(profile);assert.equal(s.push(cat(mutate(name,off,value),bytes(name))).length,1);assert(s.errors>0);}
});
test('TLV overruns, reserved type zero and excess trailing bytes fail and recover',()=>{
 for(const [name,profile,header]of [['area_full','area',44],['level_full','level',36]]){
  for(const malformed of [mutate(name,header+4,0xffffffff),mutate(name,header,0)]){assert.throws(()=>P.parseFrame(malformed,profile));const s=new P.StreamDecoder(profile);assert.equal(s.push(cat(malformed,bytes(name))).length,1);assert(s.errors>0);}
  const b=cat(bytes(name),new Uint8Array(32));new DataView(b.buffer).setUint32(12,b.length,true);assert.throws(()=>P.parseFrame(b,profile),/trailing/);
 }
});
test('CPD checksum failure is rejected before length buffering and wrapper recovers',()=>{
 const b=P.makeSyntheticFrame(4,'cpd'),bad=b.slice();bad[20]^=1;const decoder=new P.StreamDecoder('cpd');assert.equal(decoder.push(cat(bad,b)).length,1);assert(decoder.errors>0);
});
test('Subview inputs honor byteOffset for every profile',()=>{
 for(const profile of ['area','doors','level','cpd']){const b=P.makeSyntheticFrame(2,profile),wrapped=cat([99,88,77],b,[66]);const f=P.parseFrame(wrapped.subarray(3,3+b.length),profile);assert.equal(f.profile,profile);}
});
test('Synthetic area and doors use only their own static/dynamic/short-track schema',()=>{
 for(const profile of ['area','doors']){const b=P.makeSyntheticFrame(31,profile),f=P.parseFrame(b,profile);assert.equal(f.headerBytes,44);assert.equal(f.frameNumber,31);assert.equal(f.points.filter(p=>p.static===false).length,f.declaredPoints);assert.equal(f.points.filter(p=>p.static===true).length,f.declaredStaticPoints);assert.equal(f.tracks.length,1);assert.deepEqual(f.vitals,[]);assert.deepEqual(f.unknownTlvs,[]);assert.deepEqual(f.warnings,[]);}
});
test('Synthetic level preserves zero device frame counter with changing CPU stamp',()=>{
 const a=P.parseFrame(P.makeSyntheticFrame(30,'level'),'level'),b=P.parseFrame(P.makeSyntheticFrame(31,'level'),'level');assert.equal(a.frameNumber,0);assert.equal(b.frameNumber,0);assert.notEqual(a.timeCpuCycles,b.timeCpuCycles);assert.equal(a.level.rangesMeters.length,3);assert.equal(a.fftInput.sampleCount,64);assert.deepEqual(a.points,[]);assert.deepEqual(a.tracks,[]);assert.notDeepEqual(a.level,b.level);
});
test('Decoder reset clears partial legacy data and errors without changing selected profile',()=>{
 const s=new P.StreamDecoder('level');s.push(bytes('level_full').slice(0,40));s.errors=3;s.reset();assert.equal(s.profile,'level');assert.equal(s.buffer.length,0);assert.equal(s.errors,0);assert.equal(s.push(bytes('level_full')).length,1);
});
console.log(`${count} legacy tests passed`);
