/** Narrow adapter for actual standalone NotebookLM Apps footage.
 * It supplies provenance of native use, never an export or recipient proof.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {qualifyNativeAppLocatorAction} from './native-app-evidence.mjs'

const DEFAULT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const KEYS=new Set(['notebook-flashcards','notebook-quiz','notebook-mind-map'])
const BOOK='f8131615212f15aeb864847af774fc79184d22b1193bb5e5c5b99147aa7c9981'
const ENGLISH_CONTROLS=new Set(['To notebook','To Notebook','Back to notebook','Share','Open in new tab','Expand','View prompt and 1 source','Previous','Next','Activate to see answer','Missed It','Got It'])
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'))
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const inside=(f,b)=>path.resolve(f).startsWith(path.resolve(b)+path.sep)
const times=new Set(['at','end','start','actualActionEndAt','stepEndedAt','stepRequestedAt','nativeInputRequestedAt','nativeInputConfirmedAt','markerUntilSourceAt','requestedStartAt','confirmedRunningAt','stopRequestedAt','confirmedStoppedAt','functionStartedAt','functionEndedAt','outerMethodReturnedAfterSourceEndAt'])
const shift=(v,d)=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,times.has(k)&&Number.isFinite(x)?x+d:x]))
const parsed=(value,artifact=false,allowQuerylessArtifact=false)=>{
  const u=new URL(value)
  const pattern=artifact?/^\/notebook\/([a-f0-9-]{36})\/artifact\/([a-f0-9-]{36})$/:/^\/notebook\/([a-f0-9-]{36})$/
  const match=u.pathname.match(pattern)
  const auth=u.searchParams.getAll('authuser'),queryless=auth.length===0
  if(u.origin!=='https://notebook.google.com'||u.username||u.password||u.hash||!match||!((auth.length===1&&auth[0]==='1')||(artifact&&allowQuerylessArtifact&&queryless)))throw Error('Expected the actual institutional NotebookLM URL')
  return {url:u.href,notebookId:match[1],artifactId:match[2],querylessArtifact:artifact&&queryless}
}
const nativeFile=(directory,file)=>{
  const target=path.resolve(directory,file||'')
  if(!inside(target,directory)||!fs.existsSync(target)||!fs.statSync(target).isFile()||!inside(fs.realpathSync(target),fs.realpathSync(directory)))throw Error('Native evidence escapes its source')
  return target
}
const png=f=>{
  const b=fs.readFileSync(f)
  if(b.length<24||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Actual PNG evidence required')
  return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)}
}
/** This completed Map parent recorded the actual opened URL under recovery.
 * A later explicit review binds its one original native Open action, without
 * inserting a missing nativeAppArtifact field into the completed recorder. */
