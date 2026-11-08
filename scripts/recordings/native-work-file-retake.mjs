/** Validate a genuine follow-up opening the already exported Work TXT file.
 * This supplies video-use evidence only. The required shared chat still needs
 * independent recipient review; no backend response ID is inferred.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {validateWorkSharedResult,validateWorkUiIdentity} from './work-ui-identity.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const within=(file,base)=>path.resolve(file).startsWith(path.resolve(base)+path.sep)

export function validateNativeWorkFileRetake({capture,child,retake,item,directory,sourceDirectory,run}) {
  // The completed native file-preview protocol currently exists for this tool.
  // HTML use and a modified Mermaid diagram must provide their own real proof.
  if (item?.key!=='skills-flashcard-generator' || item.service!=='ChatGPT'
      || item.resultRequirements?.interactiveRequired!==false) throw Error('Native Work TXT preview retake is limited to the approved flashcard skill')
  const owner=capture.ownerConversationUrl||capture.conversationUrl, proof=child.evidence
  if (!child.complete || child.ownerResponseId || child.responseId || !proof?.nativeUsageRetake
      || proof.parentCaptureKey!==capture.key || proof.parentConversationUrl!==owner || child.conversationUrl!==owner
      || proof.sourceBookSha256!==capture.book?.sha256 || proof.nativeClickPointsVerified!==true
      || JSON.stringify(proof.sourceWorkUiIdentity)!==JSON.stringify(capture.observedWorkUiIdentity)) throw Error('Native Work retake owner/book/UI identity mismatch')
  const recordPath=path.resolve(ROOT,retake.workResult?.recordPath||'')
  if (!within(recordPath,directory) || !/^supplemental-[a-z0-9-]+\.json$/.test(path.basename(recordPath))) throw Error('Use this approved supplementary Work result record')
  const primary=read(path.join(directory,'result.json')),record=read(recordPath)
  validateWorkSharedResult({capture,sourceDirectory,item,result:primary})
  validateWorkSharedResult({capture,sourceDirectory,item,result:record})
  if (primary.kind!=='chatgpt-share' || !primary.supplementalFileResults?.includes(path.basename(recordPath))
      || record.kind!=='file' || record.supplementalOnly!==true || record.requiredChatShareRetained!==true
      || !record.recipientVerified || !record.ownerIndependent || record.recipientContext!=='stateless-http'
      || record.file?.mediaType!=='text/plain; charset=utf-8') throw Error('Retake must retain the required chat and exact verified original TXT supplement')
  const artifact=path.resolve(directory,record.file.path||'')
  if (!within(artifact,path.join(directory,'exports')) || !within(fs.realpathSync(artifact),fs.realpathSync(directory))
      || sha(artifact)!==record.file.sha256 || fs.statSync(artifact).size!==record.file.bytes
      || proof.resultSha256!==record.file.sha256 || retake.resultSha256!==record.file.sha256) throw Error('Native Work retake original artifact mismatch')
  const saved=retake.workResult
  if ((saved.artifactPath && path.resolve(ROOT,saved.artifactPath)!==artifact)
      || (saved.ownerConversationUrl && saved.ownerConversationUrl!==owner)
      || (saved.sourceWorkVisibleTextSha256 && saved.sourceWorkVisibleTextSha256!==capture.observedWorkUiIdentity.visibleTextSha256)
      || (saved.sha256 && saved.sha256!==record.file.sha256)) throw Error('Saved native Work retake binding differs from the actual owner and registered file')
  const preview=child.nativePreviewVerified, frame=child.frames?.find(f=>f.file===preview?.frame&&f.at===preview.at)
  if (!preview || preview.allThreeCardsVisible!==true || preview.originalExportBytes!==record.file.bytes
      || preview.sha256!==record.file.sha256 || typeof preview.previewText!=='string'
      || hash(Buffer.from(preview.previewText,'utf8'))!==record.file.sha256 || !frame
      || !child.recordingWindows?.some(w=>w.start<=frame.at&&frame.at<=w.end)
      || !child.deliberateHolds?.some(h=>frame.at<=h.start&&h.start-frame.at<150&&h.end-h.start>=6000)) throw Error('Exact actual native preview and six-second three-card read are required')
  if (child.actions?.filter(a=>a.kind==='click'&&a.clickSource==='native-cdp-mouse-input'
      && a.nativeHitTestPassed===true&&Number.isFinite(a.click?.x)&&Number.isFinite(a.click?.y)).length<2) throw Error('Both genuine native open and enlarge controls need recorded hit-tested points')
  return {artifact,recordPath,recordSha256:sha(recordPath),sha256:record.file.sha256,ownerConversationUrl:owner}
}

/** Mermaid has its own native source/edit/preview protocol. It supplies only
 * use evidence; the mandatory shared conversation still needs recipient QA.
 */
