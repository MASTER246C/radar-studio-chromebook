'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const P=require('../radar_protocol.js');
const fixtures=JSON.parse(fs.readFileSync(__dirname+'/fixtures.json'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
let n=0;function test(name,run){run();console.log('PASS '+name);n++;}
const cat=(...parts)=>Uint8Array.from(parts.flatMap(v=>Array.from(v)));
test('Python cartesian, side-info ordering, 112-byte tracks, two vitals TLVs',()=>{
 const f=P.parseFrame(Uint8Array.from(fixtures.cartesian));assert.equal(f.frameNumber,23);assert.deepEqual(f.points[0],{x:1,y:2,z:3,doppler:-.5,snr:12.5,noise:4});
 assert.equal(f.tracks[0].id,42);near(f.tracks[0].confidence,.9);assert.equal(f.vitals.length,2);assert.equal(f.vitals[1].id,2);assert.equal(f.vitals[0].heartRate,72);near(f.vitals[1].breathWaveform[14],2.8);assert.deepEqual(f.unknownTlvs,[9000]);assert.deepEqual(f.trackIndexes,[42]);near(f.heights[0].maxZ,1.8);
});
test('Python spherical conversion',()=>{const p=P.parseFrame(Uint8Array.from(fixtures.spherical)).points[0];near(p.x,2);near(p.y,0);near(p.z,0);});
test('Python compressed signed point values',()=>{const p=P.parseFrame(Uint8Array.from(fixtures.compressed)).points[0];near(p.x,3*Math.sin(.2)*Math.cos(-.1));near(p.z,3*Math.sin(-.1));near(p.doppler,-.4);near(p.snr,12.5);});
test('Every possible two-chunk split',()=>{const b=Uint8Array.from(fixtures.cartesian);for(let i=0;i<=b.length;i++){const s=new P.StreamDecoder();const frames=[...s.push(b.subarray(0,i)),...s.push(b.subarray(i))];assert.equal(frames.length,1);assert.equal(s.errors,0);}});
test('Single-byte fragmentation + noise + consecutive packets',()=>{const s=new P.StreamDecoder();let f=[];for(const b of cat([7,8,9],fixtures.cartesian,fixtures.zero))f.push(...s.push(Uint8Array.of(b)));assert.equal(f.length,2);assert.equal(s.discardedBytes,3);});
test('Truncation buffers without premature parse',()=>{const s=new P.StreamDecoder(),b=Uint8Array.from(fixtures.cartesian);assert.equal(s.push(b.slice(0,-1)).length,0);assert.equal(s.push(b.slice(-1)).length,1);});
test('Invalid huge, small, and TLV-count headers recover',()=>{for(const [off,value]of [[12,0xffffffff],[12,10],[32,9999]]){let b=Uint8Array.from(fixtures.cartesian);new DataView(b.buffer).setUint32(off,value,true);let s=new P.StreamDecoder();assert.equal(s.push(cat(b,fixtures.zero)).length,1);assert.ok(s.errors>0);}});
test('TLV overrun recovers next packet',()=>{let b=Uint8Array.from(fixtures.cartesian);new DataView(b.buffer).setUint32(44,b.length,true);let s=new P.StreamDecoder();assert.equal(s.push(cat(b,fixtures.zero)).length,1);assert.ok(s.errors>0);});
test('Malformed fixed record rejected',()=>{let b=Uint8Array.from(fixtures.spherical);new DataView(b.buffer).setUint32(44,15,true);assert.throws(()=>P.parseFrame(b),/record size/);});
test('Non-finite coordinates rejected',()=>{let b=Uint8Array.from(fixtures.spherical);new DataView(b.buffer).setFloat32(48,NaN,true);assert.throws(()=>P.parseFrame(b),/Non-finite/);});
test('Noise retention bounded',()=>{const s=new P.StreamDecoder();s.push(new Uint8Array(3*P.MAX_PACKET));assert.ok(s.buffer.length<=7);});
test('Synthetic frame is valid only as explicitly labeled demo',()=>{const f=P.parseFrame(P.makeSyntheticFrame(99));assert.equal(f.frameNumber,99);assert.equal(f.points.length,36);assert.equal(f.tracks.length,1);assert.equal(f.vitals.length,1);});
test('Corrupt oversized length resynchronizes at the next magic word',()=>{const bad=P.makeSyntheticFrame(1);new DataView(bad.buffer,bad.byteOffset).setUint32(12,500000,true);const good=[P.makeSyntheticFrame(2),P.makeSyntheticFrame(3)];
 const s=new P.StreamDecoder();assert.deepEqual(s.push(cat(bad,...good)).map(f=>f.frameNumber),[2,3]);assert.ok(s.errors>=1);assert.match(s.lastError,/next magic word/);
 const t=new P.StreamDecoder(),all=cat(bad,...good),got=[];for(let i=0;i<all.length;i+=97)got.push(...t.push(all.subarray(i,i+97)).map(f=>f.frameNumber));assert.deepEqual(got,[2,3]);
 const u=new P.StreamDecoder();assert.deepEqual(u.push(cat(bad,good[0])).map(f=>f.frameNumber),[2]);assert.deepEqual(u.push(good[1]).map(f=>f.frameNumber),[3]);});
console.log(`${n} tests passed`);