export function observedNativeMapOpening(capture,rawCaptureSha256) {
  const recovery=capture.evidence?.nativeAppRecovery,review=capture.nativeAppOpeningReview
  if(capture.key!=='notebook-mind-map-unimib-take1'||capture.slideId!=='S66'||recovery?.actualNativeOpenInNewTab!==true||recovery.accountDomain!=='unimib.it'||recovery.uiLanguage!=='en'||recovery.sourceBookSha256!==BOOK||recovery.sourceUrl!=='https://notebook.google.com/notebook/d0e5636a-7605-4d77-aaab-a23e17859f17/artifact/01968eae-8ff9-4250-93fe-1b40a1b65b90'||review?.schemaVersion!==1||review.rawCaptureSha256!==rawCaptureSha256||review.observedBindingField!=='evidence.nativeAppRecovery'||!review.reviewedBy?.trim()||!review.reason?.trim()||review.openInNewTabAction?.at!==27804624||review.openInNewTabAction.label!=='Open this generated map in a new tab')throw Error('The actual Map recovery binding needs its exact immutable-source opening review')
  return {artifactUrl:recovery.sourceUrl,openInNewTabAction:review.openInNewTabAction}
}
export const completedMapReaderContinuation=({capture,original,child,readerDirectory,run,rootDirectory,app,owner})=>{
  const key=child.evidence?.continuesReaderCaptureKey
  if(!key)return null
  const intended=original.evidence?.nativeAppRecovery?.readerCaptureKey
  if(original.key!=='notebook-mind-map-unimib-take1'||child.slideId!=='S66'||!/^notebook-mind-map-unimib-reader-take(?:[2-9]|[1-9]\d+)$/.test(child.key)||key!=='notebook-mind-map-unimib-reader-take1'||key!==intended||child.evidence.supersedesReaderCaptureKey)throw Error('Only the additional genuine Map overview may continue its completed first reader')
  const directory=path.resolve(path.dirname(readerDirectory),key),file=path.join(directory,'capture.json')
  if(!inside(directory,run)||!fs.existsSync(file)||sha(file)!==child.evidence.priorReaderCaptureSha256)throw Error('Actual completed Map reader source changed')
  const prior=read(file),identity=parsed(prior.conversationUrl,true,true),digest=sha(file),retained=capture.nativeUsageRetakes?.find(r=>r.kind==='native-notebook-app-reader'&&r.origin?.captureSha256===digest&&r.origin.key===key)
  if(!prior.complete||prior.truncated||prior.started>=child.started||prior.evidence?.parentCaptureKey!==original.key||prior.evidence.parentNotebookUrl!==owner||prior.book?.sha256!==BOOK||identity.notebookId!==app.notebookId||identity.artifactId!==app.artifactId||!retained||retained.retainedEndAt>child.started-capture.started)throw Error('Completed Map reader must remain genuinely retained before its later continuation')
  return {kind:'completed-native-map-reader-continuation',key,capturePath:path.relative(rootDirectory,directory).split(path.sep).join('/'),captureSha256:digest,sourceUrl:prior.conversationUrl,complete:true,sourceFrames:prior.frames.length,priorRetainedInReviewedParent:true,doesNotClaimPriorFailure:true,doesNotSupplyResult:true}
}
const readerSupersession=({original,child,readerDirectory,run,rootDirectory,app,owner,completedReaderContinuation})=>{
  const intended=original.evidence?.recordingContinuesIn||original.evidence?.nativeAppRecovery?.readerCaptureKey
  const key=child.evidence?.supersedesReaderCaptureKey
  if(!key){if(intended&&intended!==child.key&&!completedReaderContinuation)throw Error('A different historical reader intention needs an explicit supersession or the qualified completed Map continuation');return null}
  if(!/^[a-z0-9][a-z0-9-]*$/.test(key)||key===child.key||key===original.key||(intended&&intended!==key))throw Error('Superseded reader key differs from the historical attempt')
  const directory=path.resolve(path.dirname(readerDirectory),key),file=path.join(directory,'capture.json')
  if(!inside(directory,run)||!fs.existsSync(file))throw Error('Actual superseded reader source is missing')
  const prior=read(file),source=parsed(prior.conversationUrl,true,true),windows=prior.recordingWindows||[]
  if(prior.key!==key||prior.complete!==false||prior.started>=child.started||prior.evidence?.parentCaptureKey!==original.key||prior.evidence?.parentNotebookUrl!==owner||prior.evidence?.sourceBookSha256!==BOOK||source.notebookId!==app.notebookId||source.artifactId!==app.artifactId||!windows.length||windows.some(w=>!Number.isFinite(w.end)||w.failure))throw Error('Superseded source must be the actual closed incomplete attempt at this same artifact')
  return {key,capturePath:path.relative(rootDirectory,directory).split(path.sep).join('/'),captureSha256:sha(file),sourceUrl:prior.conversationUrl,started:prior.started,complete:false,sourceFrames:prior.frames.length,recordingWindows:windows.length,openWindows:0,historicalParentReaderKey:intended||null,doesNotSupplyRetainedFrames:true,note:'Historical parent reader key recorded an intention. This later child supersedes that incomplete closed attempt; no earlier failed-reader frame is appended.'}
}

/** A fresh standalone proof must name its own artifact URL, account and UI.
 * Parent notebook screenshots cannot masquerade as the child artifact proof.
 */
