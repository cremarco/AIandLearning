/** Read-only validation for genuine native exports. No service APIs or UI driver. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import http from 'node:http'
import {execFileSync} from 'node:child_process'
import {readNativeDocx} from './read-native-docx.mjs'
import {validateWorkSharedResult} from './work-ui-identity.mjs'
import {validateObservedUiDerivedPdf} from './observed-ui-derived-pdf.mjs'
import {validateNativeSetDownloadBinding} from './native-app-evidence.mjs'
import {validateObservedNativeMapScreenshot} from './observed-native-map-screenshot.mjs'
import {validateLearningOriginalExportInheritance} from './native-learning-preview-retake.mjs'

export const EXPORT_FORMATS={
  '.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.mmd':'text/plain; charset=utf-8',
  '.pdf':'application/pdf','.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4',
  '.drawio':'application/vnd.jgraph.mxfile','.excalidraw':'application/json',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.m4a':'audio/mp4',
  '.html':'text/html; charset=utf-8',
}
export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
export const fileSha256=file=>sha256(fs.readFileSync(file))
export const inside=(base,file)=>{
  const relative=path.relative(path.resolve(base),path.resolve(file))
  return relative!=='' && !relative.startsWith('..') && !path.isAbsolute(relative)
}
export const safeExportPath=value=>typeof value==='string' && /^exports\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value) && !!EXPORT_FORMATS[path.extname(value).toLowerCase()]
export const exportRoute=(key,file)=>'/exports/'+key+'/'+encodeURIComponent(path.basename(file))
export const plannedExportPath=(run,key,file)=>'/materials/video-refresh/'+path.basename(run)+'/'+key+'/exports/'+path.basename(file)

export function isStatelessExportURL(value,route) {
  try {
    const url=new URL(value)
    return url.protocol==='http:' && url.hostname==='127.0.0.1' && !url.username && !url.password && !url.search && !url.hash && url.pathname===route
  } catch { return false }
}

export function readExport(file) {
  const extension=path.extname(file).toLowerCase(),bytes=fs.readFileSync(file)
  if (!EXPORT_FORMATS[extension]) throw Error('Unsupported native export extension: '+extension)
  if (!bytes.length) throw Error('The native export is empty')
  const base={extension,bytes:bytes.length,sha256:sha256(bytes),mediaType:EXPORT_FORMATS[extension],usable:true}
  if (extension==='.docx') return {...base,...readNativeDocx(file)}
  if (['.md','.txt','.csv','.mmd','.html'].includes(extension)) {
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    if (!text.trim() || text.includes('\0')) throw Error('Export text is empty or contains binary NUL bytes')
    const details=extension==='.csv' ? JSON.parse(execFileSync('python3',['-c',
      'import csv,json,sys; f=open(sys.argv[1],encoding="utf-8-sig",newline=""); r=list(csv.reader(f,strict=True)); assert r; print(json.dumps({"rows":len(r),"columns":max(map(len,r))}))',file],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']})) : {}
    if(extension==='.html') {
      if(!/<html\b/i.test(text)||!/<title>[^<]+<\/title>/i.test(text))throw Error('Native HTML export needs an actual document/title')
      details.browserInteractionReviewed=false
    }
    return {...base,method:extension==='.csv' ? 'strict UTF-8 and CSV reader without rewriting the original bytes' : 'strict UTF-8 decode without rewriting the original bytes',characters:Array.from(text).length,lines:text.split(/\r\n|\r|\n/).length,...details}
  }
  if (extension==='.excalidraw') {
    const doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
    if (doc.type!=='excalidraw' || !Array.isArray(doc.elements)) throw Error('The native Excalidraw file is not an editable Excalidraw document')
    return {...base,method:'parse native Excalidraw document',elements:doc.elements.length}
  }
  if (extension==='.drawio') {
    const result=JSON.parse(execFileSync('python3',['-c',
      'import json,sys,xml.etree.ElementTree as E; r=E.parse(sys.argv[1]).getroot(); assert r.tag in ("mxfile","mxGraphModel"), "Not a native draw.io document"; print(json.dumps({"root":r.tag,"diagrams":len(r.findall("diagram"))}))',file],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}))
    return {...base,method:'parse native draw.io XML without external entities',...result}
  }
  if (extension==='.pdf') {
    if (bytes.subarray(0,5).toString()!=='%PDF-') throw Error('The native export is not a PDF')
    const info=execFileSync('pdfinfo',[file],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']})
    const pages=Number(info.match(/^Pages:\s+(\d+)/m)?.[1])
    if (!(pages>0)) throw Error('The exported PDF has no readable pages')
    return {...base,method:'pdfinfo opens the PDF without an author session',pages}
  }
  if (extension==='.png') {
    const result=JSON.parse(execFileSync('python3',['-c',
      'from PIL import Image; import json,sys; im=Image.open(sys.argv[1]); assert im.format=="PNG"; w,h=im.size; im.verify(); assert w>0 and h>0; print(json.dumps({"width":w,"height":h}))',file],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}))
    return {...base,method:'Pillow opens and verifies the exact native PNG bytes',...result}
  }
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}))
  const stream=probe.streams.find(s=>s.codec_type===(extension==='.mp4' ? 'video' : 'audio'))
  const durationSeconds=Number(probe.format?.duration || stream?.duration)
  if (!stream || !(durationSeconds>0)) throw Error('The native media export has no readable nonempty stream')
  return {...base,method:'ffprobe reads the actual exported media without an author session',durationSeconds,codec:stream.codec_name,
    ...(stream.codec_type==='video' ? {width:stream.width,height:stream.height} : {channels:stream.channels,sampleRate:Number(stream.sample_rate)})}
}

export function fetchStatelessExport(url,expectedRoute,timeoutMs=10000) {
  if (!isStatelessExportURL(url,expectedRoute)) throw Error('Only the exact stateless127.0.0.1 export route can be verified')
  const requestedAt=new Date().toISOString()
  return new Promise((resolve,reject)=>{
    const request=http.get(url,{agent:false,headers:{Accept:'*/*','Accept-Encoding':'identity','Cache-Control':'no-cache'}},response=>{
      // There is no cookie jar, Authorization header, credential or redirect.
      if (response.statusCode!==200) {response.resume();reject(Error('Export GET returned HTTP'+response.statusCode));return}
      if (response.headers['set-cookie']) {response.resume();reject(Error('Stateless export route must not set an author/session cookie'));return}
      const digest=crypto.createHash('sha256');let bytes=0
      response.on('data',chunk=>{bytes+=chunk.length;digest.update(chunk)})
      response.on('error',reject)
      response.on('end',()=>resolve({url,requestedAt,verifiedAt:new Date().toISOString(),requestMethod:'GET',cookieHeaderSent:false,authorizationHeaderSent:false,
        followedRedirects:false,status:response.statusCode,sha256:digest.digest('hex'),bytes,contentType:response.headers['content-type'] || '',
        method:'Fresh stateless Node HTTP request; no browser session, cookies, Authorization, proxy or redirects.'}))
    })
    request.setTimeout(timeoutMs,()=>request.destroy(Error('Stateless export GET timed out')))
    request.on('error',reject)
  })
}

