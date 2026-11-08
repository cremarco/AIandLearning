/** The actual completed inline Flashcards take: honest native input profiles. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const RAW_SHA='da969907c7fc4024fe3006ee757cf6a698356c8f785e31b683f236c0da24e24c'
const OWNER='https://chatgpt.com/c/6af0d9a4-5c74-83ed-964c-6c065adff0a7',RESPONSE='0c19a03a-bd45-4d77-a0f5-163a7f61bb7a',BOOK='f8131615212f15aeb864847af774fc79184d22b1193bb5e5c5b99147aa7c9981'
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),finite=Number.isFinite,text=s=>typeof s==='string'&&!!s.trim(),near=(a,b,t=.01)=>finite(a)&&finite(b)&&Math.abs(a-b)<=t
const inside=(root,file)=>{const r=path.relative(path.resolve(root),path.resolve(file));return !!r&&!r.startsWith('..')&&!path.isAbsolute(r)}
const scope=raw=>{if(raw.key!=='widget-flashcard-inline-take1'||raw.slideId!=='S53DETAILFLASHCARD'||raw.ownerConversationUrl!==OWNER||raw.conversationUrl!==OWNER||raw.ownerResponseId!==RESPONSE||raw.book?.sha256!==BOOK||!raw.complete||raw.fixture||raw.frames?.length!==1196)throw Error('Only the actual completed original inline Flashcards take is qualified')}
const INLINE_READER_SHA='cbcce843d96f9865b14ae62152b3abe689cd659a96b08ed77955b8cb0175b80d'

/** Complete actual larger-viewport use of this same original response. */
export function validateInlineWidgetReader({capture,child,retake,item,sourceDirectory,readerDirectory,run,rootDirectory=ROOT,exclusions=[]}) {
  if(item&&(item.key!=='widget-flashcard'||item.service!=='ChatGPT'||item.slideId!=='S53DETAILFLASHCARD'))throw Error('Inline Widget reader is limited to its actual approved scenario')
  const rawDir=path.resolve(rootDirectory,capture.immutableRawSource?.directory||''),rawFile=path.join(rawDir,'capture.json'),readerFile=path.join(readerDirectory,'capture.json')
  if(!inside(run,rawDir)||!inside(run,readerDirectory)||!fs.existsSync(rawFile)||sha(rawFile)!==RAW_SHA||!fs.existsSync(readerFile)||sha(readerFile)!==INLINE_READER_SHA)throw Error('Exact original Widget parent and completed native reader are required')
  if(!same(child,read(readerFile)))throw Error('Reader metadata must equal its frozen actual source')
  const raw=read(rawFile);scope(raw)
  if(capture.key!==raw.key||capture.slideId!==raw.slideId||capture.ownerConversationUrl!==OWNER||capture.ownerResponseId!==RESPONSE||capture.book?.sha256!==BOOK||capture.started!==raw.started||!capture.complete||capture.truncated!==false)throw Error('Actual reviewed original Widget identity must be preserved')
  const e=child.evidence,v=child.sourceViewport,observed=child.actualViewportObservation
  if(child.key!=='widget-flashcard-inline-reader-take2'||!child.complete||child.truncated||child.fixture||child.service!=='ChatGPT'||child.slideId!=='S53DETAILFLASHCARD'||child.newChat!==false||child.ownerConversationUrl!==OWNER||child.conversationUrl!==OWNER||child.ownerResponseId!==RESPONSE||child.book?.sha256!==BOOK||child.sourceBookSha256!==BOOK||child.parentCaptureKey!==raw.key||child.immutableRawParent?.captureSha256!==RAW_SHA||path.resolve(rootDirectory,child.immutableRawParent.directory)!==rawDir||e?.nativeInlineWidgetReader!==true||e.parentCaptureKey!==raw.key||e.ownerConversationUrl!==OWNER||e.ownerResponseId!==RESPONSE||e.sharedUrl!=='https://chatgpt.com/s/t_6af0e4033d448191a60771c983d47b9a'||child.actualViewportMeasuredBeforeRecording!==true||v?.width!==1440||v.height!==900||v.deviceScaleFactor!==2||!['width','height','deviceScaleFactor'].every(k=>v[k]===observed?.[k])||child.frames.length!==274||child.actions.length!==15)throw Error('Native Widget reader owner/book/original-response/actual-viewport binding mismatch')
  const delta=child.started-capture.started,windows=child.recordingWindows||[],end=Math.max(...windows.map(w=>w.end))
  if(!(delta>raw.durationMs)||!windows.length||windows.some(w=>!finite(w.start)||!finite(w.end)||w.end<w.start||w.failure)||end!==110563)throw Error('Use actual closed native reader windows, never its later off-recorder annotation time')
  if(retake?.kind!=='native-inline-widget-reader'||retake.origin?.captureSha256!==INLINE_READER_SHA||path.resolve(rootDirectory,retake.origin.capturePath)!==path.resolve(readerDirectory)||retake.origin.key!==child.key||retake.origin.started!==child.started||retake.deltaMs!==delta||retake.replaceFrom!==3461746||retake.joinAt!==delta+Math.min(...child.frames.map(f=>f.at))||retake.retainedEndAt!==delta+end||capture.durationMs!==retake.retainedEndAt||retake.ownerResponseId!==RESPONSE||retake.doesNotSupplyResult!==true||retake.suppliesOnlyNativeUseEvidence!==true||retake.resultSha256||retake.childResult||retake.resultProof||child.resultSha256||e.resultExport||e.resultSha256||!text(retake.reviewedBy)||!text(retake.reason))throw Error('Saved Widget use replacement must retain actual chronological source and original result identity')
  const replacement=exclusions.find(r=>[2135612,3461746].includes(r.start)&&r.end>=retake.joinAt&&text(r.reason))
  if(!replacement)throw Error('The old occluded Widget usage and actual wait must be wholly excluded')
  const copied=capture.frames.filter(f=>f.nativeRetakeOrigin?.captureSha256===INLINE_READER_SHA)
  if(copied.length!==274||capture.frames.length!==raw.frames.length+274||capture.actions.length!==raw.actions.length+15)throw Error('Retain every original source frame/action and append only the complete actual reader')
  for(const f of child.frames) {
    const saved=copied.find(x=>x.nativeRetakeOrigin.file===f.file&&x.nativeRetakeOrigin.sourceAt===f.at),native=path.join(readerDirectory,f.file),actual=saved&&path.resolve(sourceDirectory,saved.file),vp=saved?.viewport,bytes=fs.readFileSync(native)
    if(!saved||saved.at!==Math.round(f.timestamp*1000-capture.started)||saved.timestamp!==f.timestamp||!inside(sourceDirectory,actual)||sha(actual)!==sha(native)||saved.nativeRetakeOrigin.sha256!==sha(native)||vp?.width!==1440||vp.height!==900||vp.deviceScaleFactor!==2||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==2880||bytes.readUInt32BE(20)!==1800)throw Error('Original reader pixels/absolute clocks/measured viewport changed')
  }
  for(const w of windows) {
    const saved=capture.recordingWindows.find(s=>s.nativeRetakeOrigin?.captureSha256===INLINE_READER_SHA&&s.nativeRetakeOrigin.windowId===w.id)
    if(!saved||saved.start!==w.start+delta||saved.end!==w.end+delta||saved.closedBy!==w.closedBy)throw Error('Native reader recording-window clocks changed')
  }
  for(const original of child.actions) {
    const saved=capture.actions.find(a=>a.nativeRetakeOrigin?.captureSha256===INLINE_READER_SHA&&a.nativeRetakeOrigin.sourceAt===original.at&&a.nativeRetakeOrigin.label===original.label)
    if(!saved||saved.at!==original.at+delta)throw Error('Original native reader action/clock missing')
    for(const k of ['kind','label','click','clickSource','nativeHitTestPassed','state'])if(!same(saved[k],original[k]))throw Error('Original native reader input proof changed')
    if(original.kind==='click') {
      const b=original.click?.bounds,p=original.click,post=child.frames.find(f=>f.file===original.nativeStateFrame)
      if(original.clickSource!=='native-cdp-mouse-input'||original.nativeHitTestPassed!==true||original.nativeInputRequestedAt!==original.at||!finite(original.nativeInputConfirmedAt)||original.nativeInputConfirmedAt<original.at||!b||![p.x,p.y,b.left,b.top,b.right,b.bottom].every(finite)||p.x<b.left||p.x>b.right||p.y<b.top||p.y>b.bottom||b.left<0||b.top<0||b.right>1440||b.bottom>900||!post||post.at<original.nativeInputConfirmedAt||saved.nativeInputRequestedAt!==original.nativeInputRequestedAt+delta||saved.nativeInputConfirmedAt!==original.nativeInputConfirmedAt+delta)throw Error('Actual genuine native CDP reader click and post-state are required')
      if(saved.nativeStateFrame!==copied.find(f=>f.nativeRetakeOrigin.file===original.nativeStateFrame)?.file)throw Error('Native reader action post-frame changed')
    }
  }
  const wheelFile=path.join(readerDirectory,'native-wheel-callback-proof.json'),proof=read(wheelFile),wheel=child.actions.find(a=>a.at===106667),timing=child.stepTimings.find(s=>s.actionIndex===14),observations=read(path.join(readerDirectory,'native-use-observations.json')),before=observations.find(o=>o.label===proof.beforeObservationLabel),after=observations.find(o=>o.label===proof.afterObservationLabel)
  if(proof.schemaVersion!==1||proof.sourceCaptureSha256!==INLINE_READER_SHA||proof.method!=='root-executed-native-CDP-mouseWheel-callback'||proof.actualCommand!=='Input.dispatchMouseEvent'||!same(proof.actualArguments,{type:'mouseWheel',x:1100,y:430,deltaX:0,deltaY:240})||proof.rawActionAt!==106667||proof.rawActionLabel!==wheel?.label||wheel.kind!==undefined||wheel.click!==undefined||!same(proof.rawStepTiming,timing)||proof.rawKindWasAbsent!==true||proof.rawSourceModified!==false||proof.clickMarkerClaimed!==false||!same(proof.actualUiBefore,before?.widgetBounds)||!same(proof.actualUiAfter,after?.widgetBounds)||!child.frames.some(f=>f.file===after.frame&&f.at>=timing.functionEndedAt)||after.widgetBounds.bottom>900||after.widgetBounds.top<0)throw Error('Native wheel callback needs its actual immutable action, callback bracket and recorded UI outcome; never invent a source kind/marker')
  return {kind:'native-inline-widget-reader',readerCaptureSha256:INLINE_READER_SHA,sourceFrames:274,nativeCdpClicks:14,actualRecordedEndAt:110563,laterOffRecorderNativeUseAnnotationAt:171554,annotationTailNotUsedAsReading:true,ownerResponseId:RESPONSE,originalResultRetained:true,doesNotSupplyResult:true,unmarkedActions:[{sourceActionAt:delta+106667,label:wheel.label,markerEligible:false,markerMeaning:null,clickSource:'root-recorded-native-CDP-mouseWheel-callback',sourceKindWasAbsent:true,actualCallbackProofSha256:sha(wheelFile),exactDeliveredPointerCoordinatesExposed:false,omissionReason:'The real native wheel callback has no click marker or delivered pointer trace. Its raw action kind remains absent; actual callback brackets and UI displacement are retained.'}]}
}

