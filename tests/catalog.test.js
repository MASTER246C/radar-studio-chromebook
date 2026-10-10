'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
const C=require('../demo_catalog.js');
const manifest=JSON.parse(fs.readFileSync(__dirname+'/../demo-catalog.json','utf8'));
const fakeFile=(name,text,size)=>{const bytes=new TextEncoder().encode(text);return {name,size:size===undefined?bytes.length:size,arrayBuffer:async()=>bytes.buffer};};
(async()=>{
 assert.deepEqual(C.metadata,manifest);assert.equal(C.profiles.length,12);assert.equal(C.metadata.archive_sha256,'e861a67c115f687bf57147c5775122698fc2c3a5fe8c710472de04d2c05a97e8');
 assert.equal(C.get('unknown'),null);assert.ok(Object.isFrozen(C.profiles));
 for(const id of ['oob','people','people-low-power','overhead','vitals','small-obstacle']) assert.equal(C.get(id).status,'partial-protocol');
 for(const id of ['gesture','speed'])assert.equal(C.get(id).status,'experimental');
 for(const id of ['level','area','doors','cpd'])assert.equal(C.get(id).status,'unsupported');
 const normal=C.get('people').binary[0],low=C.get('people-low-power').binary[0];
 assert.equal(normal.basename,low.basename);assert.notEqual(normal.sha256,low.sha256);assert.notEqual(normal.path,low.path);assert.notEqual(normal.size,low.size);
 for(const p of C.profiles)for(const [kind,files]of [['binary',p.binary],['config',p.configs]])for(const a of files){
   assert.match(a.sha256,/^[a-f0-9]{64}$/);assert.ok(a.path.endsWith('/'+a.basename));assert.ok(a.size>0);
   const record={name:a.basename,size:a.size,sha256:a.sha256,kind};
   assert.ok(C.matchMetadata(record).some(m=>m.path===a.path&&m.profileId===p.id));
   assert.deepEqual(C.matchMetadata({...record,kind:kind==='binary'?'config':'binary'}),[]);
   assert.deepEqual(C.matchMetadata({...record,size:a.size+1}),[]);
   assert.deepEqual(C.matchMetadata({...record,sha256:'0'.repeat(64)}),[]);
   assert.deepEqual(C.matchMetadata({...record,name:'renamed-'+a.basename}),[]);
 }
 const result=await C.inspectFile(fakeFile('sample.cfg','abc'));
 assert.equal(result.sha256,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');assert.equal(result.status,'unverified');assert.equal(result.kind,'config');assert.deepEqual(result.matches,[]);assert.ok(!('bytes'in result));assert.ok(!('text'in result));
 assert.equal((await C.inspectFile(fakeFile('sample.BIN','abc'))).kind,'binary');
 await assert.rejects(()=>C.inspectFile(fakeFile('huge.bin','',C.MAX_BYTES+1)),/16 MiB/);
 await assert.rejects(()=>C.inspectFile(fakeFile('wrong.txt','abc')),/Only BIN and CFG/);
 await assert.rejects(()=>C.inspectFile(fakeFile('changed.cfg','abc',4)),/size changed/);
 await assert.rejects(()=>C.inspectFile(null),/Choose/);
 // Minimal dependency-free DOM checks for profile selection and cancellation.
 class Element {
   constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.listeners={};this.attributes={};this.value='';this.textContent='';}
   appendChild(node){this.children.push(node);return node;}
   replaceChildren(){this.children=[];}
   setAttribute(k,v){this.attributes[k]=v;}
   addEventListener(k,fn){this.listeners[k]=fn;}
   dispatchEvent(event){if(this.listeners[event.type])this.listeners[event.type](event);return !event.defaultPrevented;}
 }
 const doc={createElement:tag=>new Element(tag,doc)},container=new Element('div',doc);
 class FakeEvent{constructor(type,options){Object.assign(this,options);this.type=type;this.defaultPrevented=false;}preventDefault(){if(this.cancelable)this.defaultPrevented=true;}}
 const context={DemoCatalog:C,CustomEvent:FakeEvent};require('node:vm').createContext(context);
 require('node:vm').runInContext(fs.readFileSync(__dirname+'/../catalog_ui.js','utf8'),context);
 const ui=context.CatalogUI.mount(container);
 const find=(node,tag)=>node.tagName===tag?node:node.children.map(c=>find(c,tag)).find(Boolean);
 const select=find(container,'select');assert.equal(ui.getProfile(),'people');
 let seen=null;container.addEventListener('radar-profile-change',event=>{seen=event;event.preventDefault();});
 select.value='area';select.dispatchEvent(new FakeEvent('change',{}));assert.equal(seen.detail.id,'area');assert.equal(seen.bubbles,true);assert.equal(seen.cancelable,true);assert.equal(ui.getProfile(),'people');
 container.addEventListener('radar-profile-change',event=>{seen=event;});select.value='gesture';select.dispatchEvent(new FakeEvent('change',{}));assert.equal(ui.getProfile(),'gesture');
 assert.equal(ui.selectProfile('speed'),true);assert.equal(ui.getProfile(),'speed');assert.equal(ui.selectProfile('invalid'),false);assert.equal(ui.getProfile(),'speed');
 const input=find(container,'input');assert.equal(input.accept,'.bin,.cfg');assert.equal(input.multiple,true);
 console.log('PASS catalog UI: default profile, cancelable event rollback, accepted selection, explicit display sync and local file input');
 console.log('PASS catalog: 12 profiles, exact manifest parity, artifact identities/kinds/mismatches, Node Web Crypto SHA-256, unknown and invalid inputs');
})().catch(e=>{console.error(e);process.exitCode=1;});