export function normalizeNotebookAppObservation(observed) {
  // This actual Map observer saved explicit names plus the full native DOM.
  // Normalize only in memory and require every alias to be corroborated there.
  if(['accountLabel','nativeEnglishLabels','actualSourceViewport'].some(k=>Object.prototype.hasOwnProperty.call(observed,k))) {
    if(typeof observed.dom!=='string'||observed.accountObserved!==true||typeof observed.accountLabel!=='string'||!observed.dom.includes('button "'+observed.accountLabel+'"')||!Array.isArray(observed.nativeEnglishLabels)||!observed.nativeEnglishLabels.every(x=>typeof x==='string'&&observed.dom.includes('"'+x+'"'))||typeof observed.uiLanguage!=='string'||!observed.actualSourceViewport||!['width','height','deviceScaleFactor'].every(k=>Number.isFinite(observed.actualSourceViewport[k])&&observed.actualSourceViewport[k]>0))throw Error('Map observation aliases require their actual full DOM and native viewport')
    for(const [key,value] of [['accountButton',observed.accountLabel],['documentLanguage',observed.uiLanguage],['visibleButtonLabels',observed.nativeEnglishLabels]])if(Object.prototype.hasOwnProperty.call(observed,key)&&JSON.stringify(observed[key])!==JSON.stringify(value))throw Error('Map observation alias conflicts with canonical native evidence')
    observed={...observed,accountButton:observed.accountLabel,documentLanguage:observed.uiLanguage,visibleButtonLabels:observed.nativeEnglishLabels}
  }
  const has=key=>Object.prototype.hasOwnProperty.call(observed,key)
  const list=value=>Array.isArray(value)&&value.every(x=>typeof x==='string')
  if(has('labels')&&!list(observed.labels))throw Error('Observed label alias must be an actual string array')
  if(has('visibleButtonLabels')&&!list(observed.visibleButtonLabels))throw Error('Observed button labels must be an actual string array')
  const accounts=(observed.labels||[]).filter(x=>/^\s*Google Account:/.test(x))
  if(accounts.length>1)throw Error('Observed account labels are ambiguous')
  if(has('accountButton')&&typeof observed.accountButton!=='string')throw Error('Observed account button must be a native label string')
  const accountButton=has('accountButton')?observed.accountButton:accounts[0]
  const email=value=>typeof value==='string'&&value.includes('Google Account:')?value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]:[]
  const selected=email(accountButton),alias=email(accounts[0])
  if(selected.length!==1||(has('accountButton')&&accounts.length&&JSON.stringify(selected)!==JSON.stringify(alias)))throw Error('Actual selected native account label is missing or conflicts with aliases')
  if(has('documentLanguage')&&typeof observed.documentLanguage!=='string'||has('lang')&&typeof observed.lang!=='string')throw Error('Actual document language must be a string')
  if(has('documentLanguage')&&has('lang')&&observed.documentLanguage.split('-')[0]!==observed.lang.split('-')[0])throw Error('Actual document language conflicts with its alias')
  return {accountButton,accountEmail:selected[0],documentLanguage:has('documentLanguage')?observed.documentLanguage:observed.lang,visibleButtonLabels:has('visibleButtonLabels')?observed.visibleButtonLabels:observed.labels}
}