/** No browser calls. Coordinate-free actions remain coordinate-free. */
export function qualifyRootWidgetAction({raw,action}) {
  scope(raw)
  const original=raw.actions.find(a=>a.at===action.at&&a.label===action.label)
  if(!original||Object.keys(original).some(k=>!same(original[k],action[k])))throw Error('Original widget input metadata must remain unchanged')
  if(action.kind!=='click'||!['native-cua-accessibility-click','documented-browser-locator-click'].includes(action.clickSource))throw Error('Not a recorded root semantic activation')
  if(!action.click) {
    const approved=new Map([[2131455,['Expand the complete prompt for reading',62]],[2134269,['Send the complete request',58]]]),expected=approved.get(action.at)
    if(!expected||action.label!==expected[0]||action.nativeTargetIndex!==expected[1]||action.clickSource!=='native-cua-accessibility-click'||action.deliveredPointerCoordinatesExposed!==false||!text(action.state)||!finite(action.actualActionEndAt)||action.actualActionEndAt<action.at||!finite(action.stepEndedAt)||action.stepEndedAt<action.actualActionEndAt||action.nativeTargetHitTest||action.nativeAccessibility||action.nativeCDPPressReleaseSent===true)throw Error('Only the two actual coordinate-free native prompt activations may omit markers')
    return {sourceActionAt:action.at,label:action.label,clickSource:action.clickSource,markerEligible:false,markerMeaning:null,exactDeliveredPointerCoordinatesExposed:false,domGeometryRetained:false,accessibilitySnapshotRetained:false,omissionReason:'Actual native accessibility activation recorded without target geometry. No pointer coordinates or marker are reconstructed.'}
  }
  const p=action.nativeTargetHitTest,t=p?.stabilityTolerancePx
  if(!finite(t)||t<0||t>.75||action.deliveredPointerCoordinatesExposed!==false||action.nativeCDPPressReleaseSent!==false||action.clickCoordinateSource!=='fresh-hit-tested-native-target-center; exact delivered pointer coordinates are not exposed'||action.markerReviewRequired!==true||action.nativeInputRequestedAt!==action.at||!finite(action.nativeInputConfirmedAt)||action.nativeInputConfirmedAt<action.at)throw Error('Root widget control-centre input contract is incomplete or claims delivered coordinates')
  for(const s of [p.first,p.second]) {
    const b=s?.bounds,v=s?.viewport
    if(!b||!v||![b.left,b.top,b.right,b.bottom,b.width,b.height,s.x,s.y,v.width,v.height].every(finite)||b.width<=0||b.height<=0||b.left<0||b.top<0||b.right>v.width||b.bottom>v.height||!near(b.right-b.left,b.width)||!near(b.bottom-b.top,b.height)||!near(s.x,b.left+b.width/2)||!near(s.y,b.top+b.height/2)||s.hitPassed!==true||s.disabled!==false||v.width!==raw.sourceViewport.width||v.height!==raw.sourceViewport.height)throw Error('Two actual visible enabled root DOM hits are required')
  }
  for(const k of ['x','y'])if(!near(p.first[k],p.second[k],t)||!near(action.click[k],p.second[k]))throw Error('Root target centre moved or differs from its marker')
  for(const k of ['left','top','right','bottom','width','height'])if(!near(p.first.bounds[k],p.second.bounds[k],t)||!near(action.click.bounds[k],p.second.bounds[k]))throw Error('Root target geometry changed')
  if(action.nativeFrameHitTest)throw Error('Root input must not claim an iframe profile')
  if(action.clickSource==='native-cua-accessibility-click') {
    const ax=action.nativeAccessibility
    if(!ax||!Number.isInteger(ax.index)||!['button','text entry area'].includes(ax.role)||!text(ax.name)||!text(ax.line)||!ax.line.startsWith(ax.index+' '+ax.role)||!ax.line.includes(ax.name)||!/^[a-f0-9]{64}$/.test(ax.snapshotSha256||'')||ax.freshlyReadBeforeClick!==true)throw Error('Actual native accessibility input needs its recorded fresh AX label/index/hash')
  } else if(action.nativeAccessibility)throw Error('Documented locator profile must not invent an accessibility snapshot')
  const post=raw.frames.find(f=>f.file===action.nativeStateFrame)
  if(!post||post.at<action.nativeInputConfirmedAt)throw Error('Actual post-input native frame is required')
  return {sourceActionAt:action.at,label:action.label,clickSource:action.clickSource,markerEligible:true,markerMeaning:'activated-control-center',exactDeliveredPointerCoordinatesExposed:false,twoFreshDomHitsRetained:true,accessibilityLabelAndSnapshotHashRetained:action.clickSource==='native-cua-accessibility-click',fullAccessibilitySnapshotRetained:false,nativeStateFrame:post.file,disclosure:'Measured centre of the actual native control activated by the recorded accessibility or documented locator input. Exact delivered pointer coordinates are not exposed.'}
}

