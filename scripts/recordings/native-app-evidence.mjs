/** Read-only Apps input/download evidence. Never drives a browser or fetches. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {mapNativeFramePoint,validateFrameLocatorBinding,nativeFrameGeometryStable,nativeFrameInputContract} from './native-frame-click.mjs'

const MODULE_DIR=path.dirname(fileURLToPath(import.meta.url)),NEAR_ROOT=path.resolve(MODULE_DIR,'../..')
const ROOT=fs.existsSync(path.join(NEAR_ROOT,'scripts/recordings/file-result-support.mjs'))?NEAR_ROOT:path.resolve(MODULE_DIR,'../../../../..')
const BOOK='f8131615212f15aeb864847af774fc79184d22b1193bb5e5c5b99147aa7c9981'
const SLIDES=new Set(['S67CARDS','S67','S66']),finite=n=>typeof n==='number'&&Number.isFinite(n)
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const close=(a,b,t=.01)=>finite(a)&&finite(b)&&Math.abs(a-b)<=t
const nativeFile=(directory,name)=>{const f=path.resolve(directory,name||'');if(!f.startsWith(path.resolve(directory)+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile())throw Error('Native file is missing or escapes its capture');return f}
const readerIdentity=child=>{
  const u=new URL(child.conversationUrl),p=new URL(child.evidence?.parentNotebookUrl),match=u.pathname.match(/^\/notebook\/([a-f0-9-]{36})\/artifact\/[a-f0-9-]{36}$/)
  const auth=u.searchParams.getAll('authuser'),context=child.notebookProductionContext
  const artifactAuth=(auth.length===1&&auth[0]==='1')||(auth.length===0&&context?.accountSelector?.method==='native-account-selector'&&context.accountSelector.observedDomain==='unimib.it'&&context.englishInterface?.observedLanguage==='en')
  if(child.fixture||child.service!=='NotebookLM'||!SLIDES.has(child.slideId)||child.accountDomain!=='unimib.it'||child.uiLanguage!=='en'||child.book?.sha256!==BOOK||child.evidence?.nativeNotebookAppReader!==true||child.newNotebook!==false||u.origin!=='https://notebook.google.com'||p.origin!==u.origin||!match||p.pathname!=='/notebook/'+match[1]||!artifactAuth||p.searchParams.getAll('authuser').length!==1||p.searchParams.get('authuser')!=='1'||child.evidence?.sourceUrl!==child.conversationUrl)throw Error('Only an actual institutional English Apps reader may qualify framed locator input')
}

/** Honest target-centre markers for actual documented locator activations.
 * v5 retains first point/proof plus the final full geometry. Its first local
 * rectangle is not reconstructed. v6+ additionally retains the first sample.
 */