const existing=(base,name)=>{
  if (typeof name!=='string' || !inside(base,path.resolve(base,name))) return null
  const file=path.resolve(base,name)
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !inside(fs.realpathSync(base),fs.realpathSync(file))) return null
  return file
}
const validDate=value=>typeof value==='string' && Number.isFinite(Date.parse(value))
export const observedTime=(entry,exact='capturedAt',bounded='captureTime')=>{
  if (validDate(entry?.[exact])) return {earliest:Date.parse(entry[exact]),latest:Date.parse(entry[exact])}
  const window=entry?.[bounded]
  if (validDate(window?.earliest) && validDate(window?.latest) && Date.parse(window.earliest)<=Date.parse(window.latest) && window.basis) return {earliest:Date.parse(window.earliest),latest:Date.parse(window.latest)}
  return null
}

/** Exact observed NotebookLM text, explicitly distinct from a native download. */
export function validateObservedUiTextExport({item,capture,artifact,metadata,observation}) {
  if (item.service!=='NotebookLM' || item.resultRequirements?.interactiveRequired || !item.resultRequirements?.kinds?.includes('file') || path.extname(artifact).toLowerCase()!=='.txt') throw Error('Observed UI text exports are limited to approved noninteractive NotebookLM TXT results')
  if (metadata.method!=='observed-ui-text-export' || metadata.clipboardSha256 || metadata.copySurface || metadata.clipboardReadAt || metadata.clipboardReadTime) throw Error('Observed UI text must not claim a native clipboard operation')
  if (observation?.method!=='cua-read-only-innerText' || typeof observation.text!=='string' || !observation.text.length) throw Error('Provide the actual read-only CUA container innerText observation')
  const exact=Buffer.from(observation.text,'utf8'),bytes=fs.readFileSync(artifact),actual=sha256(bytes)
  if (!bytes.equals(exact) || metadata.uiTextSha256!==actual || observation.textSha256!==actual) throw Error('Observed UI text bytes were changed or do not match their native observation')
  if (observation.sourceUrl!==metadata.sourceUrl || observation.sourceUrl!==(capture.ownerConversationUrl || capture.conversationUrl) || observation.captureKey!==capture.key || observation.captureStartedAt!==capture.startedAt) throw Error('Observed UI text belongs to another source capture/notebook')
  if (capture.accountDomain!=='unimib.it' || capture.uiLanguage!=='en' || observation.accountDomain!=='unimib.it' || observation.uiLanguage!=='en') throw Error('Observed NotebookLM text requires the actual Unimib English context')
  const time=observedTime(observation,'observedAt','observationTime')
  if (!time || time.earliest<Date.parse(capture.startedAt) || time.latest>Date.parse(metadata.exportedAt)) throw Error('Observed UI text read must retain its actual request/response time bracket before export')
  const container=observation.container
  if (!container?.description || !container.title || container.visible!==true || !observation.text.trimStart().startsWith(container.title) || metadata.controlLabel!==container.title) throw Error('Identify the actual visible report container/title, not page chrome or a fabricated Copy control')
  if (observation.completeReportReviewed!==true || observation.bibliographyReviewed!==true || observation.appChromeExcluded!==true) throw Error('Review the complete observed report, bibliography and exclusion of application chrome')
  if (!['report-first-passage','report-last-passage'].every(role=>metadata.uiEvidence?.some(e=>e.kind==='native-screenshot'&&e.role===role))) throw Error('Actual native first/last report-passage screenshots are required')
  if (metadata.originalNativeNotebookUrl) {
    const url=new URL(metadata.originalNativeNotebookUrl),source=new URL(metadata.sourceUrl)
    if (url.origin!=='https://notebook.google.com' || url.pathname!==source.pathname) throw Error('Additional original Notebook link must refer to the same notebook')
  }
  return {uiTextSha256:actual,bytes:bytes.length,characters:Array.from(observation.text).length,
    method:'Exact UTF-8 serialization of the actual read-only CUA report-container innerText; no editing, generated replacement, native Copy or Download claim.',
    observationTime:{earliest:new Date(time.earliest).toISOString(),latest:new Date(time.latest).toISOString()}}
}

