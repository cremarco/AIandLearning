/** Offline evidence validation for the frozen original Learning Work capture.
 * The run path locates immutable proof data; no code from output/ is executed.
 * Historical producer module hashes remain provenance, not runtime imports.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {validateWorkUiIdentity,validateWorkSharedResult} from './work-ui-identity.mjs'
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
export const RUN=path.join(ROOT,'output/review/video-refresh/2026-11-07')
export const HERE=path.join(RUN,'producer-learning-recovery')
export const OWNER='https://chatgpt.com/c/6af08b8c-3ebc-83eb-a76c-1eb7a97d3d2d'
export const ORIGINAL_HOST='codex-inline-visualization-4b68803183f9f821.web-sandbox.oaiusercontent.com'
export const OBSERVED_DYNAMIC_HOST='codex-inline-visualization-8c47c91a5bf4d2aa.web-sandbox.oaiusercontent.com'
export const ORIGINAL_ARTIFACT={bytes:13548,sha256:'68d736e04bcf2b3142e7123126ba8ab61c78ba35b6e9293c423c9cf5e82ead39'}

export const RAW=path.join(RUN,'captures/skills-the-learning-skill-take1')
export const RAW_SHA='138235b7a66d7da92e7baa44b41619a7eec1b9eb53b5a6d35704555c1c47dd04'
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
export const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const hash=b=>createHash('sha256').update(b).digest('hex')
const inside=(p,base)=>path.resolve(p).startsWith(path.resolve(base)+path.sep)
const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=.75
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const requireThat=(b,message)=>{if(!b)throw Error(message)}
const visibleText=e=>e?.visible===true?e.text:null
const excluded=(at,ranges)=>ranges.some(r=>r.start<=at&&at<r.end)
function ranges(value,cap,kind){
  requireThat(Array.isArray(value),kind+' must be an explicitly reviewed array, possibly empty')
  return value.map(r=>{requireThat(Number.isFinite(r.start)&&Number.isFinite(r.end)&&0<=r.start&&r.start<r.end&&r.end<=cap.durationMs&&typeof r.reason==='string'&&r.reason.trim()&&typeof r.reviewedBy==='string'&&r.reviewedBy.trim(),kind+' requires bounded actual source intervals, reason and reviewer');return {...r}})
}
function nativeFrame(c,dir,file){
 const f=c.frames?.find(f=>f.file===file),p=path.resolve(dir,file||'')
 requireThat(f&&inside(p,dir)&&fs.existsSync(p)&&inside(fs.realpathSync(p),fs.realpathSync(dir)),'Referenced actual native PNG missing or escapes source')
 const bytes=fs.readFileSync(p),vp=f.viewport||c.sourceViewport
 requireThat(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&vp?.width>0&&vp?.height>0&&vp?.deviceScaleFactor>0,'Native PNG and observed viewport required')
 requireThat(bytes.readUInt32BE(16)===vp.width*vp.deviceScaleFactor&&bytes.readUInt32BE(20)===vp.height*vp.deviceScaleFactor,'Native PNG dimensions must equal actual source viewport; no resizing/crop inferred')
 requireThat(Number.isFinite(f.timestamp)&&Math.round(f.timestamp*1000-c.started)===f.at&&c.recordingWindows?.some(w=>Number.isFinite(w.end)&&w.start<=f.at&&f.at<=w.end),'Native frame timestamp/window mismatch')
 if(f.nativePixels?.sha256)requireThat(hash(bytes)===f.nativePixels.sha256,'Actual native PNG no longer matches recorded hash')
 return {...f,sha256:hash(bytes)}
}
function geometry(observation,cap,qualifiedHost){
 const {local,levels,point,bounds,selectorChain}=observation||{}
 requireThat(Array.isArray(levels)&&levels.length>=1&&levels.length<=2&&levels.length===selectorChain?.length,'Observed one/two-level iframe chain required')
 requireThat(local?.title==='Andrea · Training, inference and RAG'&&local.documentUrl&&local.hitPassed===true&&local.disabled===false&&local.visual?.scale===1&&local.visual.x===0&&local.visual.y===0,'Actual leaf identity/hit test is missing')
 requireThat(local.bounds.width>0&&local.bounds.height>0&&near(local.point.x,local.bounds.left+local.bounds.width/2)&&near(local.point.y,local.bounds.top+local.bounds.height/2),'Actual local control centre required')
 let p=local.point,vp=local.viewport
 for(let i=levels.length-1;i>=0;i--){
  const l=levels[i]
  requireThat(l.selector===selectorChain[i]&&l.tag==='IFRAME'&&l.selectorCount===1&&l.selectedElementMatches===true&&l.hitPassed===true&&l.transforms?.length===0&&l.padding?.every(x=>['0px','0'].includes(x))&&l.visual?.scale===1&&l.visual.x===0&&l.visual.y===0,'Actual iframe owner/geometry/hit evidence missing')
  requireThat(near(l.localPoint.x,p.x)&&near(l.localPoint.y,p.y)&&near(vp.width,l.clientWidth)&&near(vp.height,l.clientHeight)&&near(l.bounds.width,l.offsetWidth)&&near(l.bounds.height,l.offsetHeight),'Actual child viewport/iframe geometry disagree')
  requireThat(p.x>=0&&p.y>=0&&p.x<l.clientWidth&&p.y<l.clientHeight&&near(l.mappedPoint.x,l.bounds.left+l.clientLeft+p.x)&&near(l.mappedPoint.y,l.bounds.top+l.clientTop+p.y),'Mapped iframe point is not its observed native centre')
  p=l.mappedPoint;vp=l.viewport
  requireThat(p.x>=0&&p.y>=0&&p.x<vp.width&&p.y<vp.height,'Mapped target centre is outside the visible native viewport')
 }
 requireThat(new URL(levels[0].resolvedSrc).hostname===qualifiedHost&&levels[0].ownerDocumentUrl===OWNER,'Actual first iframe is not the original Work creator surface')
 requireThat(near(point.x,p.x)&&near(point.y,p.y)&&near(cap.sourceViewport.width,vp.width)&&near(cap.sourceViewport.height,vp.height),'Final native marker/source viewport mismatch')
 const dx=p.x-local.point.x,dy=p.y-local.point.y
 requireThat(['left','right'].every(k=>near(bounds[k],local.bounds[k]+dx))&&['top','bottom'].every(k=>near(bounds[k],local.bounds[k]+dy)),'Native marker bounds are not the mapped target bounds')
 return {point:p,levels,local,selectorChain}
}
function qualifyAction(a,c,dir,qualifiedHost){
 const nativeCdp=a.clickSource==='native-cdp-mouse-input'&&a.nativeInputMethod==='native-cdp'&&a.markerMeaning==='actual-native-input-point'&&a.deliveredPointerCoordinatesExposed===true&&a.nativeCDPPressReleaseSent===true
 const nativeAX=a.clickSource==='native-cua-accessibility-click'&&a.nativeInputMethod==='native-accessibility'&&a.deliveredPointerCoordinatesExposed===false&&a.nativeCDPPressReleaseSent===false&&a.unmarkedNativeActivation===true&&!a.click
 const nativeLocator=a.clickSource==='native-cua-frame-locator-click'&&a.nativeInputMethod==='documented-locator-click'&&a.markerMeaning==='activated-control-center'&&a.deliveredPointerCoordinatesExposed===false&&a.nativeCDPPressReleaseSent===false
 requireThat(a.kind==='click'&&(nativeCdp||nativeLocator||nativeAX)&&a.nativeHitTestPassed===true&&a.nativeUiChanged===true,'Actual iframe input must retain its accurate CDP/locator profile and observed success')
 const p=a.nativeFrameHitTest,first=geometry(p?.first,c,qualifiedHost),last=geometry(p?.last,c,qualifiedHost)
 if(nativeCdp)requireThat(a.clickCoordinateSource==='actual-native-CDP-input-point'&&p.inputMethod==='native-cdp'&&p.mouseMovedSent===false&&p.automaticScrollRequested===false,'Native CDP source needs actual point profile, no mouse move/autoscroll request')
 requireThat(p.first.name===a.activatedControlEvidence?.exactNativeLabel&&p.last.name===p.first.name&&same(a.nativeUiChangeProof.before,p.first.visibleState),'Actual leaf label/before-state differs from recorded native observations')
 requireThat(p.scopedWindowIdentityUsedAsProof===false&&p.CDPFrameTreeUsedAsProof===false&&same(first.selectorChain,last.selectorChain)&&first.local.documentUrl===last.local.documentUrl&&near(first.point.x,last.point.x)&&near(first.point.y,last.point.y),'Two actual stable iframe observations required')
 requireThat(first.levels.every((l,i)=>l.resolvedSrc===last.levels[i].resolvedSrc&&l.ownerDocumentUrl===last.levels[i].ownerDocumentUrl&&['left','top','width','height'].every(k=>near(l.bounds[k],last.levels[i].bounds[k]))),'First/final actual iframe geometry moved')
 requireThat(a.activatedControlEvidence?.hitTestBefore===true&&a.activatedControlEvidence.exactDeliveredPointerCoordinatesExposed===nativeCdp&&a.nativeInputRequestedAt===a.at&&a.nativeInputConfirmedAt>=a.at&&a.nativeUiChangeProof?.passed===true,'Real input bracket and outcome proof required')
 if(!nativeAX)requireThat(near(a.click?.x,last.point.x)&&near(a.click?.y,last.point.y)&&same(a.click.bounds,p.last.bounds),'Saved marker differs from actual observed centre')
 if(nativeAX){const ax=a.nativeAccessibility;requireThat(typeof ax?.fullAXSnapshot==='string'&&hash(ax.fullAXSnapshot)===ax.snapshotSha256&&ax.freshlyReadBeforeClick===true,'Actual full pre-input AX/hash required');const target=findNativeAccessibilityTarget(ax.fullAXSnapshot,{role:'button',name:a.activatedControlEvidence.exactNativeLabel});requireThat(target.index===ax.index&&target.name===ax.name&&target.line===ax.line&&ax.fullAXSnapshot.includes(OWNER),'Actual unique enabled native AX button/source mismatch')}
 requireThat(p.last.observedWall<=c.started+a.at&&p.first.observedWall<=p.last.observedWall&&p.first.observedWall>=c.started,'Actual geometry must precede actual input')
 const f=nativeFrame(c,dir,a.nativeStateFrame)
 requireThat(f.at>=a.nativeInputConfirmedAt&&a.nativeUiChangeProof.postFrame===f.file&&a.activatedControlEvidence.postFrame===f.file,'Actual outcome frame must follow native input')
 return {action:a,frame:f,name:a.activatedControlEvidence.exactNativeLabel,before:a.nativeUiChangeProof.before,after:a.nativeUiChangeProof.after}
}
function cardsFromOriginal(html){const m=html.match(/const cards=(\[.*?\]);\s*const KEY=/s);requireThat(m,'Unchanged original card source missing');const c=JSON.parse(m[1]);requireThat(c.length===3,'Original three cards required');return c}
function numbers(s){const m=visibleText(s?.stats)?.match(/^Total cards: (\d+) · Due today: (\d+) · Rated this pass: (\d+)\/(\d+)$/);return m?m.slice(1).map(Number):null}
// Native stats are primary actual text; empty proxy progress values are never guessed.
const counts=(s,due,rated,total)=>same(numbers(s),[3,due,rated,total])
function reveal(a,card){return a.name==='Flip'&&a.before.back?.visible===false&&a.after.back?.visible===true&&visibleText(a.after.front)===card.front&&visibleText(a.after.back)===card.back}
function traceCards(qualified,cards){
 const sequence=[
  a=>reveal(a,cards[0])&&counts(a.before,3,0,3),
  a=>a.name==='Good'&&counts(a.after,2,1,3)&&visibleText(a.after.front)===cards[1].front,
  a=>reveal(a,cards[1]),
  a=>a.name==='Again'&&counts(a.after,2,2,3)&&visibleText(a.after.front)===cards[2].front,
  a=>reveal(a,cards[2]),
  a=>a.name==='Good'&&counts(a.after,1,3,3)&&visibleText(a.after.position)==='Pass complete',
  a=>a.name==='Start due-card pass'&&counts(a.after,1,0,1)&&visibleText(a.after.front)===cards[1].front,
  a=>reveal(a,cards[1]),
  a=>a.name==='Good'&&counts(a.after,0,1,1)&&visibleText(a.after.position)==='Pass complete'
 ];let cursor=0,selected=[]
 for(const a of qualified)if(cursor<sequence.length&&sequence[cursor](a)){selected.push(a);cursor++}
 requireThat(cursor===sequence.length,'Actual three-card Good/Again/Good and due-only retry trace incomplete')
 return selected.map((a,i)=>({step:i+1,at:a.action.at,name:a.name,label:a.action.label,frame:a.frame.file,frameAt:a.frame.at,frameSha256:a.frame.sha256,before:a.before,after:a.after}))
}
function traceQuiz(child,dir,exclusions){
 const observations=(child.learningUseObservations||[]).filter(o=>!excluded(o.at,exclusions)).sort((a,b)=>a.at-b.at)
 let selected=[],next=0
 for(const o of observations){
  const q=o.state?.quizVisible||[],input=q.find(e=>e.id==='q0'),score=q.find(e=>e.id==='score0'),answer=q.find(e=>e.id==='answer0'),total=visibleText(o.state?.widget?.quizTotal)
  const matches=[input?.value==='Training does not update model parameters.'&&score?.value==='0'&&answer?.open===true&&total==='Self-assessed score: 0/3 · Assessed: 1/3',input?.value==='Training updates the learned numerical weights through optimisation.'&&score?.value===''&&total==='Self-assessed score: 0/3 · Assessed: 0/3',input?.value==='Training updates the learned numerical weights through optimisation.'&&score?.value==='1'&&answer?.open===true&&total==='Self-assessed score: 1/3 · Assessed: 1/3']
  if(next<3&&matches[next]){const f=nativeFrame(child,dir,o.frame);requireThat(o.method==='readonly-visible-native-DOM-and-full-native-PNG'&&o.readRequestedAt<=o.readReceivedAt&&o.readReceivedAt===o.at&&o.at<=f.at&&o.frameAt===f.at&&o.frameSha256===f.sha256&&o.state.title==='Andrea · Training, inference and RAG','Actual visible quiz observation/frame binding invalid');selected.push({step:next+1,label:o.label,at:o.at,frame:f.file,frameAt:f.at,frameSha256:f.sha256,inputValue:input.value,score:score.value,modelAnswerOpen:answer?.open,total});next++}
 }
 requireThat(next===3,'Need actual negative/manual-0, corrected/reset-score, corrected/manual-1 DOM+native-PNG observations')
 return selected
}
function qualifyAnswerReads({child,dir,trace,cards,exclusions}){
 const expected=[cards[0],cards[1],cards[2],cards[1]],reveals=trace.filter(t=>t.name==='Flip'),out=[]
 for(let i=0;i<reveals.length;i++){
  const reveal=reveals[i],next=trace[trace.indexOf(reveal)+1],candidates=[]
  if(!excluded(reveal.frameAt,exclusions))candidates.push({file:reveal.frame,at:reveal.frameAt,sha256:reveal.frameSha256,method:'actual-native-input-outcome'})
  for(const o of child.learningUseObservations||[])if(o.at>=reveal.at&&o.frameAt<next.at&&!excluded(o.frameAt,exclusions)&&o.state?.widget?.back?.visible===true&&visibleText(o.state.widget.front)===expected[i].front&&visibleText(o.state.widget.back)===expected[i].back){const f=nativeFrame(child,dir,o.frame);requireThat(f.sha256===o.frameSha256,'Actual readable answer observation PNG mismatch');candidates.push({file:f.file,at:f.at,sha256:f.sha256,method:'actual-later-visible-native-answer-observation'})}
  const selected=candidates.find(f=>child.deliberateHolds?.some(h=>h.start>=f.at&&h.start-f.at<1500&&h.end<=next.at&&h.end-h.start>=4500&&!exclusions.some(r=>r.start<h.end&&h.start<r.end)))
  requireThat(selected,'Each of the four revealed answers needs an actually retained >=4.5s native read before its rating; excluded activation may be contextual proof only')
  out.push({...selected,card:i===3?2:i+1,activationSourceAt:reveal.at,activationExcludedFromRender:excluded(reveal.at,exclusions)})
 }
 return out
}
export function qualifyLearningNativeAccessibilityCentre({child,action,sourceDirectory}){
 const binding=qualifyObservedWorkLineage(child.nativeHostBinding?.lineageFile)
 requireThat(same(binding,child.nativeHostBinding),'Actual Learning AX marker must retain current original-owner lineage')
 const base=qualifyAction(action,child,sourceDirectory,binding.observedNativeHost)
 requireThat(action.nativeInputMethod==='native-accessibility','Only actual native AX input may use this centre-marker profile')
 const before=base.before?.stats,after=base.after?.stats,pre=action.nativeFrameHitTest.last,post=action.nativePostControlGeometry,ids={'Flip':'flip','Flip to question':'flip','Good':'good','Again':'again','Start due-card pass':'start','Reset flashcards':'resetCards'}
 const stableRect=(a,b)=>!!a&&!!b&&['left','top','right','bottom','width','height'].every(k=>near(a[k],b[k]))
 const anchorStable=before?.id==='stats'&&after?.id==='stats'&&before.visible===true&&after.visible===true&&stableRect(before.bounds,after.bounds)&&before.bounds.top>=0&&after.bounds.bottom<=pre.local.viewport.height
 const frameOwnersStable=post?.levels?.length===pre.levels.length&&post.levels.every((l,i)=>l.src===pre.levels[i].resolvedSrc&&l.ownerDocumentUrl===pre.levels[i].ownerDocumentUrl&&stableRect(l.bounds,pre.levels[i].bounds)&&near(l.clientLeft,pre.levels[i].clientLeft)&&near(l.clientTop,pre.levels[i].clientTop))
 const viewportStable=post?.local?.documentUrl===pre.local.documentUrl&&post.local.title===pre.local.title&&post.local.id===ids[base.name]&&post.local.tag==='BUTTON'&&near(post.local.viewport.width,pre.local.viewport.width)&&near(post.local.viewport.height,pre.local.viewport.height)
 const eligible=anchorStable&&frameOwnersStable&&viewportStable
 return {eligible,postFrame:base.frame.file,postFrameAt:base.frame.at,postFrameSha256:base.frame.sha256,profile:'pre-input-native-AX-control-centre-with-stable-stats-anchor',sourceAt:action.at,name:base.name,point:{...pre.point},bounds:{...pre.bounds},anchorStable,frameOwnersStable,viewportStable,staticAnchor:{id:'stats',beforeBounds:before?.bounds,afterBounds:after?.bounds},sameControlBinding:{originalArtifactButtonId:ids[base.name],exactNativeLabel:base.name,actualPostInputId:post?.local?.id,preInputIdDirectlyRecorded:false,method:'Unique exact native pre-input label in the hash-bound original HTML and the actual post-input same-ID control'},postControlReflowAllowed:true,deliveredPointerCoordinatesExposed:false,markerMeaning:'activated-control-center',disclosure:'Measured PRE-input centre of the native AX-activated control, with two fresh hit tests and stable stats-anchor/viewport/frame-owner geometry. The control may reflow after the real state change. Not an OS-pointer trace; delivered pointer coordinates are not exposed. Direct pre-scroll value was not recorded and is not inferred.'}
}
function qualifyRecoveries(child,dir,childExclusions,manualReviewComplete){
 const out=[]
 for(const event of child.sourceRecoveryEvents||[]){
  requireThat(event.kind==='explicit-lost-return-handle-recovery'&&event.normalRecorderStopClaimed===false&&event.lastFrameHeuristicUsed===false&&event.completionClaimed===false,'Actual explicit abnormal-stop recovery must not be relabeled normal/complete')
  requireThat(sha(event.stopProofFile)===event.stopProofSha256&&sha(event.checkpoint)===event.checkpointSha256&&event.sourcePrefixSha256===event.checkpointSha256,'Recovery native-stop proof/checkpoint hash mismatch')
  const proof=read(event.stopProofFile),before=read(event.checkpoint),window=child.recordingWindows.find(w=>w.id===event.windowId),stop=proof.nativeStop
  requireThat(proof.sourceWasIncomplete===true&&proof.priorHandleNotRetained===true&&proof.checkpointSha256===event.checkpointSha256&&same(stop,event.actualNativeStop)&&stop.method==='Page.stopScreencast'&&stop.confirmedWall>=stop.requestedWall,'Actual external native stop bracket required')
  requireThat(before.key===child.key&&before.complete===false&&same(before.recordingWindows.find(w=>w.id===event.windowId),event.originalOpenWindow)&&event.originalOpenWindow.end===null,'Recovery checkpoint must retain the actual abandoned unfinished window')
  requireThat(window?.closedBy==='explicit-root-native-stop-after-lost-handle'&&window.normalRecorderStopClaimed===false&&window.end===stop.confirmedWall-child.started&&window.stopRequestedAt===stop.requestedWall-child.started&&window.confirmedStoppedAt===window.end&&window.recoveryStopProofSha256===event.stopProofSha256,'Recovery end must equal observed native stop, not a last-frame heuristic')
  for(const field of ['frames','actions','phases'])requireThat(same(child[field].slice(0,before[field].length),before[field]),'Actual checkpoint '+field+' prefix changed')
  requireThat(event.sourceFrameCount===before.frames.length&&event.sourceActionCount===before.actions.length&&event.prefixPixels.length===before.frames.length,'All original checkpoint frames/actions must be preserved')
  for(const pixel of event.prefixPixels){const original=before.frames.find(f=>f.file===pixel.file&&f.at===pixel.at);requireThat(original&&sha(path.join(dir,pixel.file))===pixel.sha256,'Actual checkpoint native PNG changed')}
  const lastFrameAt=Math.max(...before.frames.map(f=>f.at)),tailStart=lastFrameAt+1
  if(manualReviewComplete)requireThat(childExclusions.some(r=>r.start<=tailStart&&r.end>=window.end),'The unobserved lost-handle source tail requires explicit reviewed exclusion; no idle/read hold is inferred')
  out.push({stopProofSha256:event.stopProofSha256,checkpointSha256:event.checkpointSha256,windowId:event.windowId,actualStoppedAt:window.end,preservedFrameCount:before.frames.length,lastFrameAt,unobservedSourceTail:[tailStart,window.end],normalStopClaimed:false})
 }
 return out
}
export function inspectLearningOriginalWorkChild({childDirectory,reviewFile}={}){
 const childDir=path.resolve(childDirectory||''),childFile=path.join(childDir,'capture.json')
 requireThat(path.dirname(childDir)===path.dirname(RAW)&&childDir!==RAW&&fs.existsSync(childFile),'Use the separate actual Learning child in this staged captures directory')
 requireThat(sha(path.join(RAW,'capture.json'))===RAW_SHA,'Immutable original Learning parent changed')
 const parent=read(path.join(RAW,'capture.json')),child=read(childFile),inventory=read(path.join(RUN,'inventory.json')),item=inventory.items.find(i=>i.key==='skills-the-learning-skill')
 const identity=validateWorkUiIdentity({capture:parent,sourceDirectory:RAW,item})
 requireThat(identity.visibleTextSha256==='424d50a97966870def4d4e7614229a60987ceda5c545965672756f6a46e5288b','Different original Work wrapper')
 requireThat(sha(parent.book.path)===parent.book.sha256&&fs.statSync(parent.book.path).size===parent.book.bytes,'Original book bytes changed')
 const artifact=path.join(RAW,'native-export/andrea_study_kit.html'),artifactBytes=fs.readFileSync(artifact)
 requireThat(hash(artifactBytes)===ORIGINAL_ARTIFACT.sha256&&artifactBytes.length===ORIGINAL_ARTIFACT.bytes,'Original downloaded HTML bytes changed')
 const resultDir=path.join(RUN,item.key),primary=read(path.join(resultDir,'result.json')),supplement=read(path.join(resultDir,'supplemental-study-kit.json'))
 validateWorkSharedResult({capture:parent,sourceDirectory:RAW,item,result:primary});validateWorkSharedResult({capture:parent,sourceDirectory:RAW,item,result:supplement})
 requireThat(primary.kind==='chatgpt-share'&&primary.url==='https://chatgpt.com/share/6af09b21-5ce0-83ed-a9d7-1f05a5639742'&&primary.supplementalFileResults?.includes('supplemental-study-kit.json'),'Required original shared conversation must be retained')
 requireThat(supplement.kind==='file'&&supplement.supplementalOnly===true&&supplement.requiredChatShareRetained===true&&supplement.file.mediaType==='text/html; charset=utf-8'&&supplement.file.sha256===ORIGINAL_ARTIFACT.sha256&&supplement.file.bytes===ORIGINAL_ARTIFACT.bytes&&sha(path.join(resultDir,supplement.file.path))===ORIGINAL_ARTIFACT.sha256,'Exact original HTML supplement binding missing')
 // Stored localhost access flags are neither executed nor used as interaction proof.
 requireThat(child.complete===true&&!child.truncated&&child.hostMode==='Work-artifact-use'&&child.service==='ChatGPT'&&child.conversationUrl===OWNER&&child.ownerConversationUrl===OWNER&&!child.ownerResponseId&&!child.responseId,'Complete original-owner Work child without invented backend IDs required')
 const p=child.evidence
 requireThat(p?.nativeUsageRetake===true&&p.parentCaptureKey===parent.key&&p.parentConversationUrl===OWNER&&p.sourceBookSha256===parent.book.sha256&&p.resultSha256===ORIGINAL_ARTIFACT.sha256&&same(p.sourceWorkUiIdentity,parent.observedWorkUiIdentity)&&same(child.sourceWorkUiIdentity,parent.observedWorkUiIdentity)&&child.resultSha256===ORIGINAL_ARTIFACT.sha256,'Actual child owner/book/Work/HTML provenance mismatch')
 requireThat(child.immutableRawParent?.captureSha256===RAW_SHA&&path.resolve(child.immutableRawParent.directory)===RAW,'Actual child immutable parent binding mismatch')
 requireThat(child.started-parent.started>=parent.durationMs&&child.frames?.length>0&&child.recordingWindows?.length>0&&child.recordingWindows.every(w=>Number.isFinite(w.end)&&w.end>=w.start&&!w.failure)&&child.phases?.every(p=>p.speed===1),'Closed later real native use at1x required')
 const inspection=child.originalWorkPreviewInspection
 requireThat(inspection?.owner===OWNER&&inspection.ready===true&&inspection.navigationOrUiActionsPerformed===false&&inspection.selected?.local?.title==='Andrea · Training, inference and RAG'&&inspection.selected.directFlipCount===1,'Actual initial original Work iframe inspection missing')
 const nativeHostBinding=qualifyObservedWorkLineage(child.nativeHostBinding?.lineageFile),qualifiedHost=nativeHostBinding.observedNativeHost
 requireThat(same(nativeHostBinding,child.nativeHostBinding)&&same(nativeHostBinding,inspection.nativeHostBinding)&&same(nativeHostBinding,p.nativeHostBinding),'Actual native dynamic host must retain its exact saved root lineage in child and initial inspection')
 const selectedChain=inspection.selected.selectorChain
 requireThat(Array.isArray(selectedChain)&&selectedChain.length>=1&&selectedChain.length<=2&&inspection.candidates?.some(f=>f.selector===selectedChain[0]&&new URL(f.resolvedSrc).hostname===qualifiedHost),'Initial actual owner iframe chain mismatch')
 let review=null,childExclusions=[],parentExclusions=[]
 if(reviewFile){review=read(reviewFile);childExclusions=ranges(review.childExcludedRanges||[],child,'childExcludedRanges');parentExclusions=ranges(review.parentExcludedRanges||[],parent,'parentExcludedRanges')}
 const frames=child.frames.map(f=>nativeFrame(child,childDir,f.file))
 const retainedActions=child.actions.filter(a=>!excluded(a.at,childExclusions))
 requireThat(!retainedActions.some(a=>a.nativeFrameHitTest?.method==='actual-observed-frame-chain-and-readonly-ownerDocument-geometry'&&a.nativeUiChanged!==true),'The actual CDP/noop input is not a PASS; explicitly review/exclude its source interval')
 // Genuine successful input may remain raw contextual proof even when its bad framing is excluded.
 const qualified=child.actions.filter(a=>a.nativeFrameHitTest?.method==='actual-observed-frame-chain-and-readonly-ownerDocument-geometry'&&a.nativeUiChanged===true).map(a=>qualifyAction(a,child,childDir,qualifiedHost))
 const originalCards=cardsFromOriginal(artifactBytes.toString('utf8')),trace=traceCards(qualified,originalCards),quiz=traceQuiz(child,childDir,childExclusions)
 requireThat(trace.filter(t=>t.name!=='Flip').every(t=>!excluded(t.at,childExclusions)&&!excluded(t.frameAt,childExclusions))&&quiz.every(t=>!excluded(t.frameAt,childExclusions)),'Required retained ratings/due pass/quiz outcome frames may not be technically excluded')
 requireThat(!(child.failures||[]).some(f=>!excluded(f.at,childExclusions)),'Unreviewed retained child capture failure')
 const answerReadFrames=qualifyAnswerReads({child,dir:childDir,trace,cards:originalCards,exclusions:childExclusions})
 const reviewChecks=['allRequiredFramesVisuallyReviewed','originalWorkOwnerAndPreviewSourceVerified','allThreeAnswersComparedToSourceBook','quizScoresManualAndCorrectlyShown','noReconstructedUiOrPointerTrace','cheatsheetAndBothPlansReadablyShown']
 const reviewed=!!review&&review.verdict==='pass'&&typeof review.reviewedBy==='string'&&review.reviewedBy.trim()&&Date.parse(review.reviewedAt)>=child.started+child.durationMs&&Date.parse(review.reviewedAt)<=Date.now()+1000&&review.parentCaptureSha256===RAW_SHA&&review.childCaptureSha256===sha(childFile)&&review.resultSha256===ORIGINAL_ARTIFACT.sha256&&reviewChecks.every(k=>review[k]===true)
 const recoveryVerifications=qualifyRecoveries(child,childDir,childExclusions,reviewed)
 if(reviewed){
  requireThat(!(parent.failures||[]).some(f=>!excluded(f.at,[...(parent.excludedRanges||[]),...parentExclusions])),'Parent technical failure requires a specifically reviewed exclusion; never hide it automatically')
  requireThat(Array.isArray(review.readFrames)&&['cheatsheet','plan-one','plan-two'].every(role=>review.readFrames.some(e=>e.role===role)),'Bind readable cheatsheet and both plans to actual reviewed child PNGs')
  for(const entry of review.readFrames){const f=nativeFrame(child,childDir,entry.file);requireThat(entry.sha256===f.sha256&&!excluded(f.at,childExclusions),'Readable-plan frame hash or retained interval mismatch')}
 }
 return {schemaVersion:1,kind:'learning-original-native-work-preview-source-qualification',nativeHostBinding,machineQualified:true,manualReviewComplete:!!reviewed,readyToStage:!!reviewed,acceptanceClaimed:false,qualityApprovalRequired:true,rawParentPath:RAW,rawParentSha256:RAW_SHA,childDirectory:childDir,childCaptureSha256:sha(childFile),ownerConversationUrl:OWNER,workVisibleTextSha256:identity.visibleTextSha256,originalArtifact:{path:artifact,...ORIGINAL_ARTIFACT},sourceBookSha256:parent.book.sha256,requiredSharedChatRetained:primary.url,recipientAccessUnchanged:{recipientVerified:primary.recipientVerified,ownerIndependent:primary.ownerIndependent},recoveryVerifications,nativeFrameCount:frames.length,qualifiedControlActivations:qualified.length,cardTrace:trace,answerReadFrames,quizTrace:quiz,reviewFile:reviewFile?path.resolve(reviewFile):null,reviewSha256:reviewFile?sha(reviewFile):null,childExcludedRanges:childExclusions,parentExcludedRanges:parentExclusions,manualReviewRequired:reviewChecks,childInitialSelectorChain:selectedChain,sourcePixelsOrAbsoluteTimestampsAltered:false}
}

/** Strict render guard for only unchanged review-derived Learning AX markers. */
export function qualifyLearningNativeAXRenderActions({capture,rootDirectory=ROOT}) {
 const output=[]
 for(const action of capture.actions||[]){
  if(action.clickSource!=='native-cua-frame-accessibility-activation')continue
  const origin=action.nativeRetakeOrigin,retake=capture.nativeUsageRetakes?.find(r=>r.kind==='native-work-learning-original-preview-retake'&&r.origin.captureSha256===origin?.captureSha256)
  requireThat(retake&&capture.key==='skills-the-learning-skill-take1'&&capture.hostMode==='Work'&&!capture.ownerResponseId&&!capture.responseId,'Learning native AX centre marker needs its exact reviewed Work retake')
  const dir=path.resolve(rootDirectory,origin.capturePath),file=path.join(dir,'capture.json')
  requireThat(inside(dir,RUN)&&sha(file)===origin.captureSha256,'Immutable original Learning child hash mismatch')
  const child=read(file),original=child.actions.find(a=>a.at===origin.sourceAt&&a.label===origin.label)
  requireThat(child.complete===true&&!child.truncated&&original,'Original completed Learning AX action missing')
  const q=qualifyLearningNativeAccessibilityCentre({child,action:original,sourceDirectory:dir}),delta=retake.deltaMs
  requireThat(q.eligible&&action.at===original.at+delta&&action.nativeInputRequestedAt===original.nativeInputRequestedAt+delta&&action.nativeInputConfirmedAt===original.nativeInputConfirmedAt+delta,'Review marker source timing or static anchor profile differs')
  requireThat(action.markerMeaning==='activated-control-center'&&action.deliveredPointerCoordinatesExposed===false&&action.nativeCDPPressReleaseSent===false&&action.nativeInputMethod==='native-accessibility'&&near(action.click?.x,q.point.x)&&near(action.click?.y,q.point.y)&&same(action.click.bounds,q.bounds),'Review marker must be the original measured PRE-input centre, never a pointer trace')
  requireThat(same(action.nativeFrameHitTest,original.nativeFrameHitTest)&&same(action.nativeAccessibility,original.nativeAccessibility)&&same(action.nativePostControlGeometry,original.nativePostControlGeometry)&&same(action.nativeUiChangeProof.before,original.nativeUiChangeProof.before)&&same(action.nativeUiChangeProof.after,original.nativeUiChangeProof.after),'Actual raw AX/geometry/UI source proof changed')
  requireThat(action.markerUntilSourceAt===q.postFrameAt+delta&&action.markerLimitReason?.trim(),'Cap the PRE-input marker at its first genuine post-input frame; never linger over reflowed controls')
  const frame=capture.frames.find(f=>f.file===action.nativeStateFrame&&f.at===q.postFrameAt+delta)
  requireThat(frame?.nativeRetakeOrigin?.sha256===q.postFrameSha256&&frame.nativeRetakeOrigin.captureSha256===origin.captureSha256,'Post-input native PNG origin/hash mismatch')
  output.push({...q,parentSourceAt:action.at,originalSourceAt:original.at,rawCaptureSha256:origin.captureSha256,exactDeliveredPointerCoordinatesExposed:false})
 }
 return output
}