/** Only the eleven original pre-step empty-composer frames, with root-reviewed privacy crop. */
export function qualifyNativeEmptyWidgetIntro({capture,raw,rawDirectory,sourceDirectory,exclusions}) {
  const review=capture.nativeEmptyChatStartReview
  if(!review)return null
  scope(raw)
  const crop=[540,0,2124,810],frames=raw.frames.filter(f=>f.at>=93&&f.at<894),firstStep=raw.stepTimings[0],firstAction=raw.actions[0],framing=read(path.join(sourceDirectory,'framing.json'))
  if(review.schemaVersion!==1||review.rawCaptureSha256!==RAW_SHA||review.start!==93||review.end!==894||review.firstStepRequestedAt!==894||review.firstActualNativeInputAt!==1050||!same(review.cropPixels,crop)||review.rootCropApprovalObserved!==true||review.sourcePixelsActionsAndClocksUnchanged!==true||!text(review.reviewedBy)||!text(review.reason)||!capture.nativeUsageRetakes?.some(r=>r.kind==='native-inline-widget-reader'&&r.origin.captureSha256===INLINE_READER_SHA)||firstStep.requestedStartAt!==894||firstStep.functionStartedAt!==894||firstAction.at!==1050||firstAction.nativeInputRequestedAt!==1050||frames.length!==11||review.frames?.length!==11||exclusions.some(r=>r.start<894&&r.end>93)||!exclusions.some(r=>r.start===894&&r.end>=1987504))throw Error('Empty Widget intro is limited to its exact actual pre-step interval and approved privacy crop')
  for(const [i,f]of frames.entries()) {
    const ref=review.frames[i],original=path.join(rawDirectory,f.file),copy=path.join(sourceDirectory,f.file)
    if(ref.file!==f.file||ref.at!==f.at||ref.sha256!==sha(original)||sha(copy)!==ref.sha256||!same(framing.frameCropPixels?.[f.file],crop)||!raw.recordingWindows.some(w=>w.start<=f.at&&f.at<=w.end)||Math.round(f.timestamp*1000-raw.started)!==f.at)throw Error('Actual pre-step native frame bytes, timestamps or approved privacy crop changed')
  }
  return {kind:'actual-native-empty-widget-pre-step-intro',rawCaptureSha256:RAW_SHA,start:93,end:894,actualSourceMilliseconds:801,maximumOutputSecondsAt3x:.267,frames:review.frames,cropPixels:crop,firstRequestedStepExcludedAt:894,firstNativeInputExcludedAt:1050,staticFrameOrExtraReadHoldCreated:false,rootCropApprovalObserved:true,personalHomeSuggestionsOutsideReviewedCrop:true,reviewedBy:review.reviewedBy,reason:review.reason}
}