/** Bind saved stateless access evidence and re-open the actual artifact locally. */
export function auditFileResult({run,item,directory,result,sourceFile,supplementalWork=false}) {
  const failures=[],file=result.file,source=result.sourceExport
  let originalProvenance=null,nativeSetDownloadValidated=false
  if (supplementalWork) {
    try {
      if (result.supplementalOnly!==true || result.requiredChatShareRetained!==true || !['native-download','native-ui-copy'].includes(source?.method)) throw Error('Not a native Work supplement')
      validateWorkSharedResult({capture:JSON.parse(fs.readFileSync(sourceFile,'utf8')),sourceDirectory:path.dirname(sourceFile),item,result})
    } catch {failures.push('invalid-native-work-file-supplement')}
  } else if (item.service==='ChatGPT' || !item.resultRequirements.kinds.includes('file')) failures.push('file-result-not-allowed-for-this-clip')
  if (!safeExportPath(file?.path)) return ['unsafe-or-unsupported-exported-result-path',...failures]
  const artifact=existing(directory,file.path)
  if (!artifact) return ['missing-exported-result-file',...failures]
  if (fileSha256(artifact)!==file.sha256 || fs.statSync(artifact).size!==file.bytes) failures.push('exported-result-hash-or-size-mismatch')
  if (file.reviewPath!==exportRoute(item.key,file.path) || file.plannedPublicPath!==plannedExportPath(run,item.key,file.path) || !isStatelessExportURL(result.url,file.reviewPath)) failures.push('exported-result-route-mismatch')
  if (file.mediaType!==EXPORT_FORMATS[path.extname(file.path).toLowerCase()]) failures.push('exported-result-media-type-mismatch')
  try {
    const readable=readExport(artifact)
    if (!file.readValidation?.usable || file.readValidation.sha256!==readable.sha256 || file.readValidation.bytes!==readable.bytes) failures.push('exported-result-read-validation-mismatch')
  } catch {failures.push('exported-result-unreadable')}
  if (!source || !['native-download','user-performed-native-download','native-ui-copy','observed-ui-text-export','observed-ui-derived-pdf','observed-ui-native-screenshot'].includes(source.method) || !/^https:\/\//.test(source.sourceUrl || '') || !source.controlLabel || !validDate(source.exportedAt)) failures.push('missing-native-export-provenance')
  if(source?.method==='user-performed-native-download'&&!source.nativeSetDownload)failures.push('missing-explicit-user-native-download-handoff')
  const provenance=existing(directory,source?.provenance?.path)
  if (!provenance || fileSha256(provenance)!==source.provenance.sha256) failures.push('native-export-provenance-hash-mismatch')
  else {
    const original=JSON.parse(fs.readFileSync(provenance,'utf8'))
    originalProvenance=original
    if(source.method==='user-performed-native-download'&&['performedBy','actualUserClickTimeKnown','rootRecordedDownloadAttemptDeliveredFile','exportedAtMeaning'].some(k=>original[k]!==source[k]))failures.push('user-native-download-provenance-content-mismatch')
    if (['method','sourceUrl','controlLabel','exportedAt'].some(k=>original[k]!==source[k]) || (source.method==='native-ui-copy' && (original.clipboardSha256!==file.sha256 || original.clipboardReadAt!==source.clipboardReadAt || original.copySurface!==source.copySurface || original.selectionDescription!==source.selectionDescription || JSON.stringify(original.clipboardReadTime)!==JSON.stringify(source.clipboardReadTime)))) failures.push('native-export-provenance-content-mismatch')
    if (source.method==='observed-ui-text-export' && (original.uiTextSha256!==source.uiTextSha256 || original.uiTextObservation?.sha256!==source.uiTextObservation?.sha256 || original.originalNativeNotebookUrl!==source.originalNativeNotebookUrl)) failures.push('observed-ui-text-provenance-content-mismatch')
    if (source.method==='observed-ui-derived-pdf' && (original.derivationManifest?.sha256!==source.derivationManifest?.sha256 || original.nativeDownloadClaimed!==false || source.nativeDownloadClaimed!==false || original.qualityApprovalRequired!==true || source.qualityApprovalRequired!==true)) failures.push('observed-ui-derived-pdf-provenance-content-mismatch')
    if (source.method==='observed-ui-derived-pdf' && item.key==='notebook-quiz' && (original.nativeCopyClaimed!==false || source.nativeCopyClaimed!==false || original.interactivePdfClaimed!==false || source.interactivePdfClaimed!==false)) failures.push('observed-quiz-derived-pdf-disclosure-mismatch')
    if(source.method==='observed-ui-native-screenshot'&&(original.nativeScreenshotManifest?.sha256!==source.nativeScreenshotManifest?.sha256||['nativeDownloadClaimed','nativeCopyClaimed','interactiveImageClaimed','publicNativeArtifactAccessClaimed'].some(k=>original[k]!==false||source[k]!==false)||original.qualityApprovalRequired!==true||source.qualityApprovalRequired!==true))failures.push('native-map-screenshot-provenance-content-mismatch')
  }
  if (!source?.uiEvidence?.length || !source.uiEvidence.some(e=>e.kind==='native-screenshot') || !source.uiEvidence.every(e=>{
    const evidence=existing(directory,e.path)
    return evidence && observedTime(e) && fileSha256(evidence)===e.sha256
  })) failures.push('missing-native-export-ui-evidence')
  if (source?.method==='native-ui-copy' && source.clipboardSha256!==file.sha256) failures.push('native-copy-text-was-changed')
  if (source?.method==='native-ui-copy' && !observedTime(source,'clipboardReadAt','clipboardReadTime')) failures.push('native-copy-read-time-unobserved')
  if (source?.copySurface && !['tool-copy-control','browser-native-copy'].includes(source.copySurface)) failures.push('unknown-native-copy-surface')
  if (source?.copySurface==='browser-native-copy' && (!source.selectionDescription || !source.uiEvidence?.some(e=>e.kind==='native-screenshot'&&e.role==='selected-result'))) failures.push('missing-native-browser-selection-evidence')
  if (!sourceFile || !fs.existsSync(sourceFile)) failures.push('missing-native-export-source-capture')
  else {
    const capture=JSON.parse(fs.readFileSync(sourceFile,'utf8'))
    if (source?.nativeSetDownload) {
      try {
        const binding=validateNativeSetDownloadBinding({capture,sourceDirectory:path.dirname(sourceFile),metadata:originalProvenance,artifact,item,run})
        if(JSON.stringify(binding)!==JSON.stringify(source.nativeSetDownload))throw Error('Saved native set binding changed')
        nativeSetDownloadValidated=true
      } catch {failures.push('native-notebook-app-set-download-binding-mismatch')}
    }
    let originalLearningExport=null
    if(supplementalWork&&item.key==='skills-the-learning-skill'&&source?.captureSha256!==fileSha256(sourceFile)&&capture.nativeUsageRetakes?.some(r=>r.kind==='native-work-learning-original-preview-retake')) {
      try {originalLearningExport=validateLearningOriginalExportInheritance({capture,sourceDirectory:path.dirname(sourceFile),item,artifact,sourceExport:source,originalProvenance,run})}
      catch {failures.push('original-native-learning-export-inheritance-mismatch')}
    }
    if (!capture.complete || source?.captureSha256!==(originalLearningExport?.rawParentSha256||fileSha256(sourceFile)) || (source.sourceUrl!==(capture.ownerConversationUrl || capture.conversationUrl) && !nativeSetDownloadValidated) || source.captureStartedAt!==capture.startedAt || !(Date.parse(source.exportedAt)>=Date.parse(capture.startedAt)) || !source.uiEvidence.every(e=>observedTime(e)?.earliest>=Date.parse(capture.startedAt))) failures.push('native-export-does-not-match-source-capture')
    if (source?.method==='observed-ui-text-export') {
      try {
        const observed=existing(directory,source.uiTextObservation?.path)
        if (!observed || fileSha256(observed)!==source.uiTextObservation.sha256 || source.exactObservedUiTextBytesPreserved!==true) throw Error('Observed UI text evidence changed')
        validateObservedUiTextExport({item,capture,artifact,metadata:source,observation:JSON.parse(fs.readFileSync(observed,'utf8'))})
      } catch {failures.push('observed-ui-text-export-proof-mismatch')}
    }
    if (source?.method==='observed-ui-derived-pdf') {
      try {
        const manifest=existing(directory,source.derivationManifest?.path),root=path.resolve(directory,source.derivationEvidenceRoot || '')
        if (!manifest || !inside(directory,root)) throw Error('Missing contained derivation bundle')
        const validation=validateObservedUiDerivedPdf({item,capture,captureSha256:fileSha256(sourceFile),artifact,metadata:source,manifestFile:manifest,allowedRoot:root})
        if (JSON.stringify(validation)!==JSON.stringify(source.derivationValidation)) throw Error('Derivation validation changed')
      } catch {failures.push('observed-ui-derived-pdf-proof-mismatch')}
    }
    if(source?.method==='observed-ui-native-screenshot') {
      try {
        const manifest=existing(directory,source.nativeScreenshotManifest?.path),root=path.resolve(directory,source.nativeScreenshotEvidenceRoot||'')
        if(!manifest||!inside(directory,root))throw Error('Missing contained native screenshot bundle')
        const validation=validateObservedNativeMapScreenshot({item,capture,captureSha256:fileSha256(sourceFile),artifact,metadata:source,manifestFile:manifest,allowedRoot:root})
        if(JSON.stringify(validation)!==JSON.stringify(source.nativeScreenshotValidation))throw Error('Native screenshot validation changed')
      }catch{failures.push('native-map-screenshot-proof-mismatch')}
    }
  }
  const proof=existing(directory,result.accessVerification?.path)
  if (!proof || fileSha256(proof)!==result.accessVerification.sha256) failures.push('missing-stateless-export-access-proof')
  else {
    const access=JSON.parse(fs.readFileSync(proof,'utf8'))
    if (!isStatelessExportURL(access.url,file.reviewPath) || access.url!==result.url || access.status!==200 || access.cookieHeaderSent!==false || access.authorizationHeaderSent!==false || access.followedRedirects!==false || access.sha256!==file.sha256 || access.bytes!==file.bytes || !validDate(access.verifiedAt) || access.verifiedAt!==result.verifiedAt || !(Date.parse(access.verifiedAt)>=Date.parse(source?.exportedAt)) || !access.readValidation?.usable || access.readValidation.sha256!==file.sha256) failures.push('invalid-stateless-export-access-proof')
  }
  return failures
}
