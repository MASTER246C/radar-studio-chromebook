/* Experimental prototype informed by TI mmWave Applications Visualizer protocol files.
 * See PROVENANCE.txt. No hardware compatibility or medical accuracy claim.
 * All multi-byte values explicitly little-endian; TLV length excludes its header.
 */
(function (root) {
'use strict';
const MAGIC = Uint8Array.of(2,1,4,3,6,5,8,7), MAX_PACKET = 1024*1024;
function spherical(r,a,e,doppler,snr) {
  return {x:r*Math.sin(a)*Math.cos(e),y:r*Math.cos(a)*Math.cos(e),z:r*Math.sin(e),doppler,snr};
}
function parseFrame(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 40) throw Error('Short frame header');
  const d = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (!MAGIC.every((v,i)=>bytes[i]===v)) throw Error('Missing magic word');
  const total=d.getUint32(12,true), nt=d.getUint32(32,true);
  if(total!==bytes.length || total>MAX_PACKET || nt>1024 || 40+nt*8>total) throw Error('Invalid frame length/TLV count');
  const out={frameNumber:d.getUint32(20,true),version:d.getUint32(8,true),platform:d.getUint32(16,true),subFrame:d.getUint32(36,true),declaredPoints:d.getUint32(28,true),points:[],tracks:[],vitals:[],heights:[],trackIndexes:[],unknownTlvs:[],warnings:[]};
  let off=40, side=[];
  for(let ti=0;ti<nt;ti++) {
    if(off+8>total) throw Error('Truncated TLV header');
    const type=d.getUint32(off,true), len=d.getUint32(off+4,true); off+=8;
    if(len>total-off) throw Error('TLV extends beyond packet');
    const p=new DataView(bytes.buffer,bytes.byteOffset+off,len), f=(x)=>p.getFloat32(x,true);
    const multiple=(n)=>{if(len%n) throw Error('Invalid record size in TLV '+type);};
    if(type===1 || type===1000) {
      multiple(16);
      for(let i=0;i<len;i+=16) out.points.push(type===1?{x:f(i),y:f(i+4),z:f(i+8),doppler:f(i+12)}:spherical(f(i),f(i+4),f(i+8),f(i+12)));
    } else if(type===1020 || type===3001) {
      if(len<20 || (len-20)%8) throw Error('Invalid compressed point TLV');
      const u=[f(0),f(4),f(8),f(12),f(16)];
      for(let i=20;i<len;i+=8) out.points.push(spherical(p.getUint16(i+4,true)*u[3],p.getInt8(i+1)*u[1],p.getInt8(i)*u[0],p.getInt16(i+2,true)*u[2],p.getUint16(i+6,true)*u[4]));
    } else if(type===7) {
      multiple(4); for(let i=0;i<len;i+=4) side.push({snr:p.getUint16(i,true)*.1,noise:p.getUint16(i+2,true)*.1});
    } else if(type===1010 || type===308) {
      multiple(112);
      for(let i=0;i<len;i+=112) out.tracks.push({id:p.getUint32(i,true),x:f(i+4),y:f(i+8),z:f(i+12),vx:f(i+16),vy:f(i+20),vz:f(i+24),ax:f(i+28),ay:f(i+32),az:f(i+36),gain:f(i+104),confidence:f(i+108)});
    } else if(type===1011 || type===309) {
      out.trackIndexes = out.trackIndexes.concat(Array.from(new Uint8Array(bytes.buffer,bytes.byteOffset+off,len)));
    } else if(type===1012) {
      multiple(12); for(let i=0;i<len;i+=12) out.heights.push({id:p.getUint32(i,true),maxZ:f(i+4),minZ:f(i+8)});
    } else if(type===1040) {
      multiple(136);
      for(let i=0;i<len;i+=136) out.vitals.push({id:p.getUint16(i,true),rangeBin:p.getUint16(i+2,true),breathDeviation:f(i+4),heartRate:f(i+8),breathRate:f(i+12),heartWaveform:Array.from({length:15},(_,j)=>f(i+16+j*4)),breathWaveform:Array.from({length:15},(_,j)=>f(i+76+j*4))});
    } else out.unknownTlvs.push(type);
    off+=len;
    if(out.points.length>32768 || out.tracks.length>4096 || out.vitals.length>32) throw Error("Frame exceeds prototype display limits");
  }
  out.points.forEach((v,i)=>{if(side[i]) Object.assign(v,side[i]);});
  const finitePoint=p=>[p.x,p.y,p.z,p.doppler??0].every(Number.isFinite);
  if(out.points.some(p=>!finitePoint(p)) || out.tracks.some(p=>!finitePoint(p))) throw Error('Non-finite coordinates');
  if(out.vitals.some(v=>![v.heartRate,v.breathRate,v.breathDeviation,...v.heartWaveform,...v.breathWaveform].every(Number.isFinite))) throw Error('Non-finite vitals');
  if(out.declaredPoints!==out.points.length && out.points.length) out.warnings.push('Header point count differs from decoded points');
  // Some TI trackers associate indexes with the previous point-cloud frame.
  // Expose raw indexes; do not silently assign them to current points.
  return out;
}
class StreamDecoder {
  constructor(){this.buffer=new Uint8Array(0);this.errors=0;this.discardedBytes=0;this.lastError='';}
  reset(){this.buffer=new Uint8Array(0);this.errors=0;this.discardedBytes=0;this.lastError='';}
  push(chunk){
    if(!(chunk instanceof Uint8Array)) throw Error('Expected byte array');
    const frames=[];
    // Limit a single append; replay callers should use modest chunks too.
    for(let base=0;base<chunk.length;base+=65536){
      const part=chunk.subarray(base,base+65536), joined=new Uint8Array(this.buffer.length+part.length);
      joined.set(this.buffer);joined.set(part,this.buffer.length);this.buffer=joined;
      while(this.buffer.length>=8){
        let at=-1;
        outer: for(let i=0;i<=this.buffer.length-8;i++){for(let j=0;j<8;j++)if(this.buffer[i+j]!==MAGIC[j])continue outer;at=i;break;}
        if(at<0){this.discardedBytes+=this.buffer.length-7;this.buffer=this.buffer.slice(-7);break;}
        if(at){this.discardedBytes+=at;this.buffer=this.buffer.slice(at);}
        if(this.buffer.length<40)break;
        const d=new DataView(this.buffer.buffer,this.buffer.byteOffset,this.buffer.byteLength), total=d.getUint32(12,true),nt=d.getUint32(32,true);
        if(total<40 || total>MAX_PACKET || nt>1024 || 40+nt*8>total){this.errors++;this.lastError='Invalid frame header';this.buffer=this.buffer.slice(1);continue;}
        if(this.buffer.length<total)break;
        try{frames.push(parseFrame(this.buffer.subarray(0,total)));this.buffer=this.buffer.slice(total);}
        catch(e){this.errors++;this.lastError=e.message;this.buffer=this.buffer.slice(1);}
      }
    }
    return frames;
  }
}
function makeSyntheticFrame(n=1){
  const count=36, points=new Uint8Array(count*16),pd=new DataView(points.buffer),tracks=new Uint8Array(112),td=new DataView(tracks.buffer), vitals=new Uint8Array(136),vd=new DataView(vitals.buffer);
  const x=Math.sin(n*.04)*1.3,y=2.8+Math.cos(n*.03)*.5;
  for(let i=0;i<count;i++){const a=i*2.399;[x+.3*Math.sin(a),y+.2*Math.cos(a),.5+(i%12)*.1,Math.cos(n*.04)*.052].forEach((v,j)=>pd.setFloat32(i*16+j*4,v,true));}
  td.setUint32(0,1,true);[x,y,1.2,.05,0,0].forEach((v,i)=>td.setFloat32(4+i*4,v,true));td.setFloat32(108,.96,true);
  vd.setUint16(0,1,true);vd.setUint16(2,28,true);vd.setFloat32(4,.2,true);vd.setFloat32(8,72,true);vd.setFloat32(12,15,true);
  for(let i=0;i<15;i++){vd.setFloat32(16+4*i,Math.sin((n*15+i)*.22)*.55,true);vd.setFloat32(76+4*i,Math.sin((n*15+i)*.045),true);}
  const tlvs=[[1,points],[1010,tracks],[1040,vitals]], size=40+tlvs.reduce((s,t)=>s+8+t[1].length,0),buf=new Uint8Array(Math.ceil(size/32)*32),d=new DataView(buf.buffer);
  buf.set(MAGIC);[0x03060000,buf.length,0xa6843,n,n*1000,count,tlvs.length,0].forEach((v,i)=>d.setUint32(8+i*4,v,true));
  let off=40; for(const [type,p] of tlvs){d.setUint32(off,type,true);d.setUint32(off+4,p.length,true);buf.set(p,off+8);off+=8+p.length;}return buf;
}
const api={StreamDecoder,parseFrame,makeSyntheticFrame,MAX_PACKET};
if(typeof module==='object'&&module.exports)module.exports=api;root.RadarProtocol=api;
})(typeof globalThis!=='undefined'?globalThis:this);
