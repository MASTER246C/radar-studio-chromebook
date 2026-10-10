/* Dependency-free, sensor-coordinate orthographic renderer. No device/network access. */
(function(root){
'use strict';
const TAU=Math.PI*2,DEFAULT_YAW=-.55,DEFAULT_ELEVATION=.52;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function validPoint(p){return !!p&&[p.x,p.y,p.z].every(Number.isFinite);}
function inVolume(p,range){return validPoint(p)&&Number.isFinite(range)&&range>0&&Math.abs(p.x)<=range&&p.y>=0&&p.y<=range&&Math.abs(p.z)<=range;}
// Orthographic, Z-up. Top preset maps +X right / +Y up; front maps +X right / +Z up.
function project(p,view){
 if(!validPoint(p)||!view)return null;
 const {width,height,range,yaw,elevation}=view,zoom=view.zoom??1;
 if(![width,height,range,yaw,elevation,zoom].every(Number.isFinite)||width<=0||height<=0||range<=0||zoom<=0)return null;
 const dx=p.x,dy=p.y-range*.45,dz=p.z;
 const cy=Math.cos(yaw),sy=Math.sin(yaw),ce=Math.cos(elevation),se=Math.sin(elevation);
 const horizontal=dx*cy+dy*sy,vertical=-dx*sy*se+dy*cy*se+dz*ce;
 const depth=dx*sy*ce-dy*cy*ce+dz*se;
 const scale=Math.min(width,height)*.36/range*zoom;
 const x=width*.5+horizontal*scale,y=height*.5-vertical*scale;
 if(![x,y,depth,scale].every(Number.isFinite))return null;
 return{x,y,depth,scale,visible:x>=0&&x<=width&&y>=0&&y<=height};
}
class RadarScene{
 constructor(canvas){if(!canvas)throw Error('A scene canvas is required.');this.canvas=canvas;this.frame=null;this.trails=[];this.range=5;this.yaw=DEFAULT_YAW;this.elevation=DEFAULT_ELEVATION;this.magnification=1;this.controlsAttached=false;this.pointers=new Map();}
 setFrame(frame){this.frame=frame||null;}
 setTrails(segments){this.trails=Array.isArray(segments)?segments:[];}
 setRange(range){if(Number.isFinite(range)&&range>0)this.range=range;}
 preset(name){if(name==='top'){this.yaw=0;this.elevation=Math.PI/2;}else if(name==='front'){this.yaw=0;this.elevation=0;}else if(name==='orbit'||name==='reset'){this.yaw=DEFAULT_YAW;this.elevation=DEFAULT_ELEVATION;}else return;if(name==='reset')this.magnification=1;this.render();}
 zoom(factor){if(Number.isFinite(factor)&&factor>0){this.magnification=clamp(this.magnification*factor,.35,5);this.render();}}
 attachPointerControls(){
  if(this.controlsAttached)return;this.controlsAttached=true;const canvas=this.canvas;
  const distance=()=>{const p=[...this.pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;};
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(this.pointers.size>=2)return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{canvas.setPointerCapture(e.pointerId);}catch(_){}canvas.focus();e.preventDefault();});
  canvas.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;const old=this.pointers.get(e.pointerId),oldDistance=distance();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size===2){const nextDistance=distance();if(oldDistance>1&&nextDistance>1)this.zoom(nextDistance/oldDistance);}else{this.yaw=(this.yaw-(e.clientX-old.x)*.008)%TAU;this.elevation=clamp(this.elevation+(e.clientY-old.y)*.008,-Math.PI/2,Math.PI/2);this.render();}e.preventDefault();});
  const release=e=>{this.pointers.delete(e.pointerId);};for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.exp(clamp(-e.deltaY*.0015,-.35,.35)));},{passive:false});
  canvas.addEventListener('keydown',e=>{let handled=true;switch(e.key){case'ArrowLeft':this.yaw-=.12;break;case'ArrowRight':this.yaw+=.12;break;case'ArrowUp':this.elevation=clamp(this.elevation+.12,-Math.PI/2,Math.PI/2);break;case'ArrowDown':this.elevation=clamp(this.elevation-.12,-Math.PI/2,Math.PI/2);break;case'+':case'=':this.zoom(1.15);break;case'-':case'_':this.zoom(1/1.15);break;case'Home':this.preset('reset');break;default:handled=false;}if(handled){e.preventDefault();this.render();}});
 }
 render(){
  const canvas=this.canvas,rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height),dpr=clamp(root.devicePixelRatio||1,1,3);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const c=canvas.getContext('2d');if(!c)return;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  const view={width,height,range:this.range,yaw:this.yaw,elevation:this.elevation,zoom:this.magnification},r=this.range,P=p=>project(p,view);
  const line=(a,b,color,width=1,dashed=false)=>{const p=P(a),q=P(b);if(!p||!q)return;c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dashed?[3,5]:[]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.setLineDash([]);};
  const label=(p,text,color='#91a7bf',offsetX=5,offsetY=-5)=>{const q=P(p);if(!q||!q.visible)return;c.fillStyle=color;c.font='11px system-ui';c.fillText(text,q.x+offsetX,q.y+offsetY);};
  c.save();c.beginPath();c.rect(0,0,width,height);c.clip();
  // Sensor XY plane and view volume; neither is a mounting-corrected ground plane.
  for(let i=0;i<=10;i++){const x=-r+i*r/5,y=i*r/10;line({x,y:0,z:0},{x,y:r,z:0},i===5?'#3c5067':'#253448');line({x:-r,y,z:0},{x:r,y,z:0},'#253448');}
  const corners=[];for(const x of [-r,r])for(const y of [0,r])for(const z of [-r,r])corners.push({x,y,z});
  for(let i=0;i<corners.length;i++)for(let j=i+1;j<corners.length;j++)if(['x','y','z'].filter(k=>corners[i][k]!==corners[j][k]).length===1)line(corners[i],corners[j],'#293c51',1,true);
  const origin={x:0,y:0,z:0},axes=[['X',{x:r*.85,y:0,z:0},'#f79691'],['Y',{x:0,y:r*.9,z:0},'#65decd'],['Z',{x:0,y:0,z:r*.85},'#74a7ff']];
  for(const [name,p,color] of axes){line(origin,p,color,1.7);label(p,`+${name}`,color);}
  const zero=P(origin);if(zero?.visible){c.fillStyle='#f4f7fc';c.beginPath();c.arc(zero.x,zero.y,4,0,TAU);c.fill();label(origin,'Sensor (0, 0, 0)','#d3ddeb',8,17);}
  for(let i=0;i<=5;i++){const v=i*r/5;label({x:-r,y:v,z:0},`${+v.toFixed(2)} m`,'#677f99',-31,2);}
  const trailColors=['#74a7ff','#b095f7','#e5b272','#67bdc7','#df8aa5','#9fbd75'];
  for(const segment of this.trails){const points=segment.points||[];let hash=0;for(const ch of String(segment.id))hash=(hash*31+ch.charCodeAt(0))>>>0;c.globalAlpha=.42;for(let i=1;i<points.length;i++){if(inVolume(points[i-1],r)&&inVolume(points[i],r))line(points[i-1],points[i],trailColors[hash%trailColors.length],1.5);}c.globalAlpha=1;}
  const objects=[];let omitted=0;
  for(const [type,entries] of [['point',this.frame?.points||[]],['track',this.frame?.tracks||[]]])for(const object of entries){if(!inVolume(object,r)){omitted++;continue;}const p=P(object);if(!p||!p.visible){omitted++;continue;}objects.push({type,object,p});}
  objects.sort((a,b)=>a.p.depth-b.p.depth);
  for(const {type,object,p} of objects){if(type==='point'){c.fillStyle='#65decd';c.globalAlpha=.78;c.beginPath();c.arc(p.x,p.y,2.5,0,TAU);c.fill();c.globalAlpha=1;}else{c.strokeStyle='#82b2ff';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,9,0,TAU);c.stroke();c.beginPath();c.moveTo(p.x-13,p.y);c.lineTo(p.x-6,p.y);c.moveTo(p.x+6,p.y);c.lineTo(p.x+13,p.y);c.moveTo(p.x,p.y-13);c.lineTo(p.x,p.y-6);c.moveTo(p.x,p.y+6);c.lineTo(p.x,p.y+13);c.stroke();c.font='12px system-ui';c.fillStyle='#bed7ff';c.fillText(`ID ${String(object.id??'?').slice(0,24)}`,p.x+13,p.y-9);}}
  c.restore();c.font='11px system-ui';c.fillStyle='#91a7bf';c.fillText(`ORTHOGRAPHIC · ${this.magnification.toFixed(2)}× · meters`,16,24);c.fillText(`X ±${r}  /  Y 0–${r}  /  Z ±${r}`,16,42);if(omitted)c.fillText(`${omitted} point/track records outside view or invalid`,16,height-17);
  if(!this.frame){c.textAlign='center';c.fillStyle='#b4c4d7';c.fillText('No decoded frame · drag to explore sensor axes',width/2,height*.82);c.textAlign='start';}
 }
}
RadarScene.project=project;RadarScene.inVolume=inVolume;RadarScene.validPoint=validPoint;
if(typeof module==='object'&&module.exports)module.exports={RadarScene,project,inVolume,validPoint};root.RadarScene=RadarScene;
})(typeof globalThis!=='undefined'?globalThis:this);
