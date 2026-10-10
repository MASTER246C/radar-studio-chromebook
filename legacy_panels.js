/* First-party, read-only display for the TI 68xx high-accuracy Level Sensing layout.
 * Field evidence: radar_toolbox_4_00_00_05 high_accuracy/src/68xx/mss/mss_main.c,
 * dss/dss_data_path.c, and common/radarProcess.h. No vendor code is included.
 * The FFT-input payload is not a range spectrum. No FFT or distance-axis mapping
 * is performed here. Three range fields do not establish three tracked targets.
 */
(function(root){
'use strict';
const HISTORY_LIMIT=150, FFT_SAMPLE_LIMIT=1024, STALE_MS=5000;
const RANGE_LABELS=Object.freeze(['Primary estimate (rangeEst)','Auxiliary estimate 1 (rangeEst1)','Auxiliary estimate 2 (rangeEst2)']);
const RANGE_COLORS=Object.freeze(['#65decd','#74a7ff','#ffcf76']);
const SOURCES=Object.freeze({live:'LIVE device data',demo:'SYNTHETIC DEMO · generated samples',replay:'REPLAY · recorded data; timestamps are local replay receipt times',offline:'OFFLINE · retained samples only, no live data'});
const validTime=value=>Number.isFinite(value)&&Math.abs(value)<=8640000000000000;
function validLevel(level){
  return level&&level.qFormat===20&&Array.isArray(level.rangesMeters)&&level.rangesMeters.length===3&&
    level.rangesMeters.every(value=>Number.isFinite(value)&&value>=-2048&&value<2048);
}
function validFft(input){
  return input&&Number.isInteger(input.sampleCount)&&input.sampleCount>0&&input.sampleCount<=FFT_SAMPLE_LIMIT&&
    Array.isArray(input.samples)&&input.samples.length===input.sampleCount&&
    input.samples.every(sample=>sample&&Number.isFinite(sample.real)&&Number.isFinite(sample.imag)&&Number.isFinite(Math.hypot(sample.real,sample.imag)));
}
class LegacyStore {
  constructor(){this.reset();}
  reset(){
    this.level=null;this.fftInput=null;this.rangeHistory=[];this.levelCount=0;this.fftCount=0;
    // Suppress ingestion of the same decoded object, not distinct received packets.
    // Firmware fixes frameNumber at zero, and CPU counters wrap. Neither is a safe
    // duplicate key. WeakSets hold no strong references to old decoded payloads.
    this.seenLevel=new WeakSet();this.seenFft=new WeakSet();
  }
  clear(){this.reset();}
  ingest(frames,receivedAt=Date.now()){
    if(!validTime(receivedAt)||!Array.isArray(frames))return;
    for(const frame of frames){
      if(!frame||typeof frame!=='object'||frame.profile!=='level')continue;
      const metadata={receivedAt,frameNumber:Number.isInteger(frame.frameNumber)?frame.frameNumber:null};
      if(validLevel(frame.level)&&!this.seenLevel.has(frame)){
        this.seenLevel.add(frame);
        const record=Object.freeze({...metadata,receiptNumber:++this.levelCount,qFormat:20,rangesMeters:Object.freeze(frame.level.rangesMeters.slice())});
        this.level=record;this.rangeHistory.push(record);
        if(this.rangeHistory.length>HISTORY_LIMIT)this.rangeHistory.shift();
      }
      if(validFft(frame.fftInput)&&!this.seenFft.has(frame)){
        this.seenFft.add(frame);
        const samples=frame.fftInput.samples.map(sample=>Object.freeze({real:sample.real,imag:sample.imag}));
        this.fftInput=Object.freeze({...metadata,receiptNumber:++this.fftCount,sampleCount:samples.length,
          samples:Object.freeze(samples),magnitudes:Object.freeze(samples.map(sample=>Math.hypot(sample.real,sample.imag)))});
      }
    }
  }
  snapshot(now=Date.now()){
    if(!validTime(now))now=Date.now();
    const describe=record=>record?{...record,ageMs:Math.max(0,now-record.receivedAt),stale:now-record.receivedAt>STALE_MS}:null;
    return {level:describe(this.level),fftInput:describe(this.fftInput)};
  }
}
function element(doc,tag,text,className){
  const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;
}
function freshness(record){
  return record?`${record.stale?'STALE · ':''}Received ${new Date(record.receivedAt).toISOString()} · ${(record.ageMs/1000).toFixed(1)} s ago · local sample ${record.receiptNumber}`:'Awaiting this payload; no sample received.';
}
function number(value){
  if(value===0)return '0';
  return Math.abs(value)>=100000||Math.abs(value)<0.0001?value.toExponential(2):Number(value.toPrecision(5)).toString();
}
function axes(canvas,values,xLabel,yLabel){
  const ctx=canvas.getContext&&canvas.getContext('2d');if(!ctx)return null;
  const w=canvas.width=640,h=canvas.height=190,left=70,right=20,top=30,bottom=38;
  let min=Math.min(0,...values),max=Math.max(0,...values);
  if(min===max)max=min+1;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#263447';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();
  ctx.fillStyle='#92a4bb';ctx.font='10px system-ui';
  ctx.fillText(yLabel,left,14);ctx.fillText(number(max),2,top+4);ctx.fillText(number(min),2,h-bottom);
  ctx.fillText(xLabel,left,h-8);
  return {ctx,x:(index,count)=>left+index*(w-left-right)/Math.max(1,count-1),y:value=>h-bottom-(value-min)/(max-min)*(h-top-bottom)};
}
function drawRanges(canvas,history){
  const plot=axes(canvas,history.flatMap(record=>record.rangesMeters),'Older receipt samples → newer receipt samples','Reported range (m)');
  if(!plot)return;
  for(let slot=0;slot<3;slot++){
    plot.ctx.fillStyle=RANGE_COLORS[slot];
    history.forEach((record,index)=>plot.ctx.fillRect(plot.x(index,history.length)-2,plot.y(record.rangesMeters[slot])-2,4,4));
  }
}
function drawFftInput(canvas,record){
  const values=record?record.magnitudes:[],lastIndex=values.length?values.length-1:'—';
  const plot=axes(canvas,values,`Input sample index: 0 … ${lastIndex}`,'Complex input magnitude (raw units)');
  if(!plot)return;
  const ctx=plot.ctx;ctx.strokeStyle=RANGE_COLORS[0];ctx.fillStyle=RANGE_COLORS[0];ctx.lineWidth=1.4;ctx.beginPath();
  values.forEach((value,index)=>{
    const x=plot.x(index,values.length),y=plot.y(value);if(index)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    ctx.fillRect(x-1,y-1,2,2);
  });ctx.stroke();
}
class LegacyPanels {
  constructor(container){
    if(!container)throw new Error('Legacy panel container required');
    this.container=container;this.store=new LegacyStore();this.profile=null;this.nodes={};
  }
  ingest(frames,receivedAt){this.store.ingest(frames,receivedAt);}
  reset(){this.store.reset();this.profile=null;this.nodes={};this.container.replaceChildren();this.container.hidden=true;}
  build(profile){
    this.profile=profile;this.nodes={};const box=this.container,doc=box.ownerDocument;box.replaceChildren();
    if(profile!=='level')return;
    const card=element(doc,'section',undefined,'plot-card');card.style.padding='16px';box.appendChild(card);
    card.appendChild(element(doc,'h2','Level Sensing · reported range fields · experimental'));
    this.nodes.source=element(doc,'p','','notice');card.appendChild(this.nodes.source);
    card.appendChild(element(doc,'p','Read-only device estimates. This payload provides no validity or confidence flags. Auxiliary fields are raw estimates, not persistent target identities. No tank-level, volume, safety decision, or device control is derived.','fine'));
    this.nodes.status=element(doc,'p','','fine');card.appendChild(this.nodes.status);
    const grid=element(doc,'div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px';card.appendChild(grid);
    this.nodes.ranges=RANGE_LABELS.map((label,index)=>{
      const row=element(doc,'div');row.style.color=RANGE_COLORS[index];row.appendChild(element(doc,'div',label));
      const value=element(doc,'strong','Unavailable');value.style.fontSize='22px';row.appendChild(value);grid.appendChild(row);return value;
    });
    card.appendChild(element(doc,'p','Decoded signed Q20 values are shown in meters. Displayed digits are not a measurement-accuracy claim. A reported zero or negative value is retained without inventing a validity flag.','fine'));
    this.nodes.historyStatus=element(doc,'p','','fine');card.appendChild(this.nodes.historyStatus);
    this.nodes.rangeChart=element(doc,'canvas');this.nodes.rangeChart.style.height='190px';this.nodes.rangeChart.setAttribute('role','img');
    this.nodes.rangeChart.setAttribute('aria-label','Three reported range fields in meters, shown as individual receipt samples with colors matching the field labels');card.appendChild(this.nodes.rangeChart);
    card.appendChild(element(doc,'p','History follows local receipt order. The device frame field can remain zero. Points are individual received estimates; no interpolation or target association is applied.','fine'));
    card.appendChild(element(doc,'h3','Raw FFT-input magnitude'));
    this.nodes.fftStatus=element(doc,'p','','fine');card.appendChild(this.nodes.fftStatus);
    this.nodes.fftSummary=element(doc,'p','','fine');card.appendChild(this.nodes.fftSummary);
    this.nodes.fftChart=element(doc,'canvas');this.nodes.fftChart.style.height='190px';this.nodes.fftChart.setAttribute('role','img');
    this.nodes.fftChart.setAttribute('aria-label','Latest complex FFT-input magnitudes in raw units versus input sample index');card.appendChild(this.nodes.fftChart);
    card.appendChild(element(doc,'p',`Only the latest input vector is retained, up to ${FFT_SAMPLE_LIMIT} complex samples. Magnitude is √(real² + imaginary²), in raw units with unknown physical scale. The horizontal axis is the input sample index. No host FFT or physical-distance axis is applied. This is not a range spectrum.`,'fine'));
  }
  render(profile,source,now=Date.now()){
    const id=typeof profile==='object'&&profile?profile.id:profile;if(this.profile!==id)this.build(id);
    this.container.hidden=id!=='level';if(this.container.hidden)return;
    const data=this.store.snapshot(now),n=this.nodes;
    n.source.textContent=Object.hasOwn(SOURCES,source)?SOURCES[source]:'UNKNOWN SOURCE · do not treat as live data';
    n.status.textContent=`Range fields: ${freshness(data.level)}`;n.status.className=data.level?.stale?'fine stale':'fine';
    n.ranges.forEach((node,index)=>{node.textContent=data.level?`${data.level.rangesMeters[index].toFixed(6)} m${data.level.stale?' · STALE':''}${source==='offline'?' · retained':''}`:'Unavailable';});
    n.historyStatus.textContent=`${this.store.rangeHistory.length} retained range samples · last ${HISTORY_LIMIT} maximum · colors match field labels`;
    n.fftStatus.textContent=`FFT input: ${freshness(data.fftInput)}`;n.fftStatus.className=data.fftInput?.stale?'fine stale':'fine';
    n.fftSummary.textContent=data.fftInput?`${data.fftInput.sampleCount} complex input samples · maximum magnitude ${number(Math.max(...data.fftInput.magnitudes))} raw units${data.fftInput.stale?' · STALE (last received vector)':''}${source==='offline'?' · retained':''}`:'Unavailable · awaiting optional FFT-input payload';
    drawRanges(n.rangeChart,this.store.rangeHistory);drawFftInput(n.fftChart,data.fftInput);
  }
}
if(typeof module==='object'&&module.exports){module.exports=LegacyStore;Object.assign(module.exports,{LegacyStore,LegacyPanels,HISTORY_LIMIT,FFT_SAMPLE_LIMIT,STALE_MS,RANGE_LABELS,RANGE_COLORS});}
root.LegacyPanels=LegacyPanels;root.LegacyStore=LegacyStore;
})(typeof globalThis!=='undefined'?globalThis:this);