export function qualifyNativeAppLocatorAction({child,action}) {
  readerIdentity(child)
  const expected=nativeFrameInputContract('documented-locator-click'),p=action.nativeFrameHitTest||{}
  if(action.kind!=='click'||Object.entries(expected).some(([k,v])=>action[k]!==v)||action.nativeHitTestPassed!==true||p.method!=='documented-same-selector-native-frameLocator-and-readonly-global-local-DOM-hit-tests-before-actual-input'||p.scopedWindowIdentityUsedAsProof!==false||p.CDPFrameTreeUsedAsProof!==false||!finite(p.stabilityTolerancePx)||p.stabilityTolerancePx<0||p.stabilityTolerancePx>.75)throw Error('Documented Apps activation needs its actual source and hit-test contract')
  const proof=p.frameProof,firstProof=p.firstFrameProof
  if(proof?.role==='menuitem'&&proof.name==='Retake missed questions'&&child.slideId!=='S67')throw Error('Only the actual Quiz reader may qualify Retake missed questions')
  if(proof?.role==='treeitem'&&child.slideId!=='S66')throw Error('Only the actual native Mind Map reader may qualify its observed tree branches')
  const contract=proof?.locatorKind==='text'?{frameSelector:proof.frameSelector,text:proof.name,exact:proof.exact}:{frameSelector:proof?.frameSelector,role:proof?.role,name:proof?.name,exact:proof?.exact,...(proof?.descendant?{descendant:proof.descendant}:{})}
  validateFrameLocatorBinding(p.outer,p.local,child.conversationUrl,contract)
  const point=mapNativeFramePoint(p.outer,p.local,child.sourceViewport,proof)
  for(const k of ['frameSelector','rootDocumentUrl','documentUrl','actualIframeSrc','role','name','descendant','exact','method'])if(firstProof?.[k]!==proof?.[k])throw Error('Two actual Apps checks must identify the same document and target')
  for(const k of ['uniqueRootOwner','sameSelectorConstructedByHelper'])if(firstProof?.[k]!==true)throw Error('First native Apps binding is incomplete')
  if(firstProof.localNestedFrameCount!==0||firstProof.scopedWindowIdentityUsedAsProof!==false||firstProof.CDPFrameTreeUsedAsProof!==false||!close(p.firstGlobalPoint?.x,point.x,p.stabilityTolerancePx)||!close(p.firstGlobalPoint?.y,point.y,p.stabilityTolerancePx)||!close(p.globalPoint?.x,point.x)||!close(p.globalPoint?.y,point.y))throw Error('Actual first/final native points are unstable or mismatched')
  const hasFirst=p.firstOuter!==undefined||p.firstLocal!==undefined
  if(hasFirst){validateFrameLocatorBinding(p.firstOuter,p.firstLocal,child.conversationUrl,contract);const first=mapNativeFramePoint(p.firstOuter,p.firstLocal,child.sourceViewport,firstProof);if(!nativeFrameGeometryStable(first,point,p.stabilityTolerancePx))throw Error('Recorded first/final native geometry differs')}
  if(!close(action.click?.x,point.x)||!close(action.click?.y,point.y)||['left','top','right','bottom','width','height'].some(k=>!close(action.click?.bounds?.[k],point.bounds[k]))||action.nativeInputRequestedAt!==action.at||!finite(action.nativeInputConfirmedAt)||action.nativeInputConfirmedAt<action.at)throw Error('Actual locator request clocks or observed target centre differ')
  const post=child.frames?.find(f=>f.file===action.nativeStateFrame)
  if(!post||post.at<action.nativeInputConfirmedAt)throw Error('Actual native post-input source frame is required')
  return {sourceCaptureKey:child.key,sourceActionAt:action.at,sourceUrl:child.conversationUrl,inputMethod:'documented-locator-click',markerMeaning:'activated-control-center',exactDeliveredPointerCoordinatesExposed:false,firstFullGeometryRetained:hasFirst,profile:hasFirst?'v6-or-later-two-retained-samples':'v5-first-point-and-binding-final-full-geometry',firstGeometryReconstructed:false,postFrame:post.file,disclosure:'Measured centre of the native control addressed by the documented iframe locator; exact delivered pointer coordinates are not exposed. Native UI outcome and meaningful use require separate visual review.'}
}