/** Only the frozen genuine first locator Flip may remain an unmarked activation. */
export function qualifyLearningUnmarkedRenderActions({capture,rootDirectory=ROOT}) {
 const out=[],frozen='7ee0c6e915e2ecb411f5971a7fca70ceb91de8ddae0b6d63c6caad1e683ea57c'
 for(const action of capture.actions||[]){
  if(action.clickSource!=='native-cua-frame-locator-click'||!action.discardedSourceMarker)continue
  const origin=action.nativeRetakeOrigin,retake=capture.nativeUsageRetakes?.find(r=>r.kind==='native-work-learning-original-preview-retake'&&r.origin.captureSha256===frozen)
  requireThat(retake&&origin?.captureSha256===frozen&&origin.sourceAt===221933&&capture.key==='skills-the-learning-skill-take1'&&capture.hostMode==='Work','Only the frozen genuine first Learning locator Flip may be qualified unmarked')
  const dir=path.resolve(rootDirectory,origin.capturePath),file=path.join(dir,'capture.json')
  requireThat(inside(dir,RUN)&&sha(file)===frozen,'Frozen Learning unmarked source hash mismatch')
  const child=read(file),original=child.actions.find(a=>a.at===221933&&a.label===origin.label),binding=qualifyObservedWorkLineage(child.nativeHostBinding.lineageFile)
  requireThat(child.complete===true&&!child.truncated&&original,'Actual completed original first Flip missing')
  const q=qualifyAction(original,child,dir,binding.observedNativeHost),discarded=action.discardedSourceMarker
  requireThat(q.name==='Flip'&&q.before.back.visible===false&&q.after.back.visible===true&&Math.abs(q.before.stats.bounds.top-q.after.stats.bounds.top)>.75,'Actual first Flip must establish real answer reveal and observed autoscroll')
  requireThat(action.kind==='click'&&action.kind===original.kind&&!action.click&&action.nativeUiChanged===true&&action.markerMeaning==='unmarked-native-frame-activation'&&action.deliveredPointerCoordinatesExposed===false&&action.nativeCDPPressReleaseSent===false,'Keep genuine activation kind and omit the unqualified pointer/centre marker')
  requireThat(near(discarded.x,original.click.x)&&near(discarded.y,original.click.y)&&same(discarded.bounds,original.click.bounds)&&discarded.reason?.trim(),'Discarded marker must be the original recorded pre-input centre, with an honest reason')
  requireThat(action.at===original.at+retake.deltaMs&&action.nativeInputRequestedAt===original.nativeInputRequestedAt+retake.deltaMs&&action.nativeInputConfirmedAt===original.nativeInputConfirmedAt+retake.deltaMs&&same(action.nativeFrameHitTest,original.nativeFrameHitTest)&&same(action.nativeUiChangeProof.before,original.nativeUiChangeProof.before)&&same(action.nativeUiChangeProof.after,original.nativeUiChangeProof.after),'Original unmarked activation clock/geometry/UI proof changed')
  out.push({parentSourceAt:action.at,originalSourceAt:original.at,rawCaptureSha256:frozen,eligibleUnmarked:true,realNativeActivationVerified:true,markerOmitted:true,profile:'genuine-first-native-frame-activation-with-discarded-autoscrolled-centre',disclosure:'Actual original locator Flip revealed the answer, but its input auto-scrolled the viewport. The recorded pre-input centre is retained only as discarded source evidence; no delivered pointer or activation-centre marker is drawn.'})
 }
 return out
}