export function validateNotebookAppReaderContext(child,readerDirectory) {
  const c=child.notebookProductionContext
  if(child.accountDomain!=='unimib.it'||child.uiLanguage!=='en'||c?.accountDomain!=='unimib.it'||c.uiLanguage!=='en'||c.version!=='unimib-english-2026-11-08')throw Error('Standalone reader requires native Unimib English context')
  const started=Date.parse(child.startedAt)
  if(!Number.isFinite(started)||started!==child.started)throw Error('Standalone start clocks disagree')
  for(const [kind,proof,method] of [['account',c.accountSelector,'native-account-selector'],['interface',c.englishInterface,'native-ui-labels']]) {
    const window=proof?.captureTime,exact=Date.parse(proof?.capturedAt)
    const begin=Number.isFinite(exact)?exact:Date.parse(window?.earliest),end=Number.isFinite(exact)?exact:Date.parse(window?.latest)
    if(proof?.method!==method||!proof.reviewedBy||!Number.isFinite(begin)||!Number.isFinite(end)||begin>end||begin<started-600000||end>started+60000||(!Number.isFinite(exact)&&!window?.basis)||!proof.evidence?.length)throw Error('Standalone context needs bounded fresh native proof')
    let screenshot=false,identity=false
    for(const e of proof.evidence) {
      const f=nativeFile(readerDirectory,e.path)
      if(!/^[a-f0-9]{64}$/.test(e.sha256||'')||sha(f)!==e.sha256)throw Error('Standalone context hash mismatch')
      if(e.kind==='native-screenshot'){png(f);screenshot=true}
      if(e.kind==='read-only-native-ui-observation') {
        const observed=read(f)
        if(observed.url!==child.conversationUrl)throw Error('Standalone context belongs to a different URL')
        const native=normalizeNotebookAppObservation(observed)
        if(kind==='account')identity||=native.accountEmail==='marco.cremaschi@unimib.it'
        else {
          const labels=proof.observedLabels
          identity||=native.documentLanguage?.split('-')[0]==='en'&&Array.isArray(labels)&&new Set(labels.filter(x=>ENGLISH_CONTROLS.has(x))).size>=2&&labels.every(x=>native.visibleButtonLabels?.includes(x))
        }
      }
      if(e.kind==='native-ax') {
        const observed=fs.readFileSync(f,'utf8')
        if(!observed.includes(child.conversationUrl))throw Error('Standalone AX belongs to a different URL')
        if(kind==='account')identity||=/Google Account:[^\n]*\bmarco\.cremaschi@unimib\.it\b/i.test(observed)
        else {
          const labels=proof.observedLabels
          identity||=Array.isArray(labels)&&new Set(labels.filter(x=>ENGLISH_CONTROLS.has(x))).size>=2&&labels.every(label=>observed.split('\n').some(line=>/^\s*\d+\s+(?:button|heading|text entry area)\b/.test(line)&&line.includes(label)))
        }
      }
    }
    if(!screenshot||!identity||(kind==='account'?proof.observedDomain!=='unimib.it':proof.observedLanguage!=='en'))throw Error('Standalone native account/English identity is not established')
  }
}

/** Only an explicitly reviewed, wholly omitted closed technical window may
 * remain failed in the immutable parent. Policy denials are never retakes.
 * Rendering must carry the same exclusion, because framing may override it.
 */
export function qualifyNotebookAppTechnicalRetakes({capture,original,rawCaptureSha256,openActionAt,openFrameAt,renderExcludedRanges}) {
  const windows=original.recordingWindows||[],failed=windows.filter(w=>w.failure),review=capture.nativeTechnicalRetakeReview
  const text=v=>typeof v==='string'&&v.trim().length>0
  if(!failed.length){if(review)throw Error('Technical retake review has no actual failed parent window');return []}
  if(review?.schemaVersion!==1||review.rawCaptureSha256!==rawCaptureSha256||!text(review.reviewedBy)||!text(review.reason)||!Array.isArray(review.windows)||review.windows.length!==failed.length)throw Error('Every failed parent window needs an exact raw-bound technical review')
  const records=[]
  for(const w of failed) {
    if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||!(w.end>w.start)||w.closedBy!=='suspend'||!Number.isFinite(w.confirmedStoppedAt)||w.confirmedStoppedAt!==w.end||w.failure!=='Raw CDP is unavailable while Browser Use is resolving a paused document response.')throw Error('Only the observed closed CDP-paused technical failure can be reviewed')
    const saved=capture.recordingWindows?.filter(x=>x.id===w.id)
    if(saved?.length!==1||JSON.stringify(saved[0])!==JSON.stringify(w))throw Error('Failed parent recording window must remain unchanged in review')
    const matches=review.windows.filter(r=>r.windowId===w.id),r=matches[0]
    if(matches.length!==1||r.start!==w.start||r.end!==w.end||r.failure!==w.failure||!text(r.reviewedBy)||!text(r.reason))throw Error('Technical review must identify the complete actual failed window')
    const ranges=(capture.excludedRanges||[]).filter(x=>x.nativeTechnicalRetakeWindowId===w.id),range=ranges[0]
    if(ranges.length!==1||range.start!==w.start||range.end!==w.end||range.reviewedBy!==r.reviewedBy||range.reason!==r.reason)throw Error('The complete failed window needs its exact explicit review exclusion')
    const excludes=at=>range.start<=at&&at<range.end
    if(w.start<=openActionAt&&openActionAt<=w.end||w.start<=openFrameAt&&openFrameAt<=w.end||excludes(openActionAt)||excludes(openFrameAt))throw Error('Native opening and its post-action proof must remain in a clean retained window')
    for(const event of [...(original.frames||[]),...(original.actions||[])])if(w.start<=event.at&&event.at<=w.end&&!excludes(event.at))throw Error('A failed-window frame or input would remain selected')
    if(renderExcludedRanges!==undefined) {
      if(!Array.isArray(renderExcludedRanges))throw Error('Rendered technical retake exclusions are missing')
      const rendered=renderExcludedRanges.filter(x=>x.nativeTechnicalRetakeWindowId===w.id)
      if(rendered.length!==1||rendered[0].start!==range.start||(rendered[0].requestedEnd??rendered[0].end)!==range.end||!Number.isFinite(rendered[0].end)||rendered[0].end<range.end||rendered[0].reviewedBy!==r.reviewedBy||rendered[0].reason!==r.reason)throw Error('Final render must wholly omit the reviewed failed window')
    }
    records.push({rawCaptureSha256,windowId:w.id,start:w.start,end:w.end,failure:w.failure,reviewedBy:r.reviewedBy,reason:r.reason,fullyExcluded:true,rawWindowUnchanged:true})
  }
  return records
}