/** Qualify only unchanged actions appended by the narrow Apps reader adapter. */
export function qualifyNativeAppRenderActions({capture,rootDirectory=ROOT}) {
  // Other native products have distinct root-document input profiles. Returning
  // no Apps qualifications never qualifies their markers; their own gate must.
  if(!capture.nativeUsageRetakes?.some(r=>r.kind==='native-notebook-app-reader')&&!capture.actions?.some(a=>a.nativeFrameHitTest))return []
  const qualifications=[]
  for(const action of capture.actions||[]) {
    if(action.clickSource!=='documented-browser-locator-click')continue
    const origin=action.nativeRetakeOrigin,retake=capture.nativeUsageRetakes?.find(r=>r.kind==='native-notebook-app-reader'&&r.origin?.captureSha256===origin?.captureSha256)
    if(!origin||!retake||retake.doesNotSupplyResult!==true)throw Error('Documented Apps activation must originate in its actual composed reader')
    const file=path.resolve(rootDirectory,origin.capturePath,'capture.json')
    if(!file.startsWith(path.join(rootDirectory,'output/review/video-refresh')+path.sep)||!fs.existsSync(file)||sha(file)!==origin.captureSha256)throw Error('Actual Apps activation reader source changed')
    const child=read(file),original=child.actions.find(a=>a.at===origin.sourceAt&&a.label===origin.label)
    if(!child.complete||!original||child.evidence?.parentCaptureKey!==capture.key||child.evidence?.parentNotebookUrl!==(capture.ownerConversationUrl||capture.conversationUrl)||Math.round((child.started+original.at)-capture.started)!==action.at)throw Error('Actual Apps activation owner or event clock differs')
    const mapReview=retake.parentOpeningReview,recovery=capture.evidence?.nativeAppRecovery
    const reviewedMapOpening=capture.key==='notebook-mind-map-unimib-take1'&&capture.slideId==='S66'&&mapReview?.schemaVersion===1&&mapReview.rawCaptureSha256===capture.immutableRawSource?.captureSha256&&mapReview.observedBindingField==='evidence.nativeAppRecovery'&&mapReview.openInNewTabAction?.at===27804624&&mapReview.openInNewTabAction.label==='Open this generated map in a new tab'&&recovery?.actualNativeOpenInNewTab===true&&recovery.sourceUrl===child.conversationUrl&&retake.openedArtifactUrl===child.conversationUrl
    if(!new URL(child.conversationUrl).searchParams.has('authuser')&&(retake.authenticationBasis!=='fresh-native-Unimib-selector-proof-with-authuser-1-parent'||(capture.evidence?.nativeAppArtifact?.artifactUrl!==child.conversationUrl&&!reviewedMapOpening)))throw Error('Queryless Apps activation must preserve its exact native-opened URL and account proof binding')
    for(const k of ['click','clickSource','clickCoordinateSource','nativeInputMethod','nativeCDPPressReleaseSent','deliveredPointerCoordinatesExposed','nativeHitTestPassed','nativeFrameHitTest'])if(JSON.stringify(original[k])!==JSON.stringify(action[k]))throw Error('Actual Apps input proof was changed in the review copy')
    validateNativeQuizCaptionReview({child,original,action,readerDirectory:path.dirname(file)})
    qualifications.push({...qualifyNativeAppLocatorAction({child,action:original}),parentSourceAt:action.at})
  }
  return qualifications
}

/** Correct one observed editorial caption, never the native input or label. */
export function validateNativeQuizCaptionReview({child,original,action,readerDirectory}) {
  const review=action.nativeCaptionReview
  if(action.label===original.label){if(review)throw Error('Caption review must describe an actual editorial correction');return null}
  if(child.slideId!=='S67'||original.label!=='Continue to probability versus truth'||action.label!=='Continue to the next question'||original.nativeFrameHitTest?.frameProof?.name!=='Next question'||action.nativeRetakeOrigin?.label!==original.label||review?.schemaVersion!==1||review.originalLabel!==original.label||review.reviewedLabel!==action.label||typeof review.reviewedBy!=='string'||!review.reviewedBy.trim()||typeof review.reason!=='string'||!review.reason.trim()||review.nativeStateFrame!==original.nativeStateFrame||review.nativeStateFrameSha256!==sha(nativeFile(readerDirectory,original.nativeStateFrame)))throw Error('Changed native Quiz caption requires its narrow original-frame-bound review')
  return {originalLabel:original.label,reviewedLabel:action.label,nativeStateFrameSha256:review.nativeStateFrameSha256,reviewedBy:review.reviewedBy,reason:review.reason,nativeInputUnchanged:true}
}

/** Bind a true child-artifact Download set to the exact composed parent video.
 * This does not grant stateless/guest access or approve native file fidelity.
 */
