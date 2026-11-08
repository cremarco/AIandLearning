/** Make an independent review copy; the completed recorder source is immutable. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const STAGING=path.join(ROOT,'output/review/video-refresh')
const inside=(f,b)=>path.resolve(f).startsWith(path.resolve(b)+path.sep)
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'))
export function stageNativeSourceReview(sourceDirectory,destinationDirectory) {
  const source=path.resolve(sourceDirectory),destination=path.resolve(destinationDirectory)
  if (!inside(source,STAGING)||path.dirname(destination)!==path.dirname(source)||source===destination||fs.existsSync(destination)) throw Error('Use a new sibling review directory inside staging')
  const file=path.join(source,'capture.json'),capture=read(file),digest=sha(file)
  if (!capture.complete || capture.truncated || capture.productionEligible===false) throw Error('Only a completed eligible native source can be reviewed')
  fs.cpSync(source,destination,{recursive:true,mode:fs.constants.COPYFILE_FICLONE,errorOnExist:true,force:false})
  if (sha(file)!==digest) throw Error('Original source changed during copy; do not use this review copy')
  capture.immutableRawSource={directory:path.relative(ROOT,source).split(path.sep).join('/'),captureSha256:digest,key:capture.key,sourceFrames:capture.frames.length,
    policy:'Independent review copy. Recorder JSON, original native PNGs and event timestamps remain unchanged; review metadata is written only to this copy.'}
  fs.writeFileSync(path.join(destination,'capture.json'),JSON.stringify(capture,null,2)+'\n')
  return {sourceUnchanged:sha(file)===digest,sourceCaptureSha256:digest,reviewDirectory:destination,frames:capture.frames.length}
}
export function validateNativeSourceReview(capture,sourceDirectory,run) {
  const origin=capture.immutableRawSource
  if (!origin)return
  const source=path.resolve(sourceDirectory),raw=path.resolve(ROOT,origin.directory),file=path.join(raw,'capture.json')
  if (!inside(raw,run)||raw===source||!fs.existsSync(file)||sha(file)!==origin.captureSha256)throw Error('Immutable original recorder source changed')
  const original=read(file)
  if (!original.complete||original.key!==capture.key||origin.key!==original.key||origin.sourceFrames!==original.frames.length)throw Error('Review origin identity mismatch')
  for (const f of original.frames) {
    const copy=capture.frames.find(x=>x.file===f.file&&x.at===f.at&&x.timestamp===f.timestamp)
    const a=path.resolve(raw,f.file),b=path.resolve(source,f.file)
    if(!copy||!inside(a,raw)||!inside(b,source)||!fs.existsSync(b)||sha(a)!==sha(b))throw Error('Original native pixels or timestamps changed in review copy')
  }
  if(capture.frames.length!==original.frames.length&&!capture.frames.filter(f=>!original.frames.some(o=>o.file===f.file&&o.at===f.at)).every(f=>f.nativeRetakeOrigin&&capture.nativeUsageRetakes?.some(r=>r.origin.captureSha256===f.nativeRetakeOrigin.captureSha256)))throw Error('Unproven extra native review frames')
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(stageNativeSourceReview(...process.argv.slice(2)),null,2))