export function validateNativeNotebookAppReader({capture,child,retake,item,sourceDirectory,readerDirectory,run,rootDirectory=DEFAULT_ROOT,renderExcludedRanges}) {
  if(item?.service!=='NotebookLM'||!KEYS.has(item.key)||!item.slideId||capture.slideId!==item.slideId)throw Error('Standalone Apps adapter is limited to the three approved Apps scenarios')
  const owner=capture.ownerConversationUrl||capture.conversationUrl,main=parsed(owner),app=parsed(child.conversationUrl,true,true),e=child.evidence||{},mapOpening=!capture.evidence?.nativeAppArtifact,binding=capture.evidence?.nativeAppArtifact||observedNativeMapOpening(capture,capture.immutableRawSource?.captureSha256)
  const opened=parsed(binding?.artifactUrl,true,app.querylessArtifact)
  // Keep both actual URLs. Observed pageId=none is a routing parameter, not a
  // different artifact; never rewrite the actual child URL to the parent URL.
  if(main.notebookId!==app.notebookId||opened.notebookId!==app.notebookId||opened.artifactId!==app.artifactId||child.ownerConversationUrl||child.newNotebook!==false||e.nativeNotebookAppReader!==true||e.parentCaptureKey!==capture.key||e.parentNotebookUrl!==owner||e.sourceUrl!==app.url)throw Error('Standalone artifact, original notebook and reader identity mismatch')
  if(app.querylessArtifact&&opened.url!==app.url)throw Error('Queryless artifact must be the exact actually opened native URL')
  if((capture.book?.sha256||capture.sourceBook?.sha256)!==BOOK||child.book?.sha256!==BOOK||e.sourceBookSha256!==BOOK)throw Error('Standalone reader must retain the exact authorized book')
  for(const c of [capture,child])if(c.accountDomain!=='unimib.it'||c.uiLanguage!=='en')throw Error('Apps capture context must be Unimib English')
  if(![capture,child].every(c=>c.complete&&!c.truncated&&!c.fixture&&c.productionEligible!==false))throw Error('Complete eligible sources are required')
  if(e.resultExport||e.resultSha256||child.resultSha256)throw Error('An Apps reader cannot claim an export')
  const raw=capture.immutableRawSource,rawDirectory=path.resolve(rootDirectory,raw?.directory||''),rawFile=path.join(rawDirectory,'capture.json')
  if(!raw||!inside(rawDirectory,run)||rawDirectory===path.resolve(sourceDirectory)||!fs.existsSync(rawFile)||sha(rawFile)!==raw.captureSha256)throw Error('An immutable complete parent source is required')
  const original=read(rawFile)
  const originalBinding=original.evidence?.nativeAppArtifact||observedNativeMapOpening({...original,nativeAppOpeningReview:capture.nativeAppOpeningReview},raw.captureSha256)
  if(!original.complete||original.key!==capture.key||original.slideId!==capture.slideId||(original.ownerConversationUrl||original.conversationUrl)!==owner||original.started!==capture.started||(original.book?.sha256||original.sourceBook?.sha256)!==BOOK||JSON.stringify(originalBinding)!==JSON.stringify(binding))throw Error('Parent artifact binding must originate in the actual recorder source')
  const reference=binding.openInNewTabAction,a=original.actions?.find(a=>a.at===reference?.at&&a.label===reference?.label)
  const point=a?.click,bounds=point?.bounds
  if(!a||a.kind!=='click'||a.clickSource!=='native-cdp-mouse-input'||a.nativeHitTestPassed!==true||a.nativeInputRequestedAt!==a.at||!(a.nativeInputConfirmedAt>=a.at)||!bounds||![point.x,point.y].every(Number.isFinite)||point.x<bounds.left||point.x>bounds.right||point.y<bounds.top||point.y>bounds.bottom||!a.state?.includes('button Open in new tab'))throw Error('Original parent Open in new tab native input is required')
  const state=original.frames?.find(f=>f.file===a.nativeStateFrame)
  if(!state||state.at<a.nativeInputConfirmedAt||Math.round(state.timestamp*1000-original.started)!==state.at)throw Error('Original Open in new tab post-action frame is required')
  png(nativeFile(rawDirectory,state.file))
  const parentWindows=original.recordingWindows||[],childWindows=child.recordingWindows||[]
  if(!parentWindows.length||!childWindows.length||[...parentWindows,...childWindows].some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<w.start)||childWindows.some(w=>w.failure)||!parentWindows.some(w=>!w.failure&&w.start<=a.at&&state.at<=w.end))throw Error('Native reader requires successfully closed selected recording windows')
  const technicalRetakes=qualifyNotebookAppTechnicalRetakes({capture,original,rawCaptureSha256:raw.captureSha256,openActionAt:a.at,openFrameAt:state.at,renderExcludedRanges})
  const lastParentEnd=Math.max(...parentWindows.map(w=>w.end)),delta=child.started-capture.started
  if(!(delta>=lastParentEnd)||!(child.started>=original.started+a.nativeInputConfirmedAt))throw Error('Standalone reader must chronologically follow its actual opening')
  validateNotebookAppReaderContext(child,readerDirectory)
  for(const action of child.actions||[])if(action.clickSource==='documented-browser-locator-click')qualifyNativeAppLocatorAction({child,action})
  const completedReaderContinuation=completedMapReaderContinuation({capture,original,child,readerDirectory,run,rootDirectory,app,owner})
  const supersededReader=readerSupersession({original,child,readerDirectory,run,rootDirectory,app,owner,completedReaderContinuation})
  if(retake&&(retake.kind!=='native-notebook-app-reader'||retake.artifactUrl!==app.url||retake.openedArtifactUrl!==opened.url||retake.parentNotebookUrl!==owner||retake.doesNotSupplyResult!==true||retake.suppliesOnlyNativeUseEvidence!==true||retake.resultSha256||retake.childResult||retake.resultProof||retake.retainsParentResult||retake.openInNewTabAction?.at!==a.at||retake.openInNewTabAction?.label!==a.label))throw Error('Apps reader cannot claim a native export or recipient access')
  if(retake&&JSON.stringify(retake.supersededReader||null)!==JSON.stringify(supersededReader))throw Error('Saved reader supersession differs from the actual incomplete source')
  if(retake&&app.querylessArtifact&&retake.authenticationBasis!=='fresh-native-Unimib-selector-proof-with-authuser-1-parent')throw Error('Queryless artifact requires its explicit native account proof binding')
  if(retake&&JSON.stringify(retake.parentTechnicalRetakes||[])!==JSON.stringify(technicalRetakes))throw Error('Saved reader must preserve the exact excluded parent technical failure review')
  if(retake&&JSON.stringify(retake.parentOpeningReview||null)!==JSON.stringify(mapOpening?capture.nativeAppOpeningReview:null))throw Error('Saved reader must preserve the explicit actual Map opening review')
  if(retake&&JSON.stringify(retake.completedReaderContinuation||null)!==JSON.stringify(completedReaderContinuation))throw Error('Saved reader must preserve its actual completed-reader continuation')
  return {artifactUrl:app.url,openedArtifactUrl:opened.url,parentNotebookUrl:owner,openInNewTabAction:{at:a.at,label:a.label},lastParentEnd,delta,supersededReader,querylessArtifact:app.querylessArtifact,technicalRetakes,...(mapOpening?{openingReview:capture.nativeAppOpeningReview}:{}),...(completedReaderContinuation?{completedReaderContinuation}:{})}
}