export function validateNativeSetDownloadBinding({capture,sourceDirectory,metadata,artifact,item,run,rootDirectory=ROOT}) {
  if(metadata?.method==='user-performed-native-download')return validateUserNativeSetDownloadBinding({capture,sourceDirectory,metadata,artifact,item,run,rootDirectory})
  if(item?.service!=='NotebookLM'||!['notebook-flashcards','notebook-quiz','notebook-mind-map'].includes(item.key)||metadata?.method!=='native-download'||metadata.controlLabel!=='Download set'||metadata.clipboardSha256||metadata.copySurface)throw Error('Only actual native Apps Download set files use this binding')
  const declared=metadata.nativeSetDownload,reader=path.resolve(rootDirectory,declared?.readerCapturePath||''),file=path.join(reader,'capture.json')
  if(!reader.startsWith(path.resolve(run)+path.sep)||!fs.existsSync(file)||!declared?.readerCaptureSha256||sha(file)!==declared.readerCaptureSha256||declared.readerSourceFinalizationPending!==false)throw Error('Actual completed Apps download source is required')
  const child=read(file),owner=capture.ownerConversationUrl||capture.conversationUrl
  const retake=capture.nativeUsageRetakes?.find(r=>r.kind==='native-notebook-app-reader'&&r.origin?.captureSha256===declared.readerCaptureSha256&&path.resolve(rootDirectory,r.origin.capturePath)===reader)
  if(!capture.complete||!child.complete||!retake||retake.artifactUrl!==child.conversationUrl||metadata.sourceUrl!==child.conversationUrl||declared.sourceUrl!==child.conversationUrl||declared.parentNotebookUrl!==owner||metadata.parentNotebookUrl!==owner||child.evidence.parentCaptureKey!==capture.key||child.evidence.parentNotebookUrl!==owner||declared.readerCaptureKey!==child.key||declared.readerCaptureStartedAt!==child.startedAt||declared.sourceBookSha256!==BOOK)throw Error('Apps download must bind this exact parent and actual artifact reader')
  const action=child.actions.find(a=>a.at===declared.downloadAction?.at&&a.label===declared.downloadAction?.label)
  if(!action||action.nativeFrameHitTest?.frameProof?.name!=='Download set')throw Error('Actual native Download set action is missing')
  const inputQualification=qualifyNativeAppLocatorAction({child,action})
  const sourceArtifact=path.resolve(declared.file?.actualPath||'')
  if(!sourceArtifact.startsWith(path.join(reader,'native-export')+path.sep)||!fs.existsSync(sourceArtifact)||!fs.realpathSync(sourceArtifact).startsWith(fs.realpathSync(path.join(reader,'native-export'))+path.sep)||!fs.existsSync(artifact)||sha(sourceArtifact)!==sha(artifact)||sha(artifact)!==declared.file?.sha256||metadata.artifactSha256!==sha(artifact)||fs.statSync(artifact).size!==declared.file.bytes)throw Error('Exact original native set bytes must be preserved inside the reader export directory')
  if(Date.parse(metadata.exportedAt)<child.started+action.nativeInputConfirmedAt||!Number.isFinite(Date.parse(metadata.exportedAt)))throw Error('Native set export time must follow its actual input')
  const menu=child.frames.find(f=>f.file===declared.menuFrame?.file),post=child.frames.find(f=>f.file===declared.postFrame?.file)
  if(!menu||menu.at>action.at||action.at-menu.at>60000||!child.recordingWindows.some(w=>w.start<=menu.at&&action.nativeInputConfirmedAt<=w.end)||!post||post.file!==action.nativeStateFrame||post.at<action.nativeInputConfirmedAt||sha(nativeFile(reader,menu.file))!==declared.menuFrame.sha256||sha(nativeFile(reader,post.file))!==declared.postFrame.sha256)throw Error('Native set menu/post-input pixels differ from the actual reader')
  for(const [role,digest] of [['native-set-download-menu',declared.menuFrame.sha256],['native-set-download-post-input',declared.postFrame.sha256]])if(!metadata.uiEvidence?.some(e=>e.kind==='native-screenshot'&&e.role===role&&e.sha256===digest))throw Error('Native set provenance UI evidence must preserve the actual menu and post-input pixels')
  return {schemaVersion:1,readerCapturePath:declared.readerCapturePath,readerCaptureKey:child.key,readerCaptureSha256:declared.readerCaptureSha256,readerCaptureStartedAt:child.startedAt,sourceUrl:child.conversationUrl,parentNotebookUrl:owner,sourceBookSha256:BOOK,downloadAction:{at:action.at,label:action.label},fileSha256:sha(artifact),fileBytes:fs.statSync(artifact).size,menuFrame:{file:menu.file,sha256:declared.menuFrame.sha256},postFrame:{file:post.file,sha256:declared.postFrame.sha256},inputQualification,guestOrStatelessVerificationSupplied:false,nativeFileFidelityApprovalSupplied:false}
}