export function qualifyRootWidgetTechnicalRetake({capture,sourceDirectory,exclusions,rootDirectory=ROOT}) {
  const origin=capture.immutableRawSource,rawDir=path.resolve(rootDirectory,origin?.directory||''),file=path.join(rawDir,'capture.json'),source=path.resolve(sourceDirectory),run=path.dirname(path.dirname(source))
  if(!origin||origin.captureSha256!==RAW_SHA||!inside(path.join(rootDirectory,'output/review/video-refresh'),source)||!inside(run,rawDir)||rawDir===source||!fs.existsSync(file)||sha(file)!==RAW_SHA)throw Error('Exact immutable widget raw source is required')
  const raw=read(file);scope(raw)
  const inlineRetake=capture.nativeUsageRetakes?.find(r=>r.kind==='native-inline-widget-reader'),readerDirectory=inlineRetake&&path.resolve(rootDirectory,inlineRetake.origin.capturePath),inlineReader=inlineRetake?validateInlineWidgetReader({capture,child:read(path.join(readerDirectory,'capture.json')),retake:inlineRetake,sourceDirectory,readerDirectory,run,rootDirectory,exclusions}):null
  const emptyIntro=qualifyNativeEmptyWidgetIntro({capture,raw,rawDirectory:rawDir,sourceDirectory,exclusions}),review=capture.nativeWidgetRetakeReview
  if(origin.key!==raw.key||origin.sourceFrames!==1196||review?.schemaVersion!==1||review.rawCaptureSha256!==RAW_SHA||!text(review.reviewedBy)||!text(review.reason)||review.originalTruncated!==true||review.rawCaptureComplete!==true||review.sourcePixelsActionsAndClocksUnchanged!==true||!same(review.inheritedCaptureOpsFailure,raw.captureOpsFailure)||raw.truncated!==true||capture.truncated!==false||review.selectedDurationMs!==4782429||(!inlineReader&&capture.durationMs!==4782429)||capture.evidence?.nativeUsageEndAt!==4782429||!capture.complete)throw Error('Reviewed selected continuation must explicitly retain the historical truncation/failure provenance')
  for(const k of ['key','slideId','ownerConversationUrl','conversationUrl','ownerResponseId','book','started','startedAt','sourceViewport','failures','captureOpsFailure',...(!inlineReader?['recordingWindows','stepTimings','deliberateHolds']:[])])if(!same(capture[k],raw[k]))throw Error('Widget review changed original source metadata: '+k)
  if(inlineReader)for(const k of ['recordingWindows','stepTimings','deliberateHolds'])if(!raw[k].every((v,i)=>same(v,capture[k]?.[i])))throw Error('Original widget recorder metadata must remain intact before appended reader: '+k)
  if(!inlineReader&&(capture.frames?.length!==raw.frames.length||capture.actions?.length!==raw.actions.length))throw Error('Keep all original frames/actions in the review source')
  for(const f of raw.frames){const saved=capture.frames.find(s=>s.file===f.file);if(!saved||Object.keys(f).some(k=>!same(f[k],saved[k])))throw Error('Original widget frame clocks/metadata changed')}
  for(const a of raw.actions){const saved=capture.actions.find(s=>s.at===a.at&&s.label===a.label);if(!saved||Object.keys(a).some(k=>!same(a[k],saved[k])))throw Error('Original widget action proof changed')}
  if(!Array.isArray(exclusions)||!Array.isArray(review.excludedRanges)||!review.excludedRanges.length)throw Error('Selected source and final render require explicit exclusions')
  for(const r of review.excludedRanges)if(!text(r.reason)||!text(r.reviewedBy)||!finite(r.start)||!finite(r.end)||!(r.end>r.start)||!exclusions.some(e=>(e.start===r.start&&(e.requestedEnd??e.end)===r.end&&e.end>=r.end&&e.reason===r.reason)||(inlineReader&&[2135612,3461746].includes(e.start)&&e.end>=inlineRetake.joinAt&&r.start>=e.start&&r.end<=4782429)))throw Error('Widget final render omitted a reviewed technical exclusion')
  if(!review.excludedRanges.some(r=>r.start===(emptyIntro?894:0)&&r.end===1987504))throw Error('Complete failed upload prefix must be explicitly omitted')
  const first=raw.frames.find(f=>f.file==='000131.png'&&f.at===1987504),clean=review.firstCleanFrame
  if(!first||clean?.file!==first.file||clean.at!==first.at||clean.sha256!==sha(path.join(rawDir,first.file))||sha(path.join(source,first.file))!==clean.sha256)throw Error('Reviewed continuation must begin at the actual first clean native PNG')
  const omitted=at=>exclusions.some(r=>r.start<=at&&at<r.end)
  if(raw.failures.length!==1||raw.failures[0].at!==5706||!raw.failures[0].message.startsWith('Timed out after 3000ms evaluating selector internal:role=button')||!raw.failures.every(f=>omitted(f.at))||!raw.stepTimings.filter(s=>s.failure).every(s=>omitted(s.requestedStartAt)))throw Error('A selected failure cannot be hidden by the historical upload-prefix review')
  if(!inlineReader&&!exclusions.some(r=>r.start===4773696&&r.end>=4782429))throw Error('The actual recorder-off final tail must not become invented reading time')
  return {raw,rawDirectory:rawDir,inlineReader,technicalReview:{kind:'native-root-widget-reviewed-continuation',rawCaptureSha256:RAW_SHA,originalTruncated:true,rawCaptureComplete:true,firstRetainedNativeFrame:clean,selectedDurationMs:4782429,lastActuallyRecordedWindowEndAt:4773696,...(emptyIntro?{emptyChatStart:emptyIntro}:{}),allSelectedFailuresExcluded:true,originalActionsFramesAndClocksRetained:true,reviewedBy:review.reviewedBy,reason:review.reason}}
}

export function qualifyRootWidgetRenderActions(args) {
  const {capture,sourceDirectory,exclusions}=args,{raw,rawDirectory,technicalReview,inlineReader}=qualifyRootWidgetTechnicalRetake(args),omitted=at=>exclusions.some(r=>r.start<=at&&at<r.end),qualifications=[]
  for(const action of capture.actions) {
    if(omitted(action.at)||action.at>=capture.durationMs||!['native-cua-accessibility-click','documented-browser-locator-click'].includes(action.clickSource)||action.kind!=='click')continue
    const proof=qualifyRootWidgetAction({raw,action})
    if(proof.markerEligible){const a=path.join(rawDirectory,proof.nativeStateFrame),b=path.join(sourceDirectory,proof.nativeStateFrame);if(sha(a)!==sha(b))throw Error('Original root widget post-input pixels changed');proof.nativeStateFrameSha256=sha(a)}
    qualifications.push(proof)
  }
  if(inlineReader)qualifications.push(...inlineReader.unmarkedActions)
  return {kind:'native-root-widget-input-evidence',technicalReview,qualifications,...(inlineReader?{inlineReader}:{}),coordinateFreeMarkersInvented:false,iframeInputClaimed:false}
}
