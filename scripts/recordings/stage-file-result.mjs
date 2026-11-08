#!/usr/bin/env node
/** Stage actual native exports and verify stateless reading; never publish. */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {EXPORT_FORMATS,inside,safeExportPath,sha256,fileSha256,readExport,exportRoute,plannedExportPath,fetchStatelessExport,auditFileResult,observedTime,validateObservedUiTextExport} from './file-result-support.mjs'
import {WORK_UI_KEYS,workResultBinding} from './work-ui-identity.mjs'
import {validateObservedUiDerivedPdf,derivedPdfReferences} from './observed-ui-derived-pdf.mjs'
import {validateNativeSetDownloadBinding} from './native-app-evidence.mjs'
import {validateRefreshScope} from './refresh-scope.mjs'
import {validateObservedNativeMapScreenshot,nativeMapScreenshotReferences} from './observed-native-map-screenshot.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const STAGING=path.join(ROOT,'output/review/video-refresh')
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const args=process.argv.slice(2),command=args.shift() || 'help',options={}
while (args.length) {
  const flag=args.shift()
  if (!/^--[a-z-]+$/.test(flag)) throw Error('Expected a named option, received '+flag)
  options[flag.slice(2)]=['pending','replace','supplemental-work'].includes(flag.slice(2)) ? true : args.shift()
}
const writable=file=>{
  if (!inside(STAGING,file)) throw Error('Writes are restricted to video-refresh staging')
  let existing=path.dirname(file)
  while (!fs.existsSync(existing)) existing=path.dirname(existing)
  if (fs.realpathSync(existing)!==fs.realpathSync(STAGING) && !inside(fs.realpathSync(STAGING),fs.realpathSync(existing))) throw Error('A staging destination may not escape through a symlink')
}
const write=(file,value)=>{
  writable(file)
  fs.mkdirSync(path.dirname(file),{recursive:true})
  const temporary=file+'.file-result.tmp'
  fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n')
  fs.renameSync(temporary,file)
}
function context() {
  const run=path.resolve(STAGING,options.run || '2026-11-07')
  if (!inside(STAGING,run)) throw Error('Run must be inside video-refresh staging')
  const inventory=read(path.join(run,'inventory.json'))
  validateRefreshScope(run,inventory)
  const item=inventory.items.find(i=>i.key===options.key)
  const supplementalWork=options['supplemental-work']===true
  if (!item || (supplementalWork ? !WORK_UI_KEYS.has(item.key)||item.resultRequirements.interactiveRequired!==false : !item.resultRequirements.kinds.includes('file')||item.service==='ChatGPT')) throw Error('Choose an approved file result, or an explicit supplementary nonwidget Work export')
  const directory=path.join(run,item.directory)
  if (!inside(run,directory) || path.basename(directory)!==item.key) throw Error('Unsafe inventory directory')
  const renderFile=path.join(directory,'render.json')
  const renderedSource=fs.existsSync(renderFile) ? read(renderFile).capture?.path : null
  const sourceDirectory=options.capture ? path.resolve(ROOT,options.capture) : renderedSource ? path.resolve(ROOT,renderedSource) : path.join(run,'captures',item.key)
  if (!inside(run,sourceDirectory)) throw Error('The actual retake capture must stay inside this staging run')
  const sourceFile=path.join(sourceDirectory,'capture.json')
  if (!fs.existsSync(sourceFile) || !read(sourceFile).complete) throw Error('Finalize the actual source capture before binding its exported result')
  if (read(sourceFile).productionEligible===false) throw Error('An explicitly rejected/interrupted take cannot supply a production result')
  const capture=read(sourceFile),recordName=supplementalWork ? options['record-name']||'supplemental-file-result.json' : 'result.json'
  if (supplementalWork && !/^supplemental-[a-z0-9-]+\.json$/.test(recordName)) throw Error('Use a safe supplemental-*.json record; never replace the required ChatGPT share')
  if (supplementalWork)workResultBinding({capture,sourceDirectory,item})
  return {run,inventory,item,directory,sourceFile,capture,supplementalWork,resultPath:path.join(directory,recordName),recordName}
}
function referenceSupplement(ctx) {
  if (!ctx.supplementalWork)return
  const file=path.join(ctx.directory,'result.json'),main=read(file)
  if (main.kind!=='chatgpt-share' || main.sourceConversationUrl!==(ctx.capture.ownerConversationUrl||ctx.capture.conversationUrl)) throw Error('Preserve the real required Work chat-share record before registering its supplemental file')
  main.supplementalFileResults=[...new Set([...(main.supplementalFileResults||[]),ctx.recordName])]
  write(file,main)
}
function copyUnchanged(source,destination) {
  writable(destination)
  const actual=fs.realpathSync(source)
  if (!fs.statSync(actual).isFile()) throw Error('The actual exported artifact/evidence must be a file')
  fs.mkdirSync(path.dirname(destination),{recursive:true})
  if (fs.existsSync(destination)) {
    if (fileSha256(actual)!==fileSha256(destination)) throw Error('Refusing to overwrite different staged artifact/evidence bytes: '+destination)
  } else fs.copyFileSync(actual,destination,fs.constants.COPYFILE_EXCL)
  if (fileSha256(actual)!==fileSha256(destination)) throw Error('Copy integrity mismatch')
  return {sha256:fileSha256(destination),bytes:fs.statSync(destination).size}
}
function stage(ctx) {
  if (!options.artifact || !options.provenance) throw Error('--artifact and --provenance point to the actual UI export and its native provenance JSON')
  const metadata=read(options.provenance)
  if (!['native-download','user-performed-native-download','native-ui-copy','observed-ui-text-export','observed-ui-derived-pdf','observed-ui-native-screenshot'].includes(metadata.method) || !metadata.controlLabel || !Number.isFinite(Date.parse(metadata.exportedAt))) throw Error('Provenance needs method, actual control/container/projection label and exportedAt')
  const sourceUrl=ctx.capture.ownerConversationUrl || ctx.capture.conversationUrl
  const nativeSetDownload=metadata.nativeSetDownload ? validateNativeSetDownloadBinding({capture:ctx.capture,sourceDirectory:path.dirname(ctx.sourceFile),metadata,artifact:path.resolve(options.artifact),item:ctx.item,run:ctx.run,rootDirectory:ROOT}) : null
  if(metadata.method==='user-performed-native-download'&&!nativeSetDownload)throw Error('User native download requires the explicit validated Flashcards handoff contract')
  if (!/^https:\/\//.test(metadata.sourceUrl || '') || (metadata.sourceUrl!==sourceUrl && !nativeSetDownload)) throw Error('Provenance sourceUrl must exactly match this recorded notebook/editor or its validated actual Apps reader')
  if (!(Date.parse(metadata.exportedAt)>=Date.parse(ctx.capture.startedAt))) throw Error('The actual native export must be new enough for this source capture')
  if (!metadata.uiEvidence?.length || !metadata.uiEvidence.some(e=>e.kind==='native-screenshot')) throw Error('Provide the actual exported-result UI screenshot and optional native AX evidence')
  const originalFilename=path.basename(options.artifact)
  const name=options.name || originalFilename.replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^[^a-zA-Z0-9]+/,'')
  const filePath='exports/'+name
  if (!safeExportPath(filePath)) throw Error('Use a single safe filename with a supported native export extension')
  const inspected=readExport(path.resolve(options.artifact))
  if (metadata.method==='native-ui-copy') {
    if (!['.md','.txt','.csv','.mmd'].includes(inspected.extension)) throw Error('Native Copy text must be preserved as MD, TXT, CSV or Mermaid source bytes')
    if (metadata.clipboardSha256!==inspected.sha256 || !observedTime(metadata,'clipboardReadAt','clipboardReadTime')) throw Error('Native Copy provenance must bind the exact clipboard UTF-8 SHA and an actual read time or honest observed bracket')
    if (metadata.copySurface && !['tool-copy-control','browser-native-copy'].includes(metadata.copySurface)) throw Error('Copy surface must be the actual tool control or native browser Copy')
    if (metadata.copySurface==='browser-native-copy' && (!metadata.selectionDescription || !metadata.uiEvidence.some(e=>e.kind==='native-screenshot'&&e.role==='selected-result'))) throw Error('Browser Copy requires an actual selected-result screenshot and a description of that native selection')
  }
  if (metadata.artifactSha256 && metadata.artifactSha256!==inspected.sha256) throw Error('Native export artifactSha256 does not match the actual bytes')
  let uiTextObservation=null,derivedPdf=null,nativeScreenshot=null
  if (metadata.method==='observed-ui-text-export') {
    if (!metadata.uiTextObservation?.path || !/^[a-f0-9]{64}$/.test(metadata.uiTextObservation.sha256 || '')) throw Error('Provide actual UI observation JSON path and SHA')
    const observedFile=path.resolve(path.dirname(path.resolve(options.provenance)),metadata.uiTextObservation.path)
    if (fileSha256(observedFile)!==metadata.uiTextObservation.sha256) throw Error('Actual UI observation JSON hash mismatch')
    validateObservedUiTextExport({item:ctx.item,capture:ctx.capture,artifact:path.resolve(options.artifact),metadata,observation:read(observedFile)})
    const observedPath='export-evidence/observed-ui-text-'+fileSha256(observedFile)+'.json'
    uiTextObservation={path:observedPath,...copyUnchanged(observedFile,path.join(ctx.directory,observedPath))}
  }
  if (ctx.supplementalWork && metadata.method==='observed-ui-text-export')throw Error('Work supplements require the actual native Copy or Download; no Notebook text-export substitution')
  if (metadata.method==='observed-ui-derived-pdf') {
    if (ctx.supplementalWork || !metadata.derivationManifest?.path) throw Error('A derived PDF requires its explicit approved Notebook projection')
    const manifestFile=path.resolve(path.dirname(path.resolve(options.provenance)),metadata.derivationManifest.path)
    const validation=validateObservedUiDerivedPdf({item:ctx.item,capture:ctx.capture,captureSha256:fileSha256(ctx.sourceFile),artifact:path.resolve(options.artifact),metadata,manifestFile,allowedRoot:ctx.directory})
    const manifest=read(manifestFile),bundle='export-evidence/ui-derived-'+fileSha256(manifestFile)
    const copies=[manifestFile,...derivedPdfReferences(manifest).map(entry=>path.resolve(path.dirname(manifestFile),entry.path))].map(source=>{
      const relative=bundle+'/'+path.relative(ctx.directory,source)
      return {path:relative,...copyUnchanged(source,path.join(ctx.directory,relative))}
    })
    derivedPdf={derivationManifest:{path:copies[0].path,sha256:copies[0].sha256},derivationEvidenceRoot:bundle,derivationValidation:validation,
      qualityApprovalRequired:true,nativeDownloadClaimed:false,...(validation.kind==='native-quiz-ui-derived-pdf'?{nativeCopyClaimed:false,interactivePdfClaimed:false}:{}),disclosure:validation.kind==='native-quiz-ui-derived-pdf'?'Static PDF derived mechanically from the actual observed native Quiz questions, options, hints and explanations. No native Download/Copy or interactivity is claimed. Independent peer and root visual quality approval remain mandatory.':'Readable PDF projection derived mechanically from the actual observed Unimib NotebookLM report DOM. This is not a native Download/Copy export; original native exports are retained. Independent peer and root visual quality approval remain mandatory.',evidence:copies.map(copy=>copy.path)}
  }
  if(metadata.method==='observed-ui-native-screenshot') {
    if(ctx.supplementalWork||!metadata.nativeScreenshotManifest?.path)throw Error('Native screenshots require the explicit approved Map companion manifest')
    const manifestFile=path.resolve(path.dirname(path.resolve(options.provenance)),metadata.nativeScreenshotManifest.path),manifest=read(manifestFile)
    const validation=validateObservedNativeMapScreenshot({item:ctx.item,capture:ctx.capture,captureSha256:fileSha256(ctx.sourceFile),artifact:path.resolve(options.artifact),metadata,manifestFile,allowedRoot:ctx.directory}),bundle='export-evidence/native-ui-screenshot-'+fileSha256(manifestFile)
    const copies=[manifestFile,...nativeMapScreenshotReferences(manifest).map(e=>path.resolve(path.dirname(manifestFile),e.path))].map(source=>{const relative=bundle+'/'+path.relative(ctx.directory,source);return {path:relative,...copyUnchanged(source,path.join(ctx.directory,relative))}})
    nativeScreenshot={nativeScreenshotManifest:{path:copies[0].path,sha256:copies[0].sha256},nativeScreenshotEvidenceRoot:bundle,nativeScreenshotValidation:validation,qualityApprovalRequired:true,nativeDownloadClaimed:false,nativeCopyClaimed:false,interactiveImageClaimed:false,publicNativeArtifactAccessClaimed:false,disclosure:'Unchanged native screenshot of the original institutional NotebookLM mind map, provided as a static PNG companion. No native Download/Copy, interactivity or public native-App access is claimed. Complete visibility and readability require separate peer and root visual approval.',evidence:copies.map(c=>c.path)}
  }
  const resultPath=ctx.resultPath
  if (fs.existsSync(resultPath) && !options.replace) throw Error('A result already exists; use --replace to keep a SHA-named backup and record the actual replacement')
  if (fs.existsSync(resultPath)) copyUnchanged(resultPath,path.join(ctx.directory,'export-evidence','previous-result-'+fileSha256(resultPath)+'.json'))
  const provenanceName='export-evidence/native-export-'+fileSha256(options.provenance)+'.json'
  const provenance=copyUnchanged(options.provenance,path.join(ctx.directory,provenanceName))
  const evidence=metadata.uiEvidence.map((entry,index)=>{
    if (!entry.path || !observedTime(entry) || !['native-screenshot','native-ax'].includes(entry.kind)) throw Error('Each UI evidence item needs actual path, kind and an actual capture time or honest observed bracket')
    const source=path.resolve(path.dirname(path.resolve(options.provenance)),entry.path)
    const extension=path.extname(source).toLowerCase()
    if (!['.png','.jpg','.jpeg','.webp','.txt'].includes(extension)) throw Error('UI evidence must be a native screenshot or AX text file')
    const relative='export-evidence/ui-'+String(index+1).padStart(2,'0')+'-'+fileSha256(source)+extension
    const copied=copyUnchanged(source,path.join(ctx.directory,relative))
    return {path:relative,kind:entry.kind,...(entry.role ? {role:entry.role} : {}),...(entry.capturedAt ? {capturedAt:entry.capturedAt} : {captureTime:entry.captureTime}),...copied}
  })
  copyUnchanged(options.artifact,path.join(ctx.directory,filePath))
  const reviewPath=exportRoute(ctx.item.key,filePath)
  const origin=options['review-origin'] || 'http://127.0.0.1:8897'
  const result={schemaVersion:1,kind:'file',url:new URL(reviewPath,origin).href,
    ...(ctx.supplementalWork ? {...workResultBinding({capture:ctx.capture,sourceDirectory:path.dirname(ctx.sourceFile),item:ctx.item}),supplementalOnly:true,requiredChatShareRetained:true} : {}),
    recipientVerified:false,ownerIndependent:false,recipientContext:'stateless-http',
    file:{path:filePath,sha256:inspected.sha256,bytes:inspected.bytes,mediaType:EXPORT_FORMATS[inspected.extension],originalFilename,
      reviewPath,plannedPublicPath:plannedExportPath(ctx.run,ctx.item.key,filePath),readValidation:inspected},
    sourceExport:{method:metadata.method,sourceUrl:metadata.sourceUrl,controlLabel:metadata.controlLabel,exportedAt:metadata.exportedAt,
      captureSha256:fileSha256(ctx.sourceFile),captureStartedAt:ctx.capture.startedAt,provenance:{path:provenanceName,...provenance},uiEvidence:evidence,
      ...(nativeSetDownload ? {nativeSetDownload} : {}),
      ...(metadata.method==='user-performed-native-download' ? {performedBy:'user',actualUserClickTimeKnown:false,rootRecordedDownloadAttemptDeliveredFile:false,exportedAtMeaning:metadata.exportedAtMeaning} : {}),
      ...(uiTextObservation ? {uiTextObservation,uiTextSha256:metadata.uiTextSha256,exactObservedUiTextBytesPreserved:true,
        ...(metadata.originalNativeNotebookUrl ? {originalNativeNotebookUrl:metadata.originalNativeNotebookUrl} : {}),
        disclosure:'Read-only export of the actual rendered report text; no native Copy or Download operation is claimed.'} : {}),
      ...(derivedPdf ? Object.fromEntries(Object.entries(derivedPdf).filter(([key])=>key!=='evidence')) : {}),
      ...(nativeScreenshot ? Object.fromEntries(Object.entries(nativeScreenshot).filter(([key])=>key!=='evidence')) : {}),
      ...(metadata.method==='native-ui-copy' ? {clipboardSha256:metadata.clipboardSha256,...(metadata.copySurface ? {copySurface:metadata.copySurface} : {}),...(metadata.selectionDescription ? {selectionDescription:metadata.selectionDescription} : {}),...(metadata.clipboardReadAt ? {clipboardReadAt:metadata.clipboardReadAt} : {clipboardReadTime:metadata.clipboardReadTime}),exactClipboardBytesPreserved:true} : {})},
    evidence:[provenanceName,...evidence.map(e=>e.path),...(uiTextObservation ? [uiTextObservation.path] : []),...(derivedPdf?.evidence || []),...(nativeScreenshot?.evidence||[])],
    publication:'staged-only; plannedPublicPath is not published or copied into the live site'}
  write(resultPath,result)
  referenceSupplement(ctx)
  return result
}
async function verify(ctx) {
  const resultPath=ctx.resultPath,result=read(resultPath)
  if (result.kind!=='file' || !safeExportPath(result.file?.path)) throw Error('The staged result is not a supported file')
  const actual=readExport(path.join(ctx.directory,result.file.path))
  if (actual.sha256!==result.file.sha256 || actual.bytes!==result.file.bytes) throw Error('Artifact changed after native staging')
  const url=options['review-origin'] ? new URL(result.file.reviewPath,options['review-origin']).href : result.url
  const access=await fetchStatelessExport(url,result.file.reviewPath)
  if (access.sha256!==result.file.sha256 || access.bytes!==result.file.bytes) throw Error('Stateless HTTP response does not contain the exact actual exported artifact')
  access.readValidation=actual
  const accessName='export-evidence/stateless-access-'+sha256(Buffer.from(JSON.stringify(access)))+'.json'
  write(path.join(ctx.directory,accessName),access)
  Object.assign(result,{url,recipientVerified:true,ownerIndependent:true,recipientContext:'stateless-http',verifiedAt:access.verifiedAt,
    verificationMethod:access.method,accessVerification:{path:accessName,sha256:fileSha256(path.join(ctx.directory,accessName))}})
  result.evidence=[...new Set([...result.evidence,accessName])]
  const failures=auditFileResult({...ctx,result})
  if (failures.length) throw Error('File result verification failed: '+failures.join(', '))
  write(resultPath,result)
  return {key:ctx.item.key,verified:true,url:result.url,plannedPublicPath:result.file.plannedPublicPath,file:result.file.path,sha256:actual.sha256,bytes:actual.bytes,readValidation:actual.method,liveFilesChanged:false}
}

if (command==='help') console.log('record --run 2026-11-07 --key APPROVED_KEY --artifact ACTUAL_UI_EXPORT --provenance NATIVE_PROVENANCE_JSON [--name RESULT.ext] [--review-origin http://127.0.0.1:8897] [--pending] [--replace]\nverify --run 2026-11-07 --key APPROVED_KEY [--review-origin http://127.0.0.1:8897]\nrecord stages exact bytes, then verifies a stateless GET unless --pending. It never publishes or generates result contents.')
else {
  const ctx=context()
  if (command==='record') {
    const result=stage(ctx)
    if (options.pending) console.log(JSON.stringify({key:ctx.item.key,verified:false,url:result.url,file:result.file.path,publication:'staged-only'},null,2))
    else console.log(JSON.stringify(await verify(ctx),null,2))
  } else if (command==='verify') console.log(JSON.stringify(await verify(ctx),null,2))
  else throw Error('Unknown command: '+command)
}