const csvRows=file=>JSON.parse(execFileSync('python3',['-c','import csv,json,sys; f=open(sys.argv[1],encoding="utf-8-sig",newline=""); print(json.dumps(list(csv.reader(f,strict=True)),ensure_ascii=False))',file],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}))
const proofReference=(reference,run,rootDirectory)=>{
  const f=path.resolve(rootDirectory,reference?.path||'')
  if(!f.startsWith(path.resolve(run)+path.sep)||!fs.existsSync(f)||sha(f)!==reference?.sha256)throw Error('Actual user handoff or card-match sidecar is missing or changed')
  return {file:f,value:read(f)}
}
const userFlashcardFacts=({metadata,artifact,item,run,rootDirectory})=>{
  if(item?.key!=='notebook-flashcards'||item.service!=='NotebookLM'||metadata.method!=='user-performed-native-download'||metadata.controlLabel!=='Download set'||metadata.performedBy!=='user'||metadata.actualUserClickTimeKnown!==false||metadata.rootRecordedDownloadAttemptDeliveredFile!==false||metadata.downloadAction||metadata.clipboardSha256||metadata.copySurface||metadata.downloadEventBridgeConfirmed||metadata.exportedAtMeaning!=='actual-user-file-handoff-observation-time; exact user click and download completion times are unknown')throw Error('Only explicit user-performed native Flashcards CSV handoffs use this contract')
  const d=metadata.nativeSetDownload
  if(d?.acquisitionMethod!=='user-performed-native-download')throw Error('User download acquisition method is missing')
  const handoffProof=proofReference(d.userHandoffEvidence,run,rootDirectory),matchProof=proofReference(d.cardMatchesEvidence,run,rootDirectory),h=handoffProof.value,m=matchProof.value
  const reader=path.resolve(rootDirectory,h.sourceReaderPath||''),source=path.join(reader,'capture.json')
  if(!reader.startsWith(path.resolve(run)+path.sep)||!fs.existsSync(source)||sha(source)!==h.sourceReaderCaptureSha256||h.sourceReaderCaptureSha256!==m.sourceReaderCaptureSha256||h.sourceReaderPath!==m.sourceReaderPath)throw Error('User handoff must identify the same exact completed native reader')
  const child=read(source);readerIdentity(child)
  if(!child.complete||h.kind!=='user-supplied-native-download-handoff-observation'||!h.userAttestation||!h.attestationRecordedBy||h.actualUserClickTimeKnown!==false||h.rootRecordedDownloadAttemptDeliveredFile!==false||h.noNativeRawSourceChanges!==true||h.artifactUrl!==child.conversationUrl||m.sourceUrl!==child.conversationUrl||metadata.sourceUrl!==child.conversationUrl||metadata.parentNotebookUrl!==child.evidence.parentNotebookUrl||h.parentNotebookUrl!==child.evidence.parentNotebookUrl||metadata.exportedAt!==h.observedAt||!Number.isFinite(Date.parse(h.observedAt))||Date.parse(h.observedAt)<child.started+child.durationMs)throw Error('Actual user handoff must remain separate from the earlier recorded attempt')
  const nativePath=path.resolve(rootDirectory,h.originalFile?.stagedPath||'')
  if(!nativePath.startsWith(path.join(run,'notebook-flashcards/native-export')+path.sep)||!fs.existsSync(nativePath)||path.extname(nativePath)!=='.csv'||!fs.existsSync(artifact)||sha(nativePath)!==sha(artifact)||sha(artifact)!==h.originalFile.sha256||metadata.artifactSha256!==sha(artifact)||fs.statSync(artifact).size!==h.originalFile.bytes||m.originalFile?.sha256!==sha(artifact)||m.originalFile.bytes!==fs.statSync(artifact).size||path.resolve(rootDirectory,m.originalFile.path)!==nativePath||h.originalFile.byteIdentical!==true)throw Error('Preserve the exact user-supplied native CSV bytes without a conversion')
  const rows=csvRows(artifact)
  if(rows.length!==18||rows.some(row=>row.length!==2||row.some(x=>!x.trim()))||m.csvFormat?.header!==false||m.csvFormat.records!==rows.length||m.csvFormat.columns!==2||m.nativeVisibleDeckCount!==rows.length||m.all18RowsParsed!==true||m.userHandoffSeparateFromRecordedRootDownloadAttempt!==true||m.rootAttemptAt480068DidNotReturnFile!==true||!m.reviewedBy||!Number.isFinite(Date.parse(m.reviewedAt))||m.samples?.length!==3)throw Error('Native Flashcards CSV and independently reviewed source samples differ')
  const screenshots=[]
  for(let i=0;i<3;i++) {
    const sample=m.samples[i]
    if(sample.csvRecord!==i+1||sample.nativeCardNumber!==i+1||sample.csvQuestion!==rows[i][0]||sample.csvAnswer!==rows[i][1]||sample.visualQuestionMatches!==true||sample.visualAnswerMatches!==true||!sample.matchBasis||sample.nativeFrameEvidence?.length!==2)throw Error('The first three native questions and answers must exactly match the original CSV')
    for(const [role,text] of [['question',rows[i][0]],['answer',rows[i][1]]]) {
      const e=sample.nativeFrameEvidence.find(e=>e.role===role),f=child.frames.find(f=>f.file===e?.file&&f.at===e.sourceAt&&f.timestamp===e.timestamp)
      if(!f||path.resolve(rootDirectory,e.path)!==path.join(reader,f.file)||sha(nativeFile(reader,f.file))!==e.sha256||!child.actions.some(a=>(a.state||'').includes(text)))throw Error('Native card match must bind actual unchanged PNG pixels and exact observed AX wording')
      screenshots.push({file:f.file,role:'native-card-'+(i+1)+'-'+role})
    }
  }
  const related=child.actions.find(a=>a.at===metadata.relatedRecordedControlAt&&a.at===h.rootAttemptAtSourceMs)
  if(!related||related.nativeFrameHitTest?.frameProof?.name!=='Download set'||child.evidence.nativeDownloadAttempt?.fileReceived!==false||child.evidence.nativeDownloadAttempt?.actionAt!==related.at)throw Error('Recorded root control is supporting context only and must retain its failed-file outcome')
  qualifyNativeAppLocatorAction({child,action:related})
  return {child,reader,h,m,rows,nativePath,screenshots,handoffProof,matchProof}
}

