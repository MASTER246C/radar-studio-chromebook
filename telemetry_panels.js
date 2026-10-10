/* First-party experimental telemetry displays. Read-only and non-actuating.
 * Field facts: TI Applications Visualizer parseTLVs.py and gesture_recognition.py.
 * No TI postprocessing, gesture commands, inference, or interpolation is performed.
 */
(function(root){
'use strict';
const GESTURES=['No Gesture','Left-to-Right','Right-to-Left','Up-to-Down','Down-to-Up','CW Twirl','CCW Twirl','Push','Pull','Shine'];
const FEATURES=['weightedDoppler','positive','negative','range','detections','azimuth','elevation','azDoppCorr','azStd','elevStd'];
const COLORS=['#92a4bb','#65decd','#74a7ff','#ffcf76','#f69bac','#ba9aff','#67cceb','#ddac7d','#b3d775','#ff8a65'];
const LIMIT=150, STALE_MS=5000;
const vector=(value,probability=false)=>Array.isArray(value)&&value.length===10&&value.every(x=>Number.isFinite(x)&&(!probability||(x>=0&&x<=1)));
class TelemetryStore {
  constructor(){this.reset();}
  reset(){this.features=null;this.probabilities=null;this.velocity=null;this.probabilityHistory=[];this.velocityHistory=[];this.seen=new Set();}
  clear(){this.reset();}
  ingest(frames,receivedAt=Date.now()){
    if(!Number.isFinite(receivedAt))return;
    for(const frame of frames||[]){
      if(!frame)continue;
      const key=Number.isInteger(frame.frameNumber)?`${frame.frameNumber}:${frame.subFrame??0}`:null;
      const record=(kind,data)=>{
        const id=key===null?null:`${kind}:${key}`;
        if(id&&this.seen.has(id))return null;
        if(id){this.seen.add(id);while(this.seen.size>LIMIT*6)this.seen.delete(this.seen.values().next().value);}
        return {...data,receivedAt,frameNumber:frame.frameNumber,subFrame:frame.subFrame??0};
      };
      if(vector(frame.gestureFeatures)){
        const r=record('features',{values:frame.gestureFeatures.slice()});if(r)this.features=r;
      }
      if(vector(frame.gestureProbabilities,true)){
        const r=record('probabilities',{values:frame.gestureProbabilities.slice()});
        if(r){this.probabilities=r;this.probabilityHistory.push(r);if(this.probabilityHistory.length>LIMIT)this.probabilityHistory.shift();}
      }
      if(frame.velocity!==undefined&&frame.velocity!==null){
        const valid=frame.velocity.valid===true&&Number.isFinite(frame.velocity.value);
        const r=record('velocity',{valid,value:valid?frame.velocity.value:null});
        if(r){this.velocity=r;this.velocityHistory.push(r);if(this.velocityHistory.length>LIMIT)this.velocityHistory.shift();}
      }
    }
  }
  snapshot(now=Date.now()){
    const describe=r=>r?{...r,ageMs:Math.max(0,now-r.receivedAt),stale:now-r.receivedAt>STALE_MS}:null;
    return {features:describe(this.features),probabilities:describe(this.probabilities),velocity:describe(this.velocity)};
  }
}
function element(doc,tag,text,className){const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function freshness(r){return r?`${r.stale?'STALE · ':''}Received ${new Date(r.receivedAt).toISOString()} · ${(r.ageMs/1000).toFixed(1)} s ago · frame ${r.frameNumber??'unknown'}, subframe ${r.subFrame}`:'Awaiting this TLV; no sample received.';}
function draw(canvas,history,probability){
  const ctx=canvas.getContext&&canvas.getContext('2d');if(!ctx)return;
  const w=canvas.width=640,h=canvas.height=170,p=30;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#263447';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p,p);ctx.lineTo(p,h-p);ctx.lineTo(w-p,h-p);ctx.stroke();
  const numbers=history.flatMap(r=>probability?r.values:(r.valid?[r.value]:[]));
  let min=probability?0:Math.min(0,...numbers),max=probability?1:Math.max(0,...numbers);if(min===max){min-=1;max+=1;}
  ctx.fillStyle='#92a4bb';ctx.font='10px system-ui';ctx.fillText(max.toFixed(1),1,p);ctx.fillText(min.toFixed(1),1,h-p);ctx.fillText('Older received samples → newer (frame order)',p,h-6);
  for(let series=0;series<(probability?10:1);series++){
    ctx.strokeStyle=COLORS[probability?series:1];ctx.lineWidth=1.6;ctx.beginPath();let pen=false;
    history.forEach((r,i)=>{
      const value=probability?r.values[series]:(r.valid?r.value:null);
      if(value===null){pen=false;return;}
      const x=p+i*(w-p*2)/Math.max(1,history.length-1),y=h-p-(value-min)/(max-min)*(h-p*2);
      if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;
      ctx.fillStyle=COLORS[probability?series:1];ctx.fillRect(x-1,y-1,2,2);
    });ctx.stroke();
  }
}
class TelemetryPanels {
  constructor(container){if(!container)throw new Error('Telemetry panel container required');this.container=container;this.store=new TelemetryStore();this.profile=null;this.showKmh=false;this.nodes={};}
  ingest(frames,receivedAt){this.store.ingest(frames,receivedAt);}
  reset(){this.store.reset();this.profile=null;this.container.replaceChildren();this.nodes={};}
  build(profile){
    const box=this.container,doc=box.ownerDocument;box.replaceChildren();this.profile=profile;this.nodes={};
    if(profile!=='gesture'&&profile!=='speed')return;
    const card=element(doc,'section',undefined,'plot-card');card.style.padding='16px';box.appendChild(card);
    card.appendChild(element(doc,'h2',profile==='gesture'?'Gesture telemetry · experimental':'Surface velocity · experimental'));
    const source=element(doc,'p','', 'notice');card.appendChild(source);this.nodes.source=source;
    card.appendChild(element(doc,'p',profile==='gesture'?'Raw ANN probabilities, not a confirmed gesture. No TI postprocessing or app debounce is applied. Informational only; no key control or commands.':'Reported surface velocity is informational only. It does not control devices or trigger actions.','fine'));
    const status=element(doc,'p','', 'fine');card.appendChild(status);this.nodes.status=status;
    if(profile==='gesture'){
      this.nodes.values=[];const grid=element(doc,'div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px';card.appendChild(grid);
      GESTURES.forEach((label,i)=>{const row=element(doc,'div');row.style.color=COLORS[i];const value=element(doc,'strong','—');row.appendChild(element(doc,'span',`${label}: `));row.appendChild(value);grid.appendChild(row);this.nodes.values.push(value);});
      card.appendChild(element(doc,'h3','Raw feature vector'));
      const featureStatus=element(doc,'p','', 'fine');card.appendChild(featureStatus);this.nodes.featureStatus=featureStatus;
      const features=element(doc,'div');features.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px';card.appendChild(features);this.nodes.features=[];
      FEATURES.forEach(label=>{const row=element(doc,'div');row.appendChild(element(doc,'span',`${label}: `));const value=element(doc,'strong','—');row.appendChild(value);features.appendChild(row);this.nodes.features.push(value);});
    }else{
      this.nodes.speed=element(doc,'p','Unavailable');this.nodes.speed.style.fontSize='26px';card.appendChild(this.nodes.speed);
      const label=element(doc,'label');const checkbox=element(doc,'input');checkbox.type='checkbox';checkbox.checked=this.showKmh;
      checkbox.addEventListener('change',()=>{this.showKmh=checkbox.checked;if(this.lastRender)this.render(...this.lastRender);});label.appendChild(checkbox);label.appendChild(element(doc,'span',' Also show km/h'));card.appendChild(label);
    }
    card.appendChild(element(doc,'p',profile==='gesture'?'Last 150 received probability samples · scale 0–1 · colors match labels above':'Last 150 received velocity samples · m/s · invalid samples leave gaps','fine'));
    this.nodes.chart=element(doc,'canvas');this.nodes.chart.style.height='170px';this.nodes.chart.setAttribute('role','img');this.nodes.chart.setAttribute('aria-label',profile==='gesture'?'Raw probability history for ten gesture classes':'Reported velocity history with gaps for invalid samples');card.appendChild(this.nodes.chart);
  }
  render(profile,source,now=Date.now()){
    const id=typeof profile==='object'&&profile?profile.id:profile;
    this.lastRender=[profile,source,now];if(this.profile!==id)this.build(id);
    this.container.hidden=id!=='gesture'&&id!=='speed';if(this.container.hidden)return;
    const data=this.store.snapshot(now),n=this.nodes;
    n.source.textContent=({live:'LIVE device data',demo:'SYNTHETIC DEMO · generated samples',replay:'REPLAY · recorded data; timestamps are local replay receipt times',offline:'OFFLINE · retained samples only, no live data'})[source]||'UNKNOWN SOURCE · do not treat as live data';
    if(id==='gesture'){
      n.status.textContent=`Probabilities: ${freshness(data.probabilities)}`;n.status.className=data.probabilities?.stale?'fine stale':'fine';
      n.values.forEach((node,i)=>{node.textContent=data.probabilities?`${data.probabilities.values[i].toFixed(4)} (${(data.probabilities.values[i]*100).toFixed(1)}%)`:'—';});
      n.featureStatus.textContent=`Features: ${freshness(data.features)}`;n.featureStatus.className=data.features?.stale?'fine stale':'fine';
      n.features.forEach((node,i)=>{node.textContent=data.features?String(data.features.values[i]):'—';});draw(n.chart,this.store.probabilityHistory,true);
    }else{
      const r=data.velocity;n.status.textContent=freshness(r);n.status.className=r?.stale?'fine stale':'fine';
      n.speed.textContent=r?.valid?`${r.value.toFixed(3)} m/s${this.showKmh?` · ${(r.value*3.6).toFixed(3)} km/h`:''}${r.stale?' · STALE (last reported)':''}${source==='offline'?' · retained':''}`:r?'Unavailable · device reported invalid velocity':'Unavailable · awaiting velocity TLV';
      draw(n.chart,this.store.velocityHistory,false);
    }
  }
}
if(typeof module==='object'&&module.exports){module.exports=TelemetryStore;Object.assign(module.exports,{TelemetryStore,TelemetryPanels,GESTURES,FEATURES,LIMIT,STALE_MS});}
root.TelemetryPanels=TelemetryPanels;root.TelemetryStore=TelemetryStore;
})(typeof globalThis!=='undefined'?globalThis:this);
