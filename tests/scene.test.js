'use strict';
const assert=require('assert');const {RadarScene,project,inVolume,validPoint}=require('../radar_scene.js');
const base={width:800,height:600,range:5,yaw:0,elevation:0,zoom:1};const origin={x:0,y:0,z:0};
function close(a,b){assert(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);}
let p=project(origin,base);close(p.x,400);close(p.y,300);
assert(project({x:1,y:0,z:0},base).x>p.x);assert(project({x:0,y:0,z:1},base).y<p.y);close(project({x:0,y:1,z:0},base).y,p.y);
const top={...base,elevation:Math.PI/2},topOrigin=project(origin,top);assert(project({x:0,y:1,z:0},top).y<topOrigin.y);assert(project({x:1,y:0,z:0},top).x>topOrigin.x);close(project({x:0,y:0,z:1},top).y,topOrigin.y);
const unit=project({x:1,y:0,z:0},base),zoomed=project({x:1,y:0,z:0},{...base,zoom:2});close(zoomed.x-400,2*(unit.x-400));
for(const point of [null,{}, {x:NaN,y:1,z:1},{x:0,y:Infinity,z:0}])assert.equal(project(point,base),null);
for(const view of [{...base,width:0},{...base,zoom:0},{...base,range:0},{...base,elevation:NaN}])assert.equal(project(origin,view),null);
assert(!project({x:500,y:0,z:0},base).visible);assert(!inVolume({x:0,y:-1,z:0},5));assert(inVolume({x:5,y:5,z:-5},5));assert(!validPoint({x:0,y:0,z:'1'}));
for(let yaw=-3;yaw<=3;yaw+=.3)for(let elevation=-1.5;elevation<=1.5;elevation+=.3){p=project({x:2,y:3,z:1},{...base,yaw,elevation});assert([p.x,p.y,p.depth].every(Number.isFinite));}
const events={},calls=[],ctx=new Proxy({},{get:(o,k)=>o[k]||((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});const canvas={width:0,height:0,getBoundingClientRect:()=>({width:800,height:600}),getContext:()=>ctx,addEventListener:(name,fn)=>{events[name]=fn;},setPointerCapture(){},focus(){}};
const scene=new RadarScene(canvas);scene.attachPointerControls();const eventCount=Object.keys(events).length;scene.attachPointerControls();assert.equal(Object.keys(events).length,eventCount);scene.setRange(10);scene.setRange(NaN);assert.equal(scene.range,10);scene.setFrame({points:[{x:1,y:3,z:1},{x:NaN,y:0,z:0}],tracks:[{id:7,x:1,y:3,z:1}]});scene.setTrails([{id:7,points:[{x:0,y:1,z:0,t:1},{x:1,y:3,z:1,t:2}]}]);scene.render();assert.equal(canvas.width,800);assert(calls.some(c=>c[0]==='fillText'&&c[1]==='ID 7'));assert(calls.some(c=>c[0]==='fillText'&&String(c[1]).includes('outside view')));for(const call of calls)for(const arg of call.slice(1))if(typeof arg==='number')assert(Number.isFinite(arg));
scene.preset('top');close(scene.elevation,Math.PI/2);scene.preset('front');close(scene.elevation,0);scene.zoom(100);assert.equal(scene.magnification,5);scene.zoom(.000001);assert.equal(scene.magnification,.35);scene.preset('reset');assert.equal(scene.magnification,1);
const event=(extra={})=>({pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:100,preventDefault(){},...extra});events.pointerdown(event());const oldYaw=scene.yaw;events.pointermove(event({clientX:120}));assert.notEqual(scene.yaw,oldYaw);events.pointerup(event());assert.equal(scene.pointers.size,0);events.keydown(event({key:'Home'}));close(scene.yaw,-.55);events.keydown(event({key:'+'}));assert(scene.magnification>1);events.pointerdown(event({pointerType:'touch'}));events.pointerdown(event({pointerType:'touch',pointerId:2,clientX:200}));const oldZoom=scene.magnification;events.pointermove(event({pointerType:'touch',pointerId:2,clientX:220}));assert(scene.magnification>oldZoom);events.pointercancel(event({pointerId:2}));events.lostpointercapture(event());assert.equal(scene.pointers.size,0);
scene.setFrame({points:[{x:0,y:2,z:0,static:true},{x:1,y:2,z:0,static:false}],tracks:[]});scene.render();assert(calls.some(c=>c[0]==='fillText'&&String(c[1]).includes('Amber: static cloud')));
console.log('PASS: XYZ top/front/orbit projection, zoom geometry, finite/invalid clipping, view volume, render labels/trails, pointer orbit/pinch/cancel, keyboard/reset, zoom limits. Mathematical/mock-canvas tests; actual visual rendering not verified.');

// Twenty-meter bounds, responsive aspect ratios and close-view scale are geometric only.
for(const [width,height]of [[1280,720],[390,380],[320,240]]){
 const view={width,height,range:20,yaw:0,elevation:0,zoom:1};
 for(const point of [{x:20,y:20,z:0},{x:-20,y:0,z:0},{x:0,y:20,z:20},{x:0,y:0,z:-20}]){assert(inVolume(point,20));const projected=project(point,view);assert(projected.visible);assert([projected.x,projected.y,projected.scale].every(Number.isFinite));}
 assert(!inVolume({x:20.001,y:10,z:0},20));assert(!inVolume({x:0,y:20.001,z:0},20));
 const zero=project(origin,view),x=project({x:1,y:0,z:0},view),z=project({x:0,y:0,z:1},view);close(x.x-zero.x,zero.y-z.y);
 const near={...view,range:2},near0=project(origin,near),near1=project({x:1,y:0,z:0},near);close(near1.x-near0.x,10*(x.x-zero.x));
 const closeZoom=project({x:1,y:0,z:0},{...view,zoom:5});close(closeZoom.x-zero.x,5*(x.x-zero.x));
}
scene.setRange(20);scene.preset('front');scene.setFrame({points:[{x:20,y:20,z:0}],tracks:[]});scene.render();assert(calls.some(c=>c[0]==='fillText'&&c[1]==='20 m'));assert(calls.some(c=>c[0]==='fillText'&&String(c[1]).includes('Y 0–20')));
scene.setRange(2);scene.render();assert(calls.some(c=>c[0]==='fillText'&&c[1]==='0.4 m'));
console.log('PASS:20m bounds,20/2m metric scaling,close zoom,desktop/mobile aspect ratios and adaptive tick labels; display only.');