export function validateUserNativeSetDownloadBinding({capture,sourceDirectory,metadata,artifact,item,run,rootDirectory=ROOT}) {
  const facts=userFlashcardFacts({metadata,artifact,item,run,rootDirectory}),{child,h,m,reader}=facts,owner=capture.ownerConversationUrl||capture.conversationUrl
  const retake=capture.nativeUsageRetakes?.find(r=>r.kind==='native-notebook-app-reader'&&r.origin?.captureSha256===h.sourceReaderCaptureSha256&&path.resolve(rootDirectory,r.origin.capturePath)===reader)
  if(!capture.complete||!retake||retake.artifactUrl!==child.conversationUrl||child.evidence.parentCaptureKey!==capture.key||owner!==h.parentNotebookUrl)throw Error('User native download must belong to the actual Apps reader composed into this parent video')
  for(const e of facts.screenshots)if(!metadata.uiEvidence?.some(p=>p.kind==='native-screenshot'&&p.role===e.role&&p.sha256===sha(path.join(reader,e.file))))throw Error('User export provenance must preserve the six actual native card screenshots')
  return {schemaVersion:1,acquisitionMethod:'user-performed-native-download',readerCapturePath:h.sourceReaderPath,readerCaptureKey:child.key,readerCaptureSha256:h.sourceReaderCaptureSha256,sourceUrl:child.conversationUrl,parentNotebookUrl:owner,sourceBookSha256:BOOK,fileSha256:sha(artifact),fileBytes:fs.statSync(artifact).size,csvRecords:18,csvColumns:2,csvHeader:false,visuallyMatchedNativeCards:3,all18NativeCardsVisuallyReviewed:false,userHandoffEvidence:metadata.nativeSetDownload.userHandoffEvidence,cardMatchesEvidence:metadata.nativeSetDownload.cardMatchesEvidence,relatedRecordedControlAt:metadata.relatedRecordedControlAt,actualUserClickTimeKnown:false,rootRecordedDownloadAttemptDeliveredFile:false,exportedAtMeaning:metadata.exportedAtMeaning,guestOrStatelessVerificationSupplied:false}
}