/** Append only to an independent reviewed parent copy; originals remain intact. */
export function composeNativeNotebookAppReader({parentDirectory,readerDirectory,reviewedBy,reason,key,rootDirectory=DEFAULT_ROOT}) {
  const parent=path.resolve(parentDirectory),reader=path.resolve(readerDirectory),run=path.dirname(path.dirname(parent)),staging=path.join(rootDirectory,'output/review/video-refresh')
  if(!inside(run,staging)||path.basename(path.dirname(parent))!=='captures'||path.dirname(parent)!==path.dirname(reader)||parent===reader||!reviewedBy||!reason)throw Error('Use two separate staged captures and an explicit review')
  const pf=path.join(parent,'capture.json'),cf=path.join(reader,'capture.json'),capture=read(pf),child=read(cf),before=sha(pf),childSha=sha(cf)
  const item=read(path.join(run,'inventory.json')).items.find(i=>i.key===key)
  const binding=validateNativeNotebookAppReader({capture,child,item,sourceDirectory:parent,readerDirectory:reader,run,rootDirectory})
  if(capture.nativeUsageRetakes?.some(r=>r.origin.captureSha256===childSha))throw Error('Standalone reader already composed')
  const rel=f=>path.relative(rootDirectory,f).split(path.sep).join('/'),origin={capturePath:rel(reader),captureSha256:childSha},namespace='native-app-reader-'+child.key+'-'+childSha.slice(0,8)
  const frames=child.frames.map(f=>{
    const source=nativeFile(reader,f.file),dimensions=png(source),viewport=f.viewport||child.sourceViewport
    if(!viewport?.width||!viewport?.height||Math.abs(dimensions.width/viewport.width-dimensions.height/viewport.height)>.01||Math.round(f.timestamp*1000-child.started)!==f.at)throw Error('Actual Apps frame geometry/absolute clock mismatch')
    const file=namespace+'/'+f.file,target=path.resolve(parent,file)
    if(!inside(target,parent))throw Error('Apps destination escapes reviewed source')
    return {...f,file,at:Math.round(f.timestamp*1000-capture.started),viewport,cropPixels:[0,0,dimensions.width,dimensions.height],framingGroup:'native-notebook-app-viewport',nativeRetakeOrigin:{...origin,file:f.file,sourceAt:f.at,timestamp:f.timestamp,sha256:sha(source)}}
  })
  if(!frames.length)throw Error('Actual standalone App frames required')
  const joinAt=Math.min(...frames.map(f=>f.at)),replaceFrom=Math.max(...capture.recordingWindows.map(w=>w.end))
  if(!(joinAt>replaceFrom))throw Error('Standalone footage overlaps existing native footage')
  const idStart=Math.max(...capture.recordingWindows.map(w=>w.id))+1,ids=new Map(child.recordingWindows.map((w,i)=>[w.id,idStart+i])),delta=binding.delta
  const windows=child.recordingWindows.map(w=>({...shift(w,delta),id:ids.get(w.id),nativeRetakeOrigin:{...origin,windowId:w.id}}))
  const actionOffset=capture.actions.length,actions=child.actions.map(a=>({...shift(a,delta),...(a.nativeStateFrame?{nativeStateFrame:namespace+'/'+a.nativeStateFrame}:{}),nativeRetakeOrigin:{...origin,sourceAt:a.at,label:a.label}}))
  const holds=(child.deliberateHolds||[]).map(h=>({...shift(h,delta),recordingWindowId:ids.get(h.recordingWindowId),nativeRetakeOrigin:origin}))
  const steps=(child.stepTimings||[]).map(s=>({...shift(s,delta),recordingWindowId:ids.get(s.recordingWindowId),...(Number.isInteger(s.actionIndex)?{actionIndex:s.actionIndex+actionOffset}:{}),nativeRetakeOrigin:origin}))
  const retainedEndAt=delta+Math.max(...child.recordingWindows.map(w=>w.end))
  const retake={kind:'native-notebook-app-reader',origin:{...origin,key:child.key,started:child.started},originalCaptureSha256:before,deltaMs:delta,replaceFrom,joinAt,retainedEndAt,artifactUrl:binding.artifactUrl,openedArtifactUrl:binding.openedArtifactUrl,parentNotebookUrl:binding.parentNotebookUrl,openInNewTabAction:binding.openInNewTabAction,...(binding.querylessArtifact?{authenticationBasis:'fresh-native-Unimib-selector-proof-with-authuser-1-parent'}:{}),...(binding.supersededReader?{supersededReader:binding.supersededReader}:{}),...(binding.technicalRetakes.length?{parentTechnicalRetakes:binding.technicalRetakes}:{}),...(binding.openingReview?{parentOpeningReview:binding.openingReview}:{}),...(binding.completedReaderContinuation?{completedReaderContinuation:binding.completedReaderContinuation}:{}),doesNotSupplyResult:true,suppliesOnlyNativeUseEvidence:true,reviewedBy,reason,composedAt:new Date().toISOString(),policy:'Actual native standalone Apps footage appended chronologically. Both actually observed parent-opened and child URLs are retained; queryless artifacts require the exact native-opened URL and fresh Unimib selector proof with an authuser1 parent. Source PNG bytes and absolute timestamps stay unchanged. This adapter supplies neither an export nor recipient verification.'}
  validateNativeNotebookAppReader({capture,child,retake,item,sourceDirectory:parent,readerDirectory:reader,run,rootDirectory})
  // Validate every source before writing a byte. Never edit raw source or child.
  for(const f of frames){const source=nativeFile(reader,f.nativeRetakeOrigin.file),target=path.resolve(parent,f.file);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){if(sha(target)!==sha(source))throw Error('Different copied native pixels already exist')}else fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL)}
  const backup=path.join(parent,'capture.before-native-app-reader-'+before.slice(0,12)+'.json');if(!fs.existsSync(backup))fs.copyFileSync(pf,backup,fs.constants.COPYFILE_EXCL)
  capture.frames.push(...frames);capture.actions.push(...actions);capture.recordingWindows.push(...windows)
  capture.phases.push(...child.phases.map(p=>({...p,at:p.at+delta,category:'usage',speed:1,nativeRetakeOrigin:origin})))
  capture.deliberateHolds=[...(capture.deliberateHolds||[]),...holds];capture.stepTimings=[...(capture.stepTimings||[]),...steps]
  capture.durationMs=retainedEndAt;capture.excludedRanges=[...(capture.excludedRanges||[]),{start:replaceFrom,end:joinAt,reviewedBy,reason:'Only the actual recorder-off gap before the later standalone App; all in-window reading and native use is retained.'}]
  capture.nativeUsageRetakes=[...(capture.nativeUsageRetakes||[]),retake]
  capture.evidence.nativeNotebookAppReader={...origin,artifactUrl:binding.artifactUrl,openedArtifactUrl:binding.openedArtifactUrl,doesNotSupplyResult:true}
  const tmp=path.join(parent,'.capture.native-app-reader.tmp');fs.writeFileSync(tmp,JSON.stringify(capture,null,2)+'\n');fs.renameSync(tmp,pf)
  if(sha(cf)!==childSha)throw Error('Original standalone reader changed during composition')
  return {composed:true,captureSha256:sha(pf),childCaptureUnchanged:true,framesAdded:frames.length,windowsAdded:windows.length,joinAt,retainedEndAt,resultVerificationSupplied:false}
}
