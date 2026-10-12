/* Pinned MediaPipe inference runs away from serial/UI work. Project LICENSE. */
import {FilesetResolver,PoseLandmarker} from './vendor/mediapipe/vision_bundle.mjs';
let model=null;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const base=new URL('.',import.meta.url),vision=await FilesetResolver.forVisionTasks(new URL('vendor/mediapipe/wasm',base).href,true);
   model=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('models/pose_landmarker_lite.task',base).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:2,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false});
   postMessage({type:'ready',id:data.id});
  }else if(data.type==='frame'){
   if(!model)throw Error('Pose model is not loaded');const result=model.detectForVideo(data.bitmap,data.timestamp_ms);data.bitmap.close();postMessage({type:'result',id:data.id,poses:result.landmarks});
  }else if(data.type==='close'){model?.close();model=null;postMessage({type:'closed',id:data.id});}
 }catch(e){data.bitmap?.close();postMessage({type:'error',id:data.id,message:e.message});}
};