/** Build provenance from the actual explicit user handoff and independent QA. */
export function inspectUserNativeSetDownload({artifactPath,userHandoffEvidence,cardMatchesEvidence,provenanceDirectory,run,rootDirectory=ROOT}) {
  const h=proofReference(userHandoffEvidence,run,rootDirectory).value
  const metadata={method:'user-performed-native-download',controlLabel:'Download set',performedBy:'user',sourceUrl:h.artifactUrl,parentNotebookUrl:h.parentNotebookUrl,exportedAt:h.observedAt,exportedAtMeaning:'actual-user-file-handoff-observation-time; exact user click and download completion times are unknown',actualUserClickTimeKnown:false,rootRecordedDownloadAttemptDeliveredFile:false,relatedRecordedControlAt:h.rootAttemptAtSourceMs,artifactSha256:sha(artifactPath),nativeSetDownload:{acquisitionMethod:'user-performed-native-download',userHandoffEvidence,cardMatchesEvidence}}
  const facts=userFlashcardFacts({metadata,artifact:artifactPath,item:{key:'notebook-flashcards',service:'NotebookLM'},run,rootDirectory})
  metadata.uiEvidence=facts.screenshots.map(e=>frameUiEvidence(facts.child,facts.reader,e.file,e.role,provenanceDirectory))
  metadata.disclosure='User explicitly supplied the original native Download set CSV after the recorded root attempt returned no file. The root attempt is supporting function context, not this file acquisition event. All18rows parse; the first3questions/answers match independently reviewed native PNGs and exact source AX. Guest/stateless access remains separate.'
  return metadata
}