export function validateNativeWorkDiagramRetake({capture,child,retake,item,sourceDirectory,retakeDirectory,run}) {
  if (item?.key!=='skills-markdown-mermaid-writing' || item.service!=='ChatGPT'
      || item.resultRequirements?.interactiveRequired!==false) throw Error('Native diagram retake is limited to the approved Mermaid skill')
  const identity=validateWorkUiIdentity({capture,sourceDirectory,item}),owner=identity.ownerConversationUrl,proof=child.evidence
  if (!child.complete || child.truncated || child.ownerResponseId || child.responseId || child.hostMode!=='Work-artifact-use'
      || !proof?.nativeUsageRetake || child.nativeUsageRetake!==true || proof.parentCaptureKey!==capture.key
      || child.parentCaptureKey!==capture.key || proof.parentConversationUrl!==owner || child.parentConversationUrl!==owner
      || child.conversationUrl!==owner || child.sourceBookSha256!==capture.book?.sha256
      || proof.nativeClickPointsVerified!==true || child.nativeClickPointsVerified!==true
      || JSON.stringify(proof.sourceWorkUiIdentity)!==JSON.stringify(capture.observedWorkUiIdentity)
      || JSON.stringify(child.sourceWorkUiIdentity)!==JSON.stringify(capture.observedWorkUiIdentity)) throw Error('Mermaid retake owner/book/UI identity mismatch')
  if (!capture.book?.path || sha(capture.book.path)!==capture.book.sha256
      || fs.statSync(capture.book.path).size!==capture.book.bytes) throw Error('Mermaid source book changed')
  const source=path.resolve(sourceDirectory),childSource=path.resolve(retakeDirectory||'')
  if (!within(source,run) || !within(childSource,run)) throw Error('Mermaid sources must remain staged')
  const nativeFrame=(cap,base,file,at)=>{
    const frame=cap.frames?.find(f=>f.file===file&&f.at===at),resolved=path.resolve(base,file||'')
    if (!frame || !within(resolved,base) || !within(fs.realpathSync(resolved),fs.realpathSync(base))
        || Math.round(frame.timestamp*1000-cap.started)!==at
        || !cap.recordingWindows?.some(w=>Number.isFinite(w.end)&&w.start<=at&&at<=w.end)
        || fs.readFileSync(resolved).subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw Error('Actual Mermaid native frame/time required')
    return {file,at,sha256:sha(resolved)}
  }
  const exports=capture.nativeDiagramExports,edit=capture.nativeMermaidEdit
  if (!exports || exports.sourceMethod!=='native-ui-copy' || exports.imageMethod!=='native-download'
      || exports.source!==capture.evidence?.editableSource || exports.image!==capture.evidence?.matchingImage) throw Error('Native Mermaid export metadata required')
  const origin=capture.immutableRawSource,raw=path.resolve(ROOT,origin?.directory||''),rawFile=path.join(raw,'capture.json')
  if (!origin || !within(raw,run) || raw===source || sha(rawFile)!==origin.captureSha256) throw Error('Immutable Mermaid parent source required')
  const original=read(rawFile)
  if (!original.complete || original.key!==capture.key || JSON.stringify(original.nativeDiagramExports)!==JSON.stringify(exports)
      || JSON.stringify(original.nativeMermaidEdit)!==JSON.stringify(edit)
      || JSON.stringify(original.observedWorkUiIdentity)!==JSON.stringify(capture.observedWorkUiIdentity)) throw Error('Mermaid reviewed metadata differs from the actual parent')
  const artifact=path.resolve(source,exports.source),image=path.resolve(source,exports.image)
  if (!within(artifact,path.join(source,'native-export')) || !within(image,path.join(source,'native-export'))
      || !within(fs.realpathSync(artifact),fs.realpathSync(source)) || !within(fs.realpathSync(image),fs.realpathSync(source))
      || path.extname(artifact)!=='.mmd' || path.extname(image)!=='.png'
      || sha(artifact)!==exports.sourceSha256 || sha(image)!==exports.imageSha256
      || sha(path.resolve(raw,exports.source))!==exports.sourceSha256 || sha(path.resolve(raw,exports.image))!==exports.imageSha256
      || proof.resultSha256!==exports.sourceSha256 || child.resultSha256!==exports.sourceSha256
      || retake.resultSha256!==exports.sourceSha256 || proof.matchingImageSha256!==exports.imageSha256
      || child.matchingImageSha256!==exports.imageSha256
      || fs.readFileSync(image).subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw Error('Actual matching Mermaid MMD and PNG required')
  const sourceProvenance=path.join(source,'native-export/source-provenance.json'),imageProvenance=path.join(source,'native-export/image-provenance.json')
  const exportFrame=nativeFrame(capture,source,exports.frame,exports.at)
  for (const [file,method,digest] of [[sourceProvenance,'native-ui-copy',exports.sourceSha256],[imageProvenance,'native-download',exports.imageSha256]]) {
    const p=read(file)
    if (p.sourceUrl!==owner || p.method!==method || p.artifactSha256!==digest
        || sha(file)!==sha(path.join(raw,'native-export',path.basename(file)))
        || !p.uiEvidence?.some(e=>e.kind==='native-screenshot' && path.resolve(e.path)===path.join(raw,exportFrame.file)
          && Math.abs(Date.parse(e.capturedAt)-(capture.started+exportFrame.at))<1)) throw Error('Native Mermaid export provenance mismatch')
    if (method==='native-ui-copy' && (p.clipboardSha256!==digest || p.copySurface!=='tool-copy-control')) throw Error('Actual Mermaid source Copy required')
  }
  const text=fs.readFileSync(artifact,'utf8'),normal=text=>text.replace(/\n(?:[ \t]*\n)+/g,'\n\n').trim(),verification=child.nativeCodeVerification
  if (!edit || edit.originalCode.replace('Ordinary inference (§§1.2, 1.7)','Inference uses fixed parameters (§§1.2, 1.7)')!==edit.editedCode
      || normal(text)!==normal(edit.editedCode) || !verification || verification.fileSha256!==exports.sourceSha256
      || typeof verification.text!=='string' || normal(verification.text)!==normal(text)) throw Error('Genuine single-node edit and exact native code verification required')
  nativeFrame(capture,source,edit.frame,edit.at)
  const codeFrame=nativeFrame(child,childSource,verification.frame,verification.at)
  const labels=['Expand the native Mermaid diagram','Open the editable Mermaid source','Return to the preview of the edited diagram']
  const actions=labels.map(label=>{
    const action=child.actions?.find(a=>a.label===label),point=action?.click,bounds=point?.bounds
    if (!action || action.kind!=='click' || action.clickSource!=='native-cdp-mouse-input' || action.nativeHitTestPassed!==true
        || !Number.isFinite(point?.x) || !Number.isFinite(point?.y) || !bounds
        || point.x<bounds.left || point.x>bounds.right || point.y<bounds.top || point.y>bounds.bottom
        || action.nativeInputRequestedAt!==action.at || !(action.nativeInputConfirmedAt>=action.at)) throw Error('All three genuine hit-tested native Mermaid controls required')
    const state=child.frames?.find(f=>f.file===action.nativeStateFrame)
    nativeFrame(child,childSource,state?.file,state?.at)
    if (state.at<action.nativeInputConfirmedAt) throw Error('Mermaid control state precedes actual input')
    return action
  })
  const [expand,code,preview]=actions
  if (!(expand.at<code.at && code.at<verification.at && verification.at<preview.at)
      || !child.deliberateHolds?.some(h=>verification.at<=h.start&&h.start-verification.at<150&&h.end<=preview.at&&h.end-h.start>=2800)
      || !child.deliberateHolds?.some(h=>preview.nativeInputConfirmedAt<h.start&&h.start-preview.nativeInputConfirmedAt<500&&h.end-h.start>=4500)) throw Error('Actual Mermaid code and diagram reading holds required')
  const binding={artifactPath:path.relative(ROOT,artifact).split(path.sep).join('/'),sha256:exports.sourceSha256,
    imagePath:path.relative(ROOT,image).split(path.sep).join('/'),imageSha256:exports.imageSha256,
    sourceProvenanceSha256:sha(sourceProvenance),imageProvenanceSha256:sha(imageProvenance),
    sourceBookSha256:capture.book.sha256,ownerConversationUrl:owner,sourceWorkVisibleTextSha256:identity.visibleTextSha256,
    nativeCodeFrame:codeFrame,suppliesOnlyNativeUseEvidence:true,requiredChatShareRetained:true,backendResponseIdClaimed:false}
  if (retake.workDiagramResult && JSON.stringify(retake.workDiagramResult)!==JSON.stringify(binding)) throw Error('Saved Mermaid binding differs from actual native evidence')
  return {artifact,sha256:exports.sourceSha256,workDiagramResult:binding}
}