export function qualifyObservedWorkLineage(lineageFile) {
  if(!lineageFile)return {method:'historical-original-native-host',observedNativeHost:ORIGINAL_HOST,historicalOriginalHost:ORIGINAL_HOST,dynamicHostClaimed:false}
  const file=path.resolve(lineageFile),here=HERE
  if(!file.startsWith(here+path.sep)||!fs.realpathSync(file).startsWith(fs.realpathSync(here)+path.sep))throw Error('Use the actual saved lineage in this isolated Learning producer')
  const bytes=fs.readFileSync(file),proof=JSON.parse(bytes)
  const expectedWrapper='424d50a97966870def4d4e7614229a60987ceda5c545965672756f6a46e5288b'
  if(proof.method!=='original-native-work-corrected-file-lineage'||proof.ownerConversationUrl!==OWNER||proof.sourceWorkVisibleTextSha256!==expectedWrapper||hash(proof.actualNativeWrapperText)!==expectedWrapper||Array.from(proof.actualNativeWrapperText).length!==176||proof.nativeFileOpenObserved!==true||proof.observedNativeHost!==OBSERVED_DYNAMIC_HOST||proof.originalArtifact?.sha256!==ORIGINAL_ARTIFACT.sha256||proof.originalArtifact?.bytes!==ORIGINAL_ARTIFACT.bytes||!Number.isFinite(Date.parse(proof.observedAt)))throw Error('Dynamic host needs the exact real corrected-owner wrapper/file-open/artifact lineage')
  const axFile=path.resolve(proof.nativeAx?.file||''),pngFile=path.resolve(proof.nativeScreenshot?.file||'')
  if(![axFile,pngFile].every(p=>p.startsWith(here+path.sep)&&fs.realpathSync(p).startsWith(fs.realpathSync(here)+path.sep)))throw Error('Actual lineage AX/PNG evidence must stay in this isolated producer')
  const ax=fs.readFileSync(axFile),png=fs.readFileSync(pngFile)
  const screenshotFormat=png.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'png':png.subarray(0,3).toString('hex')==='ffd8ff'?'jpeg':null
  if(hash(ax)!==proof.nativeAx.sha256||hash(png)!==proof.nativeScreenshot.sha256||!screenshotFormat)throw Error('Real saved lineage AX/native-image hash mismatch')
  const text=ax.toString('utf8')
  if(!text.includes(OWNER)||!text.includes(OBSERVED_DYNAMIC_HOST)||!text.includes('andrea_study_kit.html')||!text.includes('Andrea'))throw Error('Saved actual AX does not establish the observed original Work file/host')
  const original=fs.readFileSync(path.join(RAW,'native-export/andrea_study_kit.html'))
  if(hash(original)!==ORIGINAL_ARTIFACT.sha256||original.length!==ORIGINAL_ARTIFACT.bytes)throw Error('Original downloaded HTML changed')
  return {method:'root-observed-corrected-owner-file-to-dynamic-native-preview',observedNativeHost:OBSERVED_DYNAMIC_HOST,historicalOriginalHost:ORIGINAL_HOST,dynamicHostClaimed:true,sameHostAsHistoricalPreview:false,lineageFile:file,lineageSha256:hash(bytes),nativeAxSha256:hash(ax),nativeScreenshotSha256:hash(png),nativeScreenshotActualFormat:screenshotFormat,ownerConversationUrl:OWNER,sourceWorkVisibleTextSha256:expectedWrapper,originalArtifact:{...ORIGINAL_ARTIFACT},observedAt:proof.observedAt,authority:'Actual original owner native corrected-file opening; no direct sandbox navigation, init replay, localhost or rehosting.'}
}

export function findNativeAccessibilityTarget(snapshot,expected) {
  if (typeof snapshot!=='string') throw Error('A fresh native AX string is required')
  const matches=[]
  for (const line of snapshot.split('\n')) {
    const m=line.match(/^\s*(\d+)\s+(pop up button|button|text entry area|text field)\b((?:\s+\([^)]*\))*)\s*(.*)$/)
    if (!m) continue
    const roleMatches=m[2]===expected.role||(expected.role==='button'&&m[2]==='pop up button')||(expected.role==='text entry area'&&m[2]==='text field')
    if (!roleMatches||/\bdisabled\b/.test(m[3])) continue
    const name=m[4].replace(/^Description:\s*/,'').split(/,\s*(?:Value|Secondary Actions|ID|Help|Placeholder):/)[0].trim()
    if (name===expected.name) matches.push({index:Number(m[1]),role:m[2],name,line:line.trim()})
  }
  if (matches.length!==1) throw Error('Fresh native AX must identify exactly one '+expected.role+' '+expected.name+'; found '+matches.length+'. Do not reuse an old AX index.')
  return matches[0]
}
