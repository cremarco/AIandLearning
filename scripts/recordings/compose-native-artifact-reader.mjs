/** Append genuine NotebookLM report-artifact footage. Never exports or publishes. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const STAGING=path.join(ROOT,'output/review/video-refresh')
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'))
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const inside=(f,b)=>path.resolve(f).startsWith(path.resolve(b)+path.sep)
const relative=f=>path.relative(ROOT,f).split(path.sep).join('/')
const timeFields=new Set(['at','end','start','actualActionEndAt','stepEndedAt','stepRequestedAt','nativeInputRequestedAt','nativeInputConfirmedAt','markerUntilSourceAt','requestedStartAt','confirmedRunningAt','stopRequestedAt','confirmedStoppedAt','functionStartedAt','functionEndedAt'])
const shift=(r,d)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,timeFields.has(k)&&Number.isFinite(v)?v+d:v]))

export function validateNativeArtifactReader({capture,child,retake,item}) {
  if (item.service!=='NotebookLM' || item.key!=='notebook-reports') throw Error('Only the approved NotebookLM report scenario uses this reader adapter')
  const owner=capture.ownerConversationUrl||capture.conversationUrl,e=child.evidence||{}
  const original=new URL(owner),artifact=new URL(child.conversationUrl)
  const notebook=original.pathname.match(/^\/notebook\/([a-f0-9-]+)$/)?.[1]
  if (original.origin!=='https://notebook.google.com' || artifact.origin!==original.origin
      || !notebook || !new RegExp('^/notebook/'+notebook+'/artifact/[a-f0-9-]+$').test(artifact.pathname)
      || original.searchParams.get('authuser')!=='1' || artifact.searchParams.get('authuser')!=='1'
      || capture.evidence?.artifactUrl!==artifact.href || e.sourceUrl!==artifact.href
      || e.parentNotebookUrl!==owner || e.parentCaptureKey!==capture.key || e.nativeArtifactReader!==true
      || child.newNotebook===true) throw Error('Actual report artifact/parent identity mismatch')
  const book=capture.book?.sha256||capture.sourceBook?.sha256
  if (!book || child.book?.sha256!==book || e.sourceBookSha256!==book) throw Error('Artifact reader must retain the same actual authorized book')
  for (const c of [capture,child]) if (c.accountDomain!=='unimib.it' || c.uiLanguage!=='en') throw Error('Artifact reader requires Unimib English context')
  const accountLines=(child.actions||[]).flatMap(a=>(a.state||'').split('\n').filter(s=>s.includes('Google Account:')))
  const domains=accountLines.flatMap(s=>s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(s=>s.split('@').at(-1).toLowerCase())
  if (!domains.includes('unimib.it')) throw Error('Artifact reader lacks its own observed native Unimib account line')
  if (!e.conceptComparisonRead || !e.questionsReadBeforeAnswerKey || !e.answerKeyRead) throw Error('Native report-reading review is incomplete')
  if (retake && (retake.artifactUrl!==artifact.href || retake.doesNotSupplyResult!==true || retake.resultSha256 || retake.childResult || retake.resultProof)) throw Error('Visual artifact reader cannot claim a file export or independent result verification')
}

export function composeNativeArtifactReader({parentDirectory,readerDirectory,reviewedBy,reason}) {
  const parent=path.resolve(parentDirectory),childDir=path.resolve(readerDirectory),run=path.dirname(path.dirname(parent))
  if (!inside(run,STAGING) || path.basename(path.dirname(parent))!=='captures' || path.dirname(childDir)!==path.dirname(parent)
      || parent===childDir || !reviewedBy || !reason) throw Error('Use two distinct captures in one staging run and provide review/reason')
  const pf=path.join(parent,'capture.json'),cf=path.join(childDir,'capture.json'),main=read(pf),child=read(cf)
  const inventory=read(path.join(run,'inventory.json')),item=inventory.items.find(i=>i.key==='notebook-reports')
  validateNativeArtifactReader({capture:main,child,item})
  if (![main,child].every(c=>c.complete&&!c.truncated&&c.productionEligible!==false)) throw Error('Use complete eligible native captures')
  const parentSha=sha(pf),childSha=sha(cf),delta=child.started-main.started
  if (!(delta>=main.durationMs)) throw Error('The reader must be genuinely later than the completed parent capture')
  if (main.nativeUsageRetakes?.some(r=>r.origin.captureSha256===childSha)) throw Error('Reader already composed')
  const origin={capturePath:relative(childDir),captureSha256:childSha}
  const namespace='native-artifact-reader-'+child.key+'-'+childSha.slice(0,8)
  const frames=child.frames.map(f=>{
    const source=path.resolve(childDir,f.file),bytes=fs.readFileSync(source),viewport=f.viewport||child.sourceViewport
    if (!inside(source,childDir) || bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw Error('Only original native PNG files may be joined')
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20)
    if (!viewport?.width || !viewport?.height || Math.abs(width/viewport.width-height/viewport.height)>.01 || Math.round(f.timestamp*1000-child.started)!==f.at) throw Error('Native source geometry/absolute clock mismatch')
    const file=namespace+'/'+f.file,destination=path.resolve(parent,file)
    if (!inside(destination,parent)) throw Error('Unsafe native destination')
    fs.mkdirSync(path.dirname(destination),{recursive:true})
    if (fs.existsSync(destination)) {if(sha(destination)!==sha(source))throw Error('Different native pixels already exist')}
    else fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL)
    return {...f,file,at:Math.round(f.timestamp*1000-main.started),viewport,cropPixels:[0,0,width,height],framingGroup:'native-report-artifact-viewport',
      nativeRetakeOrigin:{...origin,file:f.file,sourceAt:f.at,timestamp:f.timestamp,sha256:sha(source)}}
  })
  if (!frames.length || child.recordingWindows.some(w=>!Number.isFinite(w.end)||w.failure)) throw Error('Reader needs actual native frames and successfully closed windows')
  const replaceFrom=Math.max(...main.recordingWindows.map(w=>w.end)),joinAt=Math.min(...frames.map(f=>f.at))
  if (!(joinAt>replaceFrom)) throw Error('Reader cannot overlap the earlier source story')
  const offset=Math.max(...main.recordingWindows.map(w=>w.id))+1,ids=new Map(child.recordingWindows.map((w,i)=>[w.id,offset+i]))
  const windows=child.recordingWindows.map(w=>({...shift(w,delta),id:ids.get(w.id),nativeRetakeOrigin:{...origin,windowId:w.id}}))
  const actionOffset=main.actions.length
  const actions=child.actions.map(a=>({...shift(a,delta),...(a.nativeStateFrame?{nativeStateFrame:namespace+'/'+a.nativeStateFrame}:{}),nativeRetakeOrigin:{...origin,sourceAt:a.at,label:a.label}}))
  const holds=(child.deliberateHolds||[]).map(h=>({...shift(h,delta),recordingWindowId:ids.get(h.recordingWindowId),nativeRetakeOrigin:origin}))
  const steps=(child.stepTimings||[]).map(s=>({...shift(s,delta),recordingWindowId:ids.get(s.recordingWindowId),...(Number.isInteger(s.actionIndex)?{actionIndex:s.actionIndex+actionOffset}:{}),nativeRetakeOrigin:origin}))
  const retainedEndAt=delta+Math.max(...child.recordingWindows.map(w=>w.end))
  const backup=path.join(parent,'capture.before-native-artifact-reader-'+parentSha.slice(0,12)+'.json')
  if (!fs.existsSync(backup))fs.copyFileSync(pf,backup,fs.constants.COPYFILE_EXCL)
  main.frames.push(...frames);main.actions.push(...actions);main.recordingWindows.push(...windows)
  main.phases.push(...child.phases.map(p=>({...p,at:p.at+delta,nativeRetakeOrigin:origin})))
  main.deliberateHolds.push(...holds);main.stepTimings.push(...steps);main.durationMs=retainedEndAt
  main.excludedRanges=[...(main.excludedRanges||[]),{start:replaceFrom,end:joinAt,reviewedBy,reason:'Observed recorder-off gap before the later original report artifact reader; no in-window read removed.'}]
  const retake={kind:'native-artifact-reader',origin:{...origin,key:child.key,started:child.started},originalCaptureSha256:parentSha,deltaMs:delta,replaceFrom,joinAt,retainedEndAt,
    artifactUrl:child.conversationUrl,doesNotSupplyResult:true,reviewedBy,reason,composedAt:new Date().toISOString(),policy:'Original report artifact UI appended chronologically with unchanged PNG bytes/absolute timestamps. This reading evidence supplies neither an export nor verified recipient access.'}
  validateNativeArtifactReader({capture:main,child,retake,item})
  main.nativeUsageRetakes=[...(main.nativeUsageRetakes||[]),retake]
  main.evidence.nativeArtifactReader={...origin,artifactUrl:child.conversationUrl,doesNotSupplyResult:true}
  const temporary=path.join(parent,'.capture.native-artifact-reader.tmp');fs.writeFileSync(temporary,JSON.stringify(main,null,2)+'\n');fs.renameSync(temporary,pf)
  return {composed:true,framesAdded:frames.length,holdsAdded:holds.length,windowsAdded:windows.length,joinAt,retainedEndAt,childCaptureUnchanged:sha(cf)===childSha,captureSha256:sha(pf),resultVerificationSupplied:false}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [parentDirectory,readerDirectory,reviewedBy,reason]=process.argv.slice(2)
  console.log(JSON.stringify(composeNativeArtifactReader({parentDirectory,readerDirectory,reviewedBy,reason}),null,2))
}
