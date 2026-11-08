/** Frozen Learning recorder callbacks with no recorded pointer type or point. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {validateNativeLearningPreviewRetake} from './native-learning-preview-retake.mjs'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),RAW='138235b7a66d7da92e7baa44b41619a7eec1b9eb53b5a6d35704555c1c47dd04',CHILD='7ee0c6e915e2ecb411f5971a7fca70ceb91de8ddae0b6d63c6caad1e683ea57c'
const read=f=>JSON.parse(fs.readFileSync(f)),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),finite=Number.isFinite
const CHILD_ATS=[780769,782401,787013,791298,804556,812833,817021,832600,838777,845356]
export function qualifyLearningRecordedOperations({capture,sourceDirectory,rootDirectory=ROOT,exclusions=[]}) {
 const run=path.dirname(path.dirname(sourceDirectory)),retake=capture.nativeUsageRetakes?.find(r=>r.kind==='native-work-learning-original-preview-retake'),retakeDirectory=retake&&path.resolve(rootDirectory,retake.origin.capturePath),rawDirectory=path.resolve(rootDirectory,capture.immutableRawSource?.directory||''),raw=read(path.join(rawDirectory,'capture.json')),child=retakeDirectory&&read(path.join(retakeDirectory,'capture.json')),item=read(path.join(run,'inventory.json')).items.find(i=>i.key==='skills-the-learning-skill')
 validateNativeLearningPreviewRetake({capture,child,retake,item,sourceDirectory,retakeDirectory,run,rootDirectory,renderExcludedRanges:exclusions})
 const qualifications=[]
 for(const [original,dir,hash,ats,delta] of [[raw,rawDirectory,RAW,[932981],0],[child,retakeDirectory,CHILD,CHILD_ATS,retake.deltaMs]])for(const at of ats){
  const originalIndex=original.actions.findIndex(a=>a.at===at),a=original.actions[originalIndex],saved=capture.actions.find(s=>s.at===at+delta),timing=original.stepTimings.find(s=>s.actionIndex===originalIndex),window=original.recordingWindows.find(w=>w.id===timing?.recordingWindowId),post=original.frames.find(f=>f.at>=timing?.functionEndedAt&&f.at<=window?.end)
  if(!a||!saved||Object.hasOwn(a,'kind')||Object.hasOwn(saved,'kind')||a.click||saved.click||a.clickSource||saved.clickSource||!same(saved.state,a.state)||!same(saved.label,a.label)||!same(saved.requestedHoldMs,a.requestedHoldMs)||saved.actualActionEndAt!==a.actualActionEndAt+delta||saved.stepEndedAt!==a.stepEndedAt+delta)throw Error('Only the exact eleven genuine kind-absent Learning recorder callbacks are qualified')
  if(!timing||timing.failure||timing.label!==a.label||timing.requestedStartAt!==at||timing.functionStartedAt!==at||timing.functionEndedAt!==a.actualActionEndAt||timing.stepEndedAt!==a.stepEndedAt||![timing.requestedStartAt,timing.functionStartedAt,timing.functionEndedAt,timing.stepEndedAt].every(finite)||timing.functionEndedAt<at||timing.stepEndedAt<timing.functionEndedAt||!window||window.failure||window.start>at||window.end<timing.stepEndedAt||!post)throw Error('Actual closed recorder window, awaited callback bracket and native post-state PNG are required')
  const origin=saved.nativeRetakeOrigin
  if(delta&&(!origin||origin.captureSha256!==CHILD||origin.sourceAt!==at||origin.label!==a.label))throw Error('Original Learning callback lineage changed')
  const copy=delta?capture.frames.find(f=>f.nativeRetakeOrigin?.captureSha256===CHILD&&f.nativeRetakeOrigin.file===post.file&&f.nativeRetakeOrigin.sourceAt===post.at):capture.frames.find(f=>f.file===post.file&&f.at===post.at)
  if(!copy||sha(path.join(sourceDirectory,copy.file))!==sha(path.join(dir,post.file)))throw Error('Actual recorded callback outcome pixels changed')
  qualifications.push({sourceActionAt:saved.at,parentSourceAt:saved.at,eligibleUnmarked:true,originalSourceAt:at,label:a.label,rawCaptureSha256:hash,profile:'frozen-native-recorded-callback-without-pointer-type',rawKindWasAbsent:true,rawKindPreserved:true,markerEligible:false,markerMeaning:null,inputMechanismInferred:false,exactDeliveredPointerCoordinatesExposed:false,actualCallback:{requestedStartAt:at,functionStartedAt:timing.functionStartedAt,functionEndedAt:timing.functionEndedAt,stepEndedAt:timing.stepEndedAt,recordingWindowId:window.id},postNativeFrame:copy.file,postNativeFrameMayFollowLaterOperation:true,isolatedOutcomeFrameClaimed:false,postNativeFrameSha256:sha(path.join(dir,post.file)),disclosure:'The original recorder retained an awaited native operation, its accessibility outcome and subsequent native context pixels without an action kind or pointer point. That absence is preserved. No click type, input mechanism, coordinates or marker are inferred.'})
 }
 return {kind:'learning-frozen-recorded-operations',rawParentSha256:RAW,childCaptureSha256:CHILD,qualifications,coordinateFreeMarkersInvented:false,rawKindsRetagged:false,recipientVerificationGranted:false}
}
