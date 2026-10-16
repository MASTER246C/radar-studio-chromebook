import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
/* Mock-DOM checks for camera_review.js. No camera, model or real video is used. */
const html=fs.readFileSync(new URL('../camera-review.html',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../camera_review.js',import.meta.url),'utf8');
const hex=async text=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
const settle=(ms=0)=>new Promise(r=>setTimeout(r,ms));
function env({crashWorker=false}={}){
 class E{constructor(tag){this.tagName=tag.toUpperCase();this.value='';this.textContent='';this.children=[];this.files=[];this.disabled=false;this.checked=false;this.listeners={};}
  append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}setAttribute(){}click(){if(!this.disabled)return this.onclick?.();}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(f=>f!==fn);}
  pause(){}play(){return Promise.resolve();}}
 const els={};for(const [,id] of html.matchAll(/id="([^"]+)"/g))els[id]=new E(id==='reviewVideo'?'video':'div');
 Object.assign(els.reviewVideo,{currentTime:0,readyState:4,duration:20});els.reviewStart.value='0';els.reviewEnd.value='10';els.reviewBoundaryUncertainty.value='100';
 const blobs=[],workers=[];
 class FakeWorker{constructor(){workers.push(this);}postMessage(message){if(crashWorker){if(!this.crashed){this.crashed=true;setTimeout(()=>this.onerror?.({message:'worker crashed'}),1);}return;}setTimeout(()=>this.onmessage?.({data:{id:message.id,type:message.type}}),1);}terminate(){this.terminated=true;}}
 const ctx={document:{getElementById:id=>els[id],createElement:tag=>new E(tag),createTextNode:text=>({textContent:text})},window:{addEventListener(){}},location:{href:'https://example.test/camera-review.html'},
  URL:Object.assign(function(u,b){return new URL(u,b);},{createObjectURL:b=>{blobs.push(b);return 'blob:'+blobs.length;},revokeObjectURL(){}}),Blob,Worker:FakeWorker,crypto:webcrypto,TextEncoder,JSON,Math,Number,String,Array,Map,Promise,Error,Uint8Array,Date,
  setTimeout,clearTimeout,createImageBitmap:async()=>({close(){}}),CameraLabels:{proposals:()=>[],fitAlignment:()=>({})}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {els,blobs,workers};
}
const file=(name,text,delay=0)=>({name,size:text.length,arrayBuffer:()=>settle(delay).then(()=>new TextEncoder().encode(text).buffer),text:async()=>text});
async function pick(input,f){input.files=[f];input.value=f?'C:\\fakepath\\'+f.name:'';await input.onchange();}

test('a crashed pose worker releases the controls promptly',async()=>{
 const e=env({crashWorker:true});await pick(e.els.reviewVideoFile,file('a.webm','video-a'));
 const started=Date.now();await Promise.race([e.els.reviewAnalyze.onclick(),settle(3000).then(()=>{throw Error('analysis stayed locked for 3 s');})]);
 assert(Date.now()-started<3000);assert.equal(e.els.reviewAnalyze.disabled,false);assert.match(e.els.reviewStatus.textContent,/Analysis: worker crashed/);assert(e.workers.every(w=>w.terminated));
});
test('a slower earlier video hash cannot be attached to a later video',async()=>{
 const e=env();const first=pick(e.els.reviewVideoFile,file('first.webm','video-first',100));await settle(5);await pick(e.els.reviewVideoFile,file('second.webm','video-second'));await first;
 assert.equal(e.els.reviewVideoInfo.textContent,'second.webm · 12 bytes · SHA-256 '+await hex('video-second'));
});
test('changing the video clears the stale receipt selection',async()=>{
 const e=env();await pick(e.els.reviewVideoFile,file('a.webm','video-a'));await pick(e.els.reviewMetaFile,file('a.webm.meta.json','{"schema":"radar-camera-file"}'));
 await pick(e.els.reviewVideoFile,file('b.webm','video-b'));assert.equal(e.els.reviewMetaFile.value,'');
});
test('a manually added unreviewed interval is exported as human-created',async()=>{
 const e=env();await pick(e.els.reviewVideoFile,file('a.webm','video-a'));e.els.reviewAdd.click();e.els.reviewer.value='tester';e.els.reviewExport.click();
 const output=JSON.parse(await e.blobs.at(-1).text()),[label]=output.labels;
 assert.equal(label.review_status,'unreviewed');assert.equal(label.source,'human');assert.equal(label.proposal_index,null);
});