const frameUiEvidence=(capture,directory,file,role,provenanceDirectory)=>{
  const f=capture.frames.find(f=>f.file===file),actual=nativeFile(directory,file)
  if(!f||fs.readFileSync(actual).subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Actual native PNG frame evidence is required')
  const window=f.nativeSnapshot?.captureTime
  const time=window?{captureTime:window}:f.nativeSnapshot&&finite(f.nativeSnapshot.requestedAt)&&finite(f.nativeSnapshot.receivedAt)?{captureTime:{earliest:new Date(capture.started+f.nativeSnapshot.requestedAt).toISOString(),latest:new Date(capture.started+f.nativeSnapshot.receivedAt).toISOString(),basis:'Preserved actual native screenshot request/response offsets'}}:{capturedAt:new Date(f.timestamp*1000).toISOString()}
  return {path:path.relative(provenanceDirectory,actual),kind:'native-screenshot',role,sha256:sha(actual),sourceFrame:file,sourceAt:f.at,...time}
}

/** Inspect only a file already obtained from the actual Download set UI.
 * No copying, fetching, clipboard conversion or capture annotation is done.
 */
export async function inspectNativeSetDownload({captureDirectory,artifactPath,downloadActionAt,menuFrameFile,exportedAt,downloadEventBridgeConfirmed=false,provenanceDirectory=path.join(captureDirectory,'native-export')}) {
  const directory=path.resolve(captureDirectory),capture=read(path.join(directory,'capture.json'))
  readerIdentity(capture)
  const action=capture.actions.find(a=>a.at===downloadActionAt)
  if(!action||action.nativeFrameHitTest?.frameProof?.name!=='Download set')throw Error('The actual recorded Download set action is required')
  const inputQualification=qualifyNativeAppLocatorAction({child:capture,action}),menu=capture.frames.find(f=>f.file===menuFrameFile)
  if(!menu||menu.at>action.at||action.at-menu.at>60000||!capture.recordingWindows.some(w=>w.start<=menu.at&&action.at<=(w.end??Infinity)))throw Error('Preserve a real recent menu frame and the actual in-window Download set input')
  const time=Date.parse(exportedAt)
  if(!Number.isFinite(time)||time<capture.started+action.nativeInputConfirmedAt||time>Date.now()+1000)throw Error('Use the actual observed download-completion time after its native input')
  const actual=fs.realpathSync(artifactPath)
  if(!fs.statSync(actual).isFile())throw Error('The actual native download file is missing')
  const {readExport}=await import(path.join(ROOT,'scripts/recordings/file-result-support.mjs'))
  const file=readExport(actual)
  const uiEvidence=[frameUiEvidence(capture,directory,menuFrameFile,'native-set-download-menu',provenanceDirectory),frameUiEvidence(capture,directory,action.nativeStateFrame,'native-set-download-post-input',provenanceDirectory)]
  return {method:'native-download',controlLabel:'Download set',sourceUrl:capture.conversationUrl,parentNotebookUrl:capture.evidence.parentNotebookUrl,exportedAt,artifactSha256:file.sha256,downloadEventBridgeConfirmed,nativeDownloadSucceeded:true,uiEvidence,nativeSetDownload:{schemaVersion:1,readerCaptureKey:capture.key,readerCaptureStartedAt:capture.startedAt,readerCapturePath:path.relative(ROOT,directory).split(path.sep).join('/'),...(capture.complete?{readerCaptureSha256:sha(path.join(directory,'capture.json'))}:{}),readerSourceFinalizationPending:!capture.complete,sourceBookSha256:BOOK,sourceUrl:capture.conversationUrl,parentNotebookUrl:capture.evidence.parentNotebookUrl,downloadAction:{at:action.at,label:action.label,inputMethod:action.nativeInputMethod,clickSource:action.clickSource,markerMeaning:inputQualification.markerMeaning,exactDeliveredPointerCoordinatesExposed:false},file:{actualPath:actual,originalFilename:path.basename(actual),sha256:file.sha256,bytes:file.bytes,mediaType:file.mediaType,readValidation:file},menuFrame:{file:menuFrameFile,at:menu.at,sha256:uiEvidence[0].sha256},postFrame:{file:action.nativeStateFrame,sha256:uiEvidence[1].sha256},inputQualification,recipientVerified:false,ownerIndependent:false,publicNotebookAccessClaimed:false,scope:'Exact native file from actual internal Apps Download set; guest/stateless access and content fidelity remain separate requirements.'}}
}
