/** Read-only provenance for the four native Work skill demonstrations.
 * Native UI render/search keys are deliberately never treated as backend IDs.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const STAGING=path.join(ROOT,'output/review/video-refresh')
export const WORK_UI_KEYS=new Set(['skills-learn','skills-the-learning-skill','skills-markdown-mermaid-writing','skills-flashcard-generator'])
export const WORK_UI_METHOD='native-work-completed-assistant-ui'
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const inside=(file,base)=>path.resolve(file).startsWith(path.resolve(base)+path.sep)
const sameFrame=(a,b)=>a?.file===b?.file&&a?.at===b?.at&&a?.sha256===b?.sha256

export function validateWorkUiIdentity({capture,sourceDirectory,item}) {
  if (!WORK_UI_KEYS.has(item?.key) || item.service!=='ChatGPT' || item.resultRequirements?.interactiveRequired!==false) throw Error('Native Work text identity is limited to the four approved noninteractive skills')
  if (!capture?.complete || capture.hostMode!=='Work' || capture.ownerResponseId || capture.responseId) throw Error('Work must be complete and must not invent a canonical response ID')
  const identity=capture.observedWorkUiIdentity,owner=capture.ownerConversationUrl||capture.conversationUrl
  const url=new URL(owner)
  if (url.origin!=='https://chatgpt.com' || !/^\/(?:g\/[^/]+\/)?c\/[a-f0-9-]+\/?$/i.test(url.pathname) || identity?.ownerConversationUrl!==owner) throw Error('Work owner must be its actual persistent native conversation URL')
  if (identity.method!==WORK_UI_METHOD || identity.wrapperSelector!=='[data-local-conversation-final-assistant="true"]'
      || !Number.isInteger(identity.wrapperCount) || identity.wrapperCount<1 || identity.h4Role!=='assistant'
      || !/^ChatGPT said\s*:?$/i.test(String(identity.h4Text).trim()) || identity.completedTurnState!=='complete') throw Error('Native completed Work assistant role/state observation is incomplete')
  const last=capture.lastCompletedWorkAssistant,text=last?.actualNativeWrapperText
  if (typeof text!=='string' || !text.trim() || hash(Buffer.from(text,'utf8'))!==identity.visibleTextSha256
      || last.visibleTextSha256!==identity.visibleTextSha256 || Array.from(text).length!==identity.visibleTextCharacters
      || last.frame!==identity.nativeFrame?.file || last.at!==identity.nativeFrame?.at) throw Error('Exact rendered Work assistant text/hash does not agree with the recorded native identity')
  if (!capture.workResponseReads?.some(read=>read.method===identity.method && read.ownerConversationUrl===owner
      && read.actualNativeWrapperText===text && read.visibleTextSha256===identity.visibleTextSha256
      && sameFrame(read.nativeFrame,identity.nativeFrame))) throw Error('Work identity must correspond to an actual recorded response-reading view')
  const frame=capture.frames?.find(f=>f.file===identity.nativeFrame.file&&f.at===identity.nativeFrame.at)
  if (!frame || !Number.isFinite(frame.timestamp) || Math.round(frame.timestamp*1000-capture.started)!==frame.at
      || !capture.recordingWindows?.some(w=>Number.isFinite(w.end)&&w.start<=frame.at&&frame.at<=w.end)) throw Error('Work identity frame must have its actual native timestamp inside a closed recorder window')
  const source=path.resolve(sourceDirectory),file=path.resolve(source,frame.file)
  if (!inside(source,STAGING) || !inside(file,source) || !fs.existsSync(file)
      || !inside(fs.realpathSync(file),fs.realpathSync(source))) throw Error('Work native identity frame must stay inside its staged source')
  const bytes=fs.readFileSync(file)
  if (bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || hash(bytes)!==identity.nativeFrame.sha256) throw Error('Work native identity PNG hash mismatch')
  return {method:WORK_UI_METHOD,ownerConversationUrl:owner,visibleTextSha256:identity.visibleTextSha256,
    visibleTextCharacters:identity.visibleTextCharacters,h4Role:'assistant',completedTurnState:'complete',
    nativeFrame:{...identity.nativeFrame,timestamp:frame.timestamp},backendResponseIdClaimed:false}
}

export function workResultBinding(options) {
  const verified=validateWorkUiIdentity(options)
  return {sourceConversationUrl:verified.ownerConversationUrl,
    sourceWorkUiIdentity:{method:verified.method,ownerConversationUrl:verified.ownerConversationUrl,
      visibleTextSha256:verified.visibleTextSha256,nativeFrame:{file:verified.nativeFrame.file,at:verified.nativeFrame.at,sha256:verified.nativeFrame.sha256},backendResponseIdClaimed:false}}
}

export function validateWorkSharedResult({capture,sourceDirectory,item,result}) {
  const source=validateWorkUiIdentity({capture,sourceDirectory,item}),bound=result?.sourceWorkUiIdentity
  if (result?.sourceResponseId || result?.ownerResponseId || result?.sourceConversationUrl!==source.ownerConversationUrl
      || bound?.method!==source.method || bound.ownerConversationUrl!==source.ownerConversationUrl
      || bound.visibleTextSha256!==source.visibleTextSha256 || !sameFrame(bound.nativeFrame,source.nativeFrame)
      || bound.backendResponseIdClaimed!==false) throw Error('Shared Work result must bind its exact native owner/text/frame without a fabricated backend response ID')
  // This is only author-result provenance. Existing independent-recipient and
  // public-share checks remain mandatory and are never inferred here.
  return source
}
