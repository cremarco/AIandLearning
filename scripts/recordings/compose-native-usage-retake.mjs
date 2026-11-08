#!/usr/bin/env node
/** Join later genuine native footage using its actual shared wall clock. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {validateNativeWorkFileRetake,validateNativeWorkDiagramRetake} from './native-work-file-retake.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const STAGING=path.join(ROOT,'output/review/video-refresh')
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const within=(file,base)=>path.resolve(file).startsWith(path.resolve(base)+path.sep)
const relative=file=>path.relative(ROOT,file).split(path.sep).join('/')
const timed=(value,delta,names)=>Object.fromEntries(Object.entries(value).map(([key,v])=>[key,names.includes(key)&&Number.isFinite(v)?v+delta:v]))
export const hasNativeResultReadEvidence=evidence=>evidence?.nativeResultRead===true ||
  ['exactObservedUiTextFile','firstPassageRead','comparativeSectionsRead','bibliographyRead'].every(key=>evidence?.[key]===true)

export function composeNativeUsageRetake({parentDirectory,retakeDirectory,replaceFrom,reviewedBy,reason,kind,resultDirectory,resultRecordName}) {
  const parent=path.resolve(parentDirectory),child=path.resolve(retakeDirectory)
  if (!within(parent,STAGING) || !within(child,STAGING) || path.dirname(parent)!==path.dirname(child)) throw Error('Both native captures must stay in the same staged captures directory')
  if (!reviewedBy || !reason || !Number.isFinite(replaceFrom)) throw Error('An explicit reviewed retake interval and reason are required')
  const parentFile=path.join(parent,'capture.json'),childFile=path.join(child,'capture.json')
  const main=read(parentFile),retake=read(childFile),originalSHA=sha(parentFile),originSHA=sha(childFile)
  if (!main.complete || !retake.complete || main.truncated || retake.truncated) throw Error('Finish complete, untruncated native sources before composing')
  const resultRead=kind==='exported-result-reader',workFileRead=kind==='native-work-file-preview-retake',workDiagramRead=kind==='native-work-diagram-preview-retake',owner=main.ownerConversationUrl || main.conversationUrl
  if (retake.evidence?.parentCaptureKey!==main.key) throw Error('Native continuation must identify its exact parent capture')
  if (!resultRead && (!retake.evidence?.nativeUsageRetake || retake.conversationUrl!==owner)) throw Error('Retake must show this exact parent notebook/conversation')
  if (resultRead && (!hasNativeResultReadEvidence(retake.evidence) || retake.evidence.parentNotebookUrl!==owner)) throw Error('An exported-result reader must identify the exact parent notebook and its genuine native read')
  if (main.nativeUsageRetakes?.some(r=>r.origin.captureSha256===originSHA)) throw Error('This native retake is already composed')
  const outputSHA=retake.evidence.resultSha256
  let mainResult=path.resolve(main.evidence?.resultExport?.file || '')
  const run=path.dirname(path.dirname(parent))
  let childResult=path.join(run,retake.key,'native-export/answer.txt'),readerResult=null,workResult=null,workDiagramResult=null
  if (workDiagramRead) {
    const item=read(path.join(run,'inventory.json')).items.find(i=>i.key==='skills-markdown-mermaid-writing')
    const verified=validateNativeWorkDiagramRetake({capture:main,child:retake,retake:{resultSha256:outputSHA},item,sourceDirectory:parent,retakeDirectory:child,run})
    mainResult=childResult=verified.artifact;workDiagramResult=verified.workDiagramResult
  }
  if (workFileRead) {
    const resultDir=path.resolve(resultDirectory||'')
    if (path.dirname(resultDir)!==run || !/^supplemental-[a-z0-9-]+\.json$/.test(resultRecordName||'')) throw Error('Use this approved staged Work result and a named supplementary record')
    const item=read(path.join(run,'inventory.json')).items.find(i=>i.key===path.basename(resultDir))
    workResult={recordPath:relative(path.join(resultDir,resultRecordName))}
    const verified=validateNativeWorkFileRetake({capture:main,child:retake,retake:{workResult,resultSha256:outputSHA},item,directory:resultDir,sourceDirectory:parent,run})
    mainResult=childResult=verified.artifact
    workResult={...workResult,artifactPath:relative(verified.artifact),sha256:outputSHA,
      ownerConversationUrl:owner,recordSha256AtComposition:verified.recordSha256,
      sourceWorkVisibleTextSha256:main.observedWorkUiIdentity.visibleTextSha256,
      suppliesOnlyNativeUseEvidence:true,requiredChatShareRetained:true}
  }
  if (resultRead) {
    const resultDir=path.resolve(resultDirectory || '')
    if (path.dirname(resultDir)!==run) throw Error('Use the approved staged result directory')
    const approved=read(path.join(run,'inventory.json')).items.find(i=>i.key===path.basename(resultDir))
    const recordFile=path.join(resultDir,'result.json'),record=read(recordFile)
    if (approved?.service!=='NotebookLM' || record.kind!=='file' || !record.recipientVerified || !record.ownerIndependent || record.sourceExport?.sourceUrl!==owner || retake.conversationUrl!==record.url || record.file?.sha256!==outputSHA) throw Error('Reader must display this NotebookLM result through its exact verified stateless file URL')
    childResult=path.resolve(resultDir,record.file.path)
    if (!within(childResult,resultDir)) throw Error('Registered result artifact escapes its approved directory')
    readerResult={recordPath:relative(recordFile),artifactPath:relative(childResult),url:record.url,sha256:outputSHA,
      sourceUrl:owner,recordSha256AtComposition:sha(recordFile)}
  }
  if (!outputSHA || !within(mainResult,run) || !fs.existsSync(mainResult) || sha(mainResult)!==outputSHA || !fs.existsSync(childResult) || sha(childResult)!==outputSHA) throw Error('Both actual native copied results must have the same verified SHA')
  const delta=retake.started-main.started
  if (!(delta>=main.durationMs) || replaceFrom<0 || replaceFrom>=main.durationMs) throw Error('Use later native footage and a valid earlier replacement boundary')
  const namespace='native-retake-'+retake.key+'-'+originSHA.slice(0,8)
  const frames=retake.frames.map(f=>{
    const source=path.resolve(child,f.file)
    if (!within(source,child)) throw Error('Native retake pixels escape their source')
    const bytes=fs.readFileSync(source)
    if (bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw Error('Expected the actual native PNG capture bytes')
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20)
    const viewport=f.viewport || retake.sourceViewport || {width:f.metadata.deviceWidth,height:f.metadata.deviceHeight,deviceScaleFactor:width/f.metadata.deviceWidth}
    if (!viewport.width || !viewport.height || Math.abs(width/viewport.width-height/viewport.height)>.01) throw Error('Native retake viewport requires an observed geometry review')
    if (Math.round(f.timestamp*1000-retake.started)!==f.at) throw Error('Original native timestamp and source offset do not agree')
    const file=namespace+'/'+f.file,destination=path.resolve(parent,file)
    if (!within(destination,parent)) throw Error('Retake destination escapes staging')
    fs.mkdirSync(path.dirname(destination),{recursive:true})
    if (fs.existsSync(destination)) {if (sha(destination)!==sha(source)) throw Error('Never overwrite different native pixels')}
    else fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL)
    return {...f,file,at:Math.round(f.timestamp*1000-main.started),viewport,cropPixels:[0,0,width,height],framingGroup:'native-usage-retake',
      nativeRetakeOrigin:{capturePath:relative(child),captureSha256:originSHA,file:f.file,sourceAt:f.at,timestamp:f.timestamp,sha256:sha(source)}}
  })
  if (!frames.length) throw Error('Native retake has no observed frames')
  const firstFrame=Math.min(...frames.map(f=>f.at))
  const nextWindowId=Math.max(0,...main.recordingWindows.map(w=>w.id))+1
  const windowIDs=new Map(retake.recordingWindows.map((w,i)=>[w.id,nextWindowId+i]))
  const windows=retake.recordingWindows.map(w=>{
    if (!Number.isFinite(w.end) || w.failure) throw Error('Retake windows must close successfully')
    return {...timed(w,delta,['start','end','requestedStartAt','confirmedRunningAt','stopRequestedAt','confirmedStoppedAt','outerMethodReturnedAfterSourceEndAt']),
      id:windowIDs.get(w.id),nativeRetakeOrigin:{capturePath:relative(child),captureSha256:originSHA,windowId:w.id}}
  })
  const timeFields=['at','end','actualActionEndAt','stepEndedAt','stepRequestedAt','nativeInputRequestedAt','nativeInputConfirmedAt','markerUntilSourceAt']
  const actions=retake.actions.map(a=>{
    const result={...timed(a,delta,timeFields),nativeRetakeOrigin:{capturePath:relative(child),captureSha256:originSHA,sourceAt:a.at,label:a.label}}
    if (a.click?.at!==undefined) result.click={...a.click,at:a.click.at+delta}
    if (a.nativeStateFrame) result.nativeStateFrame=namespace+'/'+a.nativeStateFrame
    if (!result.kind && /Scroll|Read the complete two-source answer/.test(a.label)) {
      result.kind='scroll';result.inputSource='native-cdp-mouse-wheel'
      result.kindAnnotation='The producer explicitly recorded real native wheel inputs; no point or mouse click is invented. Original child action is retained in its immutable capture.'
    }
    if (resultRead && !result.kind && /^(Read the next report section|Inspect the complete bibliography)$/.test(a.label)) {
      result.kind='scroll';result.inputSource='native-cdp-mouse-wheel'
      result.kindAnnotation='Root confirms actual documented mouseWheel atx800,y330 for these three section moves and final bibliography move. Raw child has no kind; original event/time/pixels stay unchanged and no missing delta or pointer ring is invented.'
    }
    return result
  })
  const mappedHolds=(retake.deliberateHolds || []).map(h=>({...timed(h,delta,['start','end']),recordingWindowId:windowIDs.get(h.recordingWindowId),nativeRetakeOrigin:{capturePath:relative(child),captureSha256:originSHA}}))
  const covered=(main.excludedRanges || []).filter(r=>r.start>=replaceFrom&&r.end<=firstFrame)
  const exclusions=(main.excludedRanges || []).filter(r=>!covered.includes(r))
  exclusions.push({start:replaceFrom,end:firstFrame,reason,reviewedBy})
  const end=delta+Math.max(...retake.recordingWindows.map(w=>w.end))
  fs.copyFileSync(parentFile,path.join(parent,'capture.before-native-retake-'+originalSHA.slice(0,12)+'.json'))
  main.frames.push(...frames);main.actions.push(...actions);main.recordingWindows.push(...windows)
  main.phases.push(...retake.phases.map(p=>({...p,name:'usage-retake-'+p.name,at:p.at+delta,category:'read'})))
  main.deliberateHolds=[...(main.deliberateHolds || []),...mappedHolds]
  main.durationMs=end;main.excludedRanges=exclusions
  main.nativeUsageRetakes ||= []
  main.nativeUsageRetakes.push({origin:{capturePath:relative(child),captureSha256:originSHA,key:retake.key,started:retake.started},
    ...(resultRead ? {kind:'exported-result-reader',readerResult,
      evidenceAdaptation:{rawChildUnchanged:true,nativeResultReadFlag:retake.evidence.nativeResultRead===true,
        explicitVerifiedFlags:['exactObservedUiTextFile','firstPassageRead','comparativeSectionsRead','bibliographyRead'].filter(key=>retake.evidence[key]===true)}} : {}),
    ...(workFileRead ? {kind:'native-work-file-preview-retake',workResult} : {}),
    ...(workDiagramRead ? {kind:'native-work-diagram-preview-retake',workDiagramResult} : {}),
    originalCaptureSha256:originalSHA,deltaMs:delta,replaceFrom,joinAt:firstFrame,retainedEndAt:end,
    resultSha256:outputSHA,childResult:{path:relative(childResult),sha256:sha(childResult)},reason,reviewedBy,
    composedAt:new Date().toISOString(),coveredPriorExclusions:covered,
    policy:'Exact native footage only. Original absolute frame timestamps/pixels are unchanged; offsets are recomputed solely against the shared parent start clock. All retained child recording windows and deliberate holds remain intact.'})
  if (resultRead) {
    main.evidence ||= {}
    main.evidence.supplementalResultReadRequired=false
    main.evidence.nativeResultRead={captureKey:retake.key,captureSha256:originSHA,resultSha256:outputSHA,url:retake.conversationUrl,
      policy:'Genuine browser read of the exact registered exported result; no reconstructed application UI or generated replacement content.'}
  }
  const temporary=path.join(parent,'.capture.native-retake.tmp')
  fs.writeFileSync(temporary,JSON.stringify(main,null,2)+'\n');fs.renameSync(temporary,parentFile)
  return {composed:true,parentKey:main.key,retakeKey:retake.key,captureSha256:sha(parentFile),framesAdded:frames.length,recordingWindowsAdded:windows.length,actualClockDeltaMs:delta,joinAt:firstFrame,retainedEndAt:end,sourcePixelsOrAbsoluteTimestampsAltered:false}
}

export function composeNativeResultRead(options) {
  return composeNativeUsageRetake({...options,kind:'exported-result-reader'})
}

export function composeNativeWorkFileRetake(options) {
  return composeNativeUsageRetake({...options,kind:'native-work-file-preview-retake'})
}

export function composeNativeWorkDiagramRetake(options) {
  return composeNativeUsageRetake({...options,kind:'native-work-diagram-preview-retake'})
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),resultRead=args[0]==='result-read'
  if (resultRead) args.shift()
  const parentDirectory=args.shift(),retakeDirectory=args.shift(),resultDirectory=resultRead?args.shift():undefined,boundary=args.shift(),reviewedBy=args.shift()
  console.log(JSON.stringify(composeNativeUsageRetake({parentDirectory,retakeDirectory,resultDirectory,kind:resultRead?'exported-result-reader':undefined,replaceFrom:Number(boundary),reviewedBy,reason:args.join(' ')}),null,2))
}
