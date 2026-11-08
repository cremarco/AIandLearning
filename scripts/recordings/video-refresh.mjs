#!/usr/bin/env node
/** Staged QA and an explicitly authorized accepted-subset publisher. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { auditFileResult } from './file-result-support.mjs'
import { auditDerivedPdfQuality } from './observed-ui-derived-pdf.mjs'
import { hasNativeResultReadEvidence } from './compose-native-usage-retake.mjs'
import { validateNativeArtifactReader } from './compose-native-artifact-reader.mjs'
import { validateNativeNotebookAppReader } from './compose-native-notebook-app-reader.mjs'
import { WORK_UI_KEYS, validateWorkUiIdentity, validateWorkSharedResult } from './work-ui-identity.mjs'
import { validateNativeSourceReview } from './stage-native-source-review.mjs'
import {qualifyRootWidgetRenderActions,validateInlineWidgetReader} from './native-root-widget-evidence.mjs'
import {auditNativeMapScreenshotQuality} from './observed-native-map-screenshot.mjs'
import {validateNativeLearningPreviewRetake} from './native-learning-preview-retake.mjs'
import {qualifyLearningRecordedOperations} from './native-learning-recorded-operations.mjs'
import { validateNativeWorkFileRetake,validateNativeWorkDiagramRetake } from './native-work-file-retake.mjs'
import { validateRefreshScope } from './refresh-scope.mjs'
import {prepareAcceptedRelease,applyAcceptedRelease,verifyAcceptedRelease} from './publish-accepted-videos.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const STAGING = path.join(ROOT, 'output/review/video-refresh')
const BOOK = 'public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf'
const NEW_WIDGETS = ['/conceptmap', '/lessonplan', '/differentiate']
const TEACHER_SLIDES = new Set(['S83', 'S85', 'S86'])
// Removed from the refresh scope at the user's request on 2026-11-08.
const EXCLUDED_REFRESH_KEYS = new Set([
  'study-tools-drawio', 'study-tools-excalidraw',
  'goblin-compiler', 'goblin-magic-todo', 'goblin-estimator',
  'goblin-taskmaster', 'goblin-professor', 'goblin-formalizer',
])
const APPROVED_VIDEO_COUNT = 49 - EXCLUDED_REFRESH_KEYS.size
export const NOTEBOOK_PRODUCTION_REQUIREMENTS = Object.freeze({
  version: 'unimib-english-2026-11-08', accountDomain: 'unimib.it', uiLanguage: 'en',
  accountEvidenceMethod: 'native-account-selector', interfaceEvidenceMethod: 'native-ui-labels',
})
const SOURCES = [
  'data/content/workshop-slides.json', 'data/content/media.json',
  'data/content/speaker-notes.json', 'data/generated/slides.json',
  'data/generated/flows.json', 'data/demos/chatgpt-videos.json', 'slides.md',
  'public/materials/chatgpt-formal/provenance.json',
  ...['skills', 'goblin', 'notebook', 'study-tools', 'teacher-tools'].map(f => `public/materials/${f}/provenance.json`),
]
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const relative = file => path.relative(ROOT, file).split(path.sep).join('/')
const write = (file, value) => {
  const resolved = path.resolve(file)
  if (!resolved.startsWith(STAGING + path.sep)) throw new Error('Writes are permitted only inside video-refresh staging')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}
const slug = text => text.replace(/^\//, '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
// Both formats were observed and exercised anonymously in the two native pilots.
export const isPublicChatResultUrl = url => /^https:\/\/chatgpt\.com\/(?:share\/[a-zA-Z0-9-]+|s\/w_[a-zA-Z0-9-]+)(?:[?#].*)?$/.test(url || '') || /^https:\/\/chatgpt\.com\/s\/t_[a-f0-9]{32}$/.test(url || '')
const normalizedResult = value => value && ({ ...value,
  kind: value.kind === 'chat' ? 'chatgpt-share' : value.kind,
  interactiveVerified: value.interactiveVerified ?? value.interactive,
  interaction: value.interaction && { ...value.interaction, observedChange: value.interaction.observedChange ?? value.interaction.observed },
  evidence: Array.isArray(value.evidence) ? value.evidence : value.evidence ? [value.evidence] : [],
})
const manifests = {
  'chatgpt-widgets': 'data/demos/chatgpt-videos.json',
  'chatgpt-formal': 'public/materials/chatgpt-formal/provenance.json',
  skills: 'public/materials/skills/provenance.json', goblin: 'public/materials/goblin/provenance.json',
  notebook: 'public/materials/notebook/provenance.json', 'study-tools': 'public/materials/study-tools/provenance.json',
  'teacher-tools': 'public/materials/teacher-tools/provenance.json',
}

export function collectInventory() {
  const slides = read(path.join(ROOT, 'data/generated/slides.json'))
  const widgets = read(path.join(ROOT, manifests['chatgpt-widgets'])).clips
  // Stable registry identities survive versioned public asset directories.
  const pointerFile = path.join(ROOT, 'data/demos/video-release.json')
  let releasedClips = []
  if (fs.existsSync(pointerFile)) {
    const pointer = read(pointerFile)
    const manifestFile = path.resolve(ROOT, 'public', pointer.manifest || '')
    if (!manifestFile.startsWith(path.join(ROOT, 'public') + path.sep)) throw new Error('Release manifest must stay inside public assets')
    releasedClips = read(manifestFile).clips || []
  }
  const items = [], active = [], concurrentAdditions = []
  const add = (slide, media, command, nested = false) => {
    const released = releasedClips.find(clip => clip.media.src === media.src)
    command ||= released?.command
    let family = released?.family || media.src.split('/')[1]
    if (family === 'chatgpt-widgets') family = 'chatgpt-widgets'
    const widget = family === 'chatgpt-widgets'
    const chatgpt = widget || family === 'chatgpt-formal' || family === 'skills'
    const key = released?.key || (widget ? `widget-${slug(command || slide.title)}` : `${family}-${path.basename(media.src, '.mp4')}`)
    const item = {
      key, slideId: slide.id, title: slide.title, family,
      service: chatgpt ? 'ChatGPT' : ({ notebook: 'NotebookLM', goblin: 'Goblin.tools', 'study-tools': slide.tool === 'drawio' ? 'draw.io' : 'Excalidraw', 'teacher-tools': slide.tool === 'formative' ? 'Formative' : 'MagicSchool' }[family] || slide.tool),
      command: widget ? command || slide.title : undefined,
      originalPrompt: media.prompt || slide.prompt || (widget ? widgets.find(c => c.command === (command || slide.title))?.prompt : undefined),
      source: { src: media.src, poster: media.poster, captions: media.captions,
        metadata: manifests[family], authoredSlide: 'data/content/workshop-slides.json',
        ...(nested ? { pointer: { slideId: slide.id, command, field: 'commands[].result.media' } }
          : widget ? { pointer: { catalogue: manifests[family], command: command || slide.title } }
            : { pointer: { media: 'data/content/media.json', slideId: slide.id } }) },
      resultRequirements: { kinds: chatgpt ? ['chatgpt-share'] : ['native', 'file'], recipientVerificationRequired: true,
        interactiveRequired: widget, publicOwnerIndependent: true },
      ...(family === 'notebook' ? {productionContextRequirements: NOTEBOOK_PRODUCTION_REQUIREMENTS} : {}),
      status: 'pending', newVideo: false, directory: key,
    }
    active.push(item)
    if (EXCLUDED_REFRESH_KEYS.has(key)) return
    if (family === 'teacher-tools' && !TEACHER_SLIDES.has(slide.id)) concurrentAdditions.push(item)
    else items.push(item)
  }
  for (const slide of slides) {
    if (slide.media?.type === 'video') add(slide, slide.media, slide.kind === 'shortcut-detail' ? slide.title : undefined)
    for (const command of slide.commands || []) {
      if (command.result?.media?.type === 'video') add(slide, command.result.media, command.command, true)
    }
  }
  for (const command of NEW_WIDGETS) {
    const slide = slides.find(s => s.title === command)
    if (!slide) throw new Error(`Required new-video slide is missing: ${command}`)
    if (items.some(i => i.slideId === slide.id)) continue
    items.push({ key: `widget-${slug(command)}`, slideId: slide.id, title: command, family: 'chatgpt-widgets', service: 'ChatGPT', command,
      originalPrompt: slide.prompt, source: { src: null, metadata: 'data/demos/chatgpt-widget-recheck.json', authoredSlide: 'data/content/workshop-slides.json', pointer: { slideId: slide.id } },
      resultRequirements: { kinds: ['chatgpt-share'], recipientVerificationRequired: true, interactiveRequired: true, publicOwnerIndependent: true },
      status: 'pending', newVideo: true, directory: `widget-${slug(command)}` })
  }
  if (items.length !== APPROVED_VIDEO_COUNT || new Set(items.map(i => i.key)).size !== APPROVED_VIDEO_COUNT) throw new Error(`Approved inventory must contain ${APPROVED_VIDEO_COUNT} distinct items; found ${items.length}`)
  return { schemaVersion: 1, createdAt: new Date().toISOString(), approvedVideoCount: APPROVED_VIDEO_COUNT,
    activeUniqueVideoCount: new Set(active.map(i => i.source.src)).size,
    sourceBook: { path: BOOK, sha256: sha(path.join(ROOT, BOOK)) },
    format: { width: 1440, height: 900, fps: 60, setupRate: 3, generationRate: 4, usageRate: 1, promptHoldSeconds: 2 },
    publication: { status: 'blocked-until-all-accepted', workerWritesLiveFiles: false, pilotGateRequired: true },
    scopeReviewRequired: concurrentAdditions.map(i => ({ slideId: i.slideId, src: i.source.src, reason: 'Active video added outside the approved 46+3 inventory', decision: null })),
    items, activeVideos: active.map(({ key, slideId, source }) => ({ key, slideId, ...source })) }
}

export function snapshotBaseline(inventory) {
  const files = new Set(SOURCES)
  for (const clip of inventory.activeVideos) for (const field of ['src', 'poster', 'captions']) if (clip[field]) files.add('public/' + clip[field])
  return { schemaVersion: 1, createdAt: new Date().toISOString(),
    files: [...files].sort().filter(f => fs.existsSync(path.join(ROOT, f))).map(file => ({ path: file, sha256: sha(path.join(ROOT, file)) })) }
}

export function verifyBaseline(run) {
  const baseline = read(path.join(run, 'baseline.json'))
  const changed = baseline.files.filter(f => !fs.existsSync(path.join(ROOT, f.path)) || sha(path.join(ROOT, f.path)) !== f.sha256).map(f => f.path)
  return { unchanged: changed.length === 0, checked: baseline.files.length, changed }
}

const existingEvidence = (clip, file) => {
  if (!file || typeof file !== 'string') return false
  const resolved = path.resolve(clip, file)
  return resolved.startsWith(path.resolve(clip) + path.sep) && fs.existsSync(resolved)
}

/** Native account/menu evidence is private staging provenance, never slide media. */
export function auditNotebookProductionContext(capture, sourceDirectory, requirements=NOTEBOOK_PRODUCTION_REQUIREMENTS) {
  const failures=[],context=capture?.notebookProductionContext
  const nativeDomain=text=>String(text).match(/Google Account:[^\n]*?([A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,}))/i)?.[2]?.toLowerCase()
  const notebookIdentity=value=>{try{const u=new URL(value);return u.origin==='https://notebook.google.com'?u.origin+u.pathname:null}catch{return null}}
  const expectedNotebook=notebookIdentity(capture?.ownerConversationUrl || capture?.conversationUrl)
  if (capture?.accountDomain!==requirements.accountDomain || context?.accountDomain!==requirements.accountDomain) failures.push('notebook-requires-unimib-account')
  if (capture?.uiLanguage!==requirements.uiLanguage || context?.uiLanguage!==requirements.uiLanguage) failures.push('notebook-requires-english-interface')
  if (context?.version!==requirements.version) failures.push('notebook-production-context-version-missing')
  const verify=(proof,method,kind)=>{
    const exactTime=Number.isFinite(Date.parse(proof?.capturedAt)),window=proof?.captureTime
    const boundedTime=Number.isFinite(Date.parse(window?.earliest))&&Number.isFinite(Date.parse(window?.latest))&&Date.parse(window.earliest)<=Date.parse(window.latest)&&window.basis
    if (proof?.method!==method || !proof.reviewedBy || (!exactTime&&!boundedTime) || !Array.isArray(proof.evidence) || !proof.evidence.length) return false
    const earliest=Date.parse(exactTime?proof.capturedAt:window.earliest),latest=Date.parse(exactTime?proof.capturedAt:window.latest),started=Date.parse(capture.startedAt)
    if (!expectedNotebook || !Number.isFinite(started) || earliest<started-600000 || latest>started+60000) return false
    let nativeScreenshot=false,observedNativeIdentity=false
    for (const evidence of proof.evidence) {
      if (!existingEvidence(sourceDirectory,evidence.path) || !/^[a-f0-9]{64}$/.test(evidence.sha256 || '') || sha(path.resolve(sourceDirectory,evidence.path))!==evidence.sha256) return false
      if (evidence.kind==='native-screenshot') {
        const bytes=fs.readFileSync(path.resolve(sourceDirectory,evidence.path))
        if (bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' && bytes.subarray(0,3).toString('hex')!=='ffd8ff') return false
        nativeScreenshot=true
      }
      if (evidence.kind==='native-ax') {
        const text=fs.readFileSync(path.resolve(sourceDirectory,evidence.path),'utf8')
        const sameNotebook=[...text.matchAll(/https:\/\/notebook\.google\.com\/notebook\/[a-zA-Z0-9-]+(?:\/artifact\/[a-zA-Z0-9-]+)?(?:\?[^"\s]*)?/g)].some(m=>notebookIdentity(m[0])===expectedNotebook)
        if (kind==='account') observedNativeIdentity ||= sameNotebook&&nativeDomain(text)===requirements.accountDomain
        else observedNativeIdentity ||= sameNotebook&&Array.isArray(proof.observedLabels)&&proof.observedLabels.every(label=>text.split('\n').some(line=>/^\s*\d+\s+(?:button|heading|text entry area)\b/.test(line)&&line.includes(label)))
      }
      if (evidence.kind==='read-only-native-ui-observation') {
        try {
          const observation=read(path.resolve(sourceDirectory,evidence.path))
          const sameNotebook=notebookIdentity(observation.url)===expectedNotebook
          if (kind==='account') observedNativeIdentity ||= sameNotebook&&nativeDomain(observation.accountButton)===requirements.accountDomain
          else observedNativeIdentity ||= sameNotebook&&observation.documentLanguage?.split('-')[0]==='en'&&Array.isArray(proof.observedLabels)&&proof.observedLabels.every(label=>observation.visibleButtonLabels?.includes(label))
        } catch {return false}
      }
    }
    if (!nativeScreenshot || !observedNativeIdentity) return false
    if (kind==='account') return proof.observedDomain===requirements.accountDomain
    const observedEnglishControls=new Set(['Create notebook','Add source','Sources','Query box','Submit','Collapse source panel','Collapse studio panel'])
    return proof.observedLanguage===requirements.uiLanguage && Array.isArray(proof.observedLabels) && new Set(proof.observedLabels.filter(x=>observedEnglishControls.has(x))).size>=2
  }
  if (!verify(context?.accountSelector,requirements.accountEvidenceMethod,'account')) failures.push('notebook-missing-native-unimib-selector-proof')
  if (!verify(context?.englishInterface,requirements.interfaceEvidenceMethod,'interface')) failures.push('notebook-missing-native-english-ui-proof')
  return failures
}

export function validateNativeNotebookContinuation({capture,child,retake,run,item}) {
  const owner=capture.ownerConversationUrl||capture.conversationUrl,e=child.evidence || {}
  if (item.service!=='NotebookLM' || child.conversationUrl!==owner || e.parentNotebookUrl!==owner || e.parentCaptureKey!==capture.key || child.newNotebook===true) throw Error('Continuation notebook identity mismatch')
  const book=capture.book?.sha256 || capture.sourceBook?.sha256
  if (!book || (e.sourceBookSha256 || child.sourceBook?.sha256 || child.book?.sha256)!==book) throw Error('Continuation book mismatch')
  for (const c of [capture,child]) if (c.accountDomain!=='unimib.it' || c.uiLanguage!=='en') throw Error('Continuation requires actual Unimib English context')
  const declared=e.resultExport || capture.evidence?.resultExport
  if (!declared || declared.method!=='native-copy') throw Error('Continuation must retain an actual native Copy result')
  const artifact=path.resolve(declared.file),provenance=path.resolve(declared.provenance)
  if (![artifact,provenance].every(f=>f.startsWith(path.resolve(run)+path.sep)&&fs.existsSync(f))) throw Error('Continuation native result is missing')
  const original=read(provenance),actual=sha(artifact)
  if (original.method!=='native-copy' || original.sourceUrl!==owner || original.clipboardSha256!==actual || !Number.isFinite(Date.parse(original.clipboardReadAt))) throw Error('Continuation original clipboard provenance mismatch')
  if (e.resultExport) {
    const proof=retake.resultProof
    if (retake.retainsParentResult || retake.resultSha256!==actual || !proof || proof.method!=='native-copy' || proof.sourceUrl!==owner || proof.clipboardSha256!==actual || proof.clipboardReadAt!==original.clipboardReadAt || path.resolve(ROOT,proof.artifactPath)!==artifact || path.resolve(ROOT,proof.provenancePath)!==provenance || proof.provenanceSha256!==sha(provenance) || proof.bytes!==fs.statSync(artifact).size || !child.actions?.some(a=>a.at===proof.copyActionSourceAt&&a.at===original.nativeCopyAction?.at&&/Copy/.test(a.label))) throw Error('Continuation new-result proof mismatch')
  } else if (retake.retainsParentResult!==true || retake.resultSha256 || retake.resultProof || retake.childResult) throw Error('Citation-only continuation must honestly retain the parent result without claiming a new Copy')
}

export function auditRun(run, {onlyKeys=null}={}) {
  const inventory = read(path.join(run, 'inventory.json')), baseline = verifyBaseline(run)
  const scopedAudit=onlyKeys!==null
  if(scopedAudit&&(!Array.isArray(onlyKeys)||!onlyKeys.length||new Set(onlyKeys).size!==onlyKeys.length||onlyKeys.some(key=>!inventory.items.some(item=>item.key===key))))throw Error('Scoped audit requires unique keys from the exact active inventory')
  let activeScope=null,scopeValidationError=null
  try { activeScope=validateRefreshScope(run,inventory) } catch(error) { scopeValidationError=error.message }
  const inventoryValid = !scopeValidationError && inventory.approvedVideoCount === APPROVED_VIDEO_COUNT && inventory.items.length === APPROVED_VIDEO_COUNT && new Set(inventory.items.map(i => i.key)).size === APPROVED_VIDEO_COUNT && inventory.items.every(i => !EXCLUDED_REFRESH_KEYS.has(i.key))
  const issues = [], reports = []
  for (const item of inventory.items.filter(item=>!scopedAudit||onlyKeys.includes(item.key))) {
    const directory = path.join(run, item.directory)
    const record = name => fs.existsSync(path.join(directory, name)) ? read(path.join(directory, name)) : null
    const render = record('render.json'), qa = record('qa.json'), result = normalizedResult(record('result.json') || record('shared-result.json'))
    const failures = []
    if (fs.existsSync(path.join(directory,'.rendering.json'))) failures.push('render-in-progress-or-interrupted')
    if (!render || render.fixture || render.productionEligible !== true) failures.push('missing-new-production-render')
    if (render) {
      for (const field of ['video', 'poster', 'captions', 'transcript']) if (!existingEvidence(directory, render.files?.[field]?.path)) failures.push(`missing-${field}`)
      for (const value of Object.values(render.files || {})) if (existingEvidence(directory, value.path) && sha(path.resolve(directory, value.path)) !== value.sha256) failures.push(`hash-mismatch:${value.path}`)
      if (render.width !== 1440 || render.height !== 900 || render.fps !== 60 || !(render.durationSeconds > 0)) failures.push('wrong-video-format')
      if (existingEvidence(directory, render.files?.video?.path)) {
        try {
          const measured = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-show_entries', 'format=duration', '-of', 'json', path.resolve(directory, render.files.video.path)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
          const stream = measured.streams[0]
          const [num, den] = stream.r_frame_rate.split('/').map(Number)
          if (stream.width !== 1440 || stream.height !== 900 || num / den !== 60 || Math.abs(Number(measured.format.duration) - render.durationSeconds) > .02) failures.push('measured-video-format-mismatch')
        } catch { failures.push('video-probe-failed') }
      }
      const sourceFile = path.resolve(ROOT, render.capture?.path || '', 'capture.json')
      if (!sourceFile.startsWith(path.resolve(run) + path.sep) || !fs.existsSync(sourceFile) || sha(sourceFile) !== render.capture?.sha256) failures.push('source-capture-changed-after-render')
      if (sourceFile.startsWith(path.resolve(run)+path.sep)&&fs.existsSync(sourceFile)) {
        try {validateNativeSourceReview(read(sourceFile),path.dirname(sourceFile),run)} catch {failures.push('immutable-original-native-source-mismatch')}
        if(item.key==='widget-flashcard'&&read(sourceFile).key==='widget-flashcard-inline-take1') {
          try {
            const qualification=qualifyRootWidgetRenderActions({capture:read(sourceFile),sourceDirectory:path.dirname(sourceFile),exclusions:render.excludedRanges||[],rootDirectory:ROOT})
            if(JSON.stringify(qualification)!==JSON.stringify(render.nativeRootWidgetEvidence))throw Error('Saved root widget input profile differs from the actual raw source')
          } catch {failures.push('native-root-widget-input-provenance-mismatch')}
        }
      }
      if(item.key==='skills-the-learning-skill'&&fs.existsSync(sourceFile)&&read(sourceFile).nativeUsageRetakes?.some(r=>r.kind==='native-work-learning-original-preview-retake')) {
        try {
          const qualification=qualifyLearningRecordedOperations({capture:read(sourceFile),sourceDirectory:path.dirname(sourceFile),exclusions:render.excludedRanges||[],rootDirectory:ROOT})
          if(JSON.stringify(qualification)!==JSON.stringify(render.nativeLearningRecordedOperationsEvidence))throw Error('Saved Learning recorded-operation qualification differs from the frozen raw source')
        } catch {failures.push('native-learning-recorded-operation-provenance-mismatch')}
      }
      if (WORK_UI_KEYS.has(item.key)) {
        try {
          if (!sourceFile.startsWith(path.resolve(run)+path.sep)) throw Error('Work source outside staging')
          const nativeSource=read(sourceFile),identity=validateWorkUiIdentity({capture:nativeSource,sourceDirectory:path.dirname(sourceFile),item})
          if (render.capture.ownerResponseId || render.capture.ownerIdentityMethod!==identity.method || render.capture.ownerVisibleTextSha256!==identity.visibleTextSha256
              || JSON.stringify(render.observedWorkUiIdentity)!==JSON.stringify(nativeSource.observedWorkUiIdentity)) throw Error('Rendered Work source identity differs from its native observation')
        } catch { failures.push('native-work-ui-identity-mismatch') }
      }
      if (item.service==='NotebookLM') {
        if (!fs.existsSync(sourceFile)) failures.push('notebook-production-context-source-missing')
        else {
          const nativeSource=read(sourceFile)
          failures.push(...auditNotebookProductionContext(nativeSource,path.dirname(sourceFile),NOTEBOOK_PRODUCTION_REQUIREMENTS))
          if (nativeSource.evidence?.supplementalResultReadRequired===true) failures.push('notebook-supplemental-result-read-required')
        }
      }
      const insert = render.nativePromptInsert
      if (insert) {
        const sourceDirectory = path.dirname(sourceFile)
        if (!existingEvidence(sourceDirectory, insert.file) || sha(path.resolve(sourceDirectory, insert.file)) !== insert.sha256 || !existingEvidence(sourceDirectory, insert.sidecar) || sha(path.resolve(sourceDirectory, insert.sidecar)) !== insert.sidecarSha256) failures.push('native-prompt-insert-hash-mismatch')
        if (insert.ownerResponseId !== render.capture?.ownerResponseId || insert.ownerConversationUrl !== render.capture?.ownerConversationUrl || insert.completePromptVisible !== true) failures.push('native-prompt-insert-owner-or-visibility-mismatch')
        if (fs.existsSync(sourceFile)) {
          const capture = read(sourceFile)
          const promptSha = crypto.createHash('sha256').update(capture.prompt || '').digest('hex')
          if (insert.promptSha256 !== promptSha || !(Date.parse(insert.capturedAt) >= Date.parse(capture.startedAt))) failures.push('native-prompt-insert-prompt-or-time-mismatch')
        }
      }
      if (render.nativePromptReading && fs.existsSync(sourceFile)) {
        const reading=render.nativePromptReading,capture=read(sourceFile),sourceDirectory=path.dirname(sourceFile)
        if (!reading.reviewedBy || !reading.reason || !(reading.end-reading.start>=1900&&reading.end-reading.start<=3500) || !existingEvidence(sourceDirectory,reading.file) || sha(path.resolve(sourceDirectory,reading.file))!==reading.sha256 || !capture.frames?.some(f=>f.file===reading.file&&f.at<=reading.start&&reading.start-f.at<150) || !capture.recordingWindows?.some(w=>w.start<=reading.start&&reading.end<=w.end) || [...(capture.idleRanges||[]),...(render.excludedRanges||[])].some(r=>reading.start<r.end&&reading.end>r.start)) failures.push('native-complete-prompt-reading-mismatch')
      }
      if (render.nativeHolds?.length && fs.existsSync(sourceFile)) {
        const sourceDirectory=path.dirname(sourceFile),capture=read(sourceFile)
        for (const hold of render.nativeHolds) if (!existingEvidence(sourceDirectory,hold.file) || sha(path.resolve(sourceDirectory,hold.file))!==hold.sha256 || !capture.frames?.some(f=>f.file===hold.file&&f.at===hold.sourceAt) || !(hold.seconds>0) || !hold.reason) failures.push('native-read-hold-source-mismatch')
      }
      if (render.nativeReadInserts?.length && fs.existsSync(sourceFile)) {
        const sourceDirectory=path.dirname(sourceFile),capture=read(sourceFile)
        for (const insert of render.nativeReadInserts) {
          try {
            const origin=path.resolve(ROOT,insert.origin.capturePath),originalFile=path.join(origin,'capture.json')
            if (!origin.startsWith(path.resolve(run)+path.sep) || !fs.existsSync(originalFile) || sha(originalFile)!==insert.origin.captureSha256) throw Error('Native origin capture mismatch')
            const original=read(originalFile),frame=original.frames?.find(f=>f.file===insert.origin.file&&f.at===insert.origin.sourceAt)
            if (!original.complete || !frame || original.conversationUrl!==insert.sourceUrl || original.evidence?.parentCaptureKey!==capture.key || insert.parentCaptureKey!==capture.key || !existingEvidence(origin,frame.file) || sha(path.resolve(origin,frame.file))!==insert.sha256 || Math.abs(Date.parse(insert.capturedAt)-frame.timestamp*1000)>=1) throw Error('Original native page/frame/time mismatch')
            if (!existingEvidence(sourceDirectory,insert.file) || sha(path.resolve(sourceDirectory,insert.file))!==insert.sha256 || !existingEvidence(sourceDirectory,insert.sidecar) || sha(path.resolve(sourceDirectory,insert.sidecar))!==insert.sidecarSha256 || !(insert.seconds>0&&insert.seconds<=15)) throw Error('Native read insert file mismatch')
            if (!capture.actions?.some(a=>a.at===insert.triggerAction.at&&a.label===insert.triggerAction.label) || !capture.frames?.some(f=>f.at===insert.sourceAt) || insert.sourceAt<insert.triggerAction.at) throw Error('Native source-opening action mismatch')
            if (insert.resultSha256) {
              const artifact=path.resolve(capture.evidence?.resultExport?.file || '')
              if (!artifact.startsWith(path.resolve(run)+path.sep) || !fs.existsSync(artifact) || sha(artifact)!==insert.resultSha256 || original.evidence?.resultSha256!==insert.resultSha256) throw Error('Native result-reading output identity mismatch')
            }
          } catch { failures.push('native-original-source-reading-insert-mismatch') }
        }
      }
      if (render.nativeUsageRetakes?.length && fs.existsSync(sourceFile)) {
        const capture=read(sourceFile),sourceDirectory=path.dirname(sourceFile)
        for (const retake of render.nativeUsageRetakes) {
          try {
            const origin=path.resolve(ROOT,retake.origin.capturePath),originFile=path.join(origin,'capture.json')
            if (!origin.startsWith(path.resolve(run)+path.sep) || !fs.existsSync(originFile) || sha(originFile)!==retake.origin.captureSha256) throw Error('Retake source changed')
            const child=read(originFile),delta=child.started-capture.started
            if (!child.complete || child.evidence?.parentCaptureKey!==capture.key || retake.deltaMs!==delta) throw Error('Retake owner/result identity mismatch')
            const continuation=retake.kind==='native-conversation-continuation'
            const artifactReader=retake.kind==='native-artifact-reader'
            const appReader=retake.kind==='native-notebook-app-reader'
            const inlineWidgetReader=retake.kind==='native-inline-widget-reader'
            const learningPreview=retake.kind==='native-work-learning-original-preview-retake'
            const workFileRead=retake.kind==='native-work-file-preview-retake'
            const workDiagramRead=retake.kind==='native-work-diagram-preview-retake'
            if (!continuation && !artifactReader && !appReader && !inlineWidgetReader && !learningPreview && child.evidence?.resultSha256!==retake.resultSha256) throw Error('Retake result identity mismatch')
            const owner=capture.ownerConversationUrl||capture.conversationUrl
            if (retake.kind==='exported-result-reader') {
              const reader=retake.readerResult,recordFile=path.resolve(ROOT,reader?.recordPath || '')
              if (item.service!=='NotebookLM' || !hasNativeResultReadEvidence(child.evidence) || child.evidence.parentNotebookUrl!==owner || !recordFile.startsWith(path.resolve(directory)+path.sep) || !fs.existsSync(recordFile)) throw Error('Invalid native exported-result reader')
              const registered=read(recordFile)
              if (registered.kind!=='file' || !registered.recipientVerified || !registered.ownerIndependent || registered.sourceExport?.sourceUrl!==owner || child.conversationUrl!==registered.url || reader.url!==registered.url || registered.file?.sha256!==retake.resultSha256 || reader.sha256!==retake.resultSha256 || path.resolve(ROOT,reader.artifactPath)!==path.resolve(directory,registered.file.path)) throw Error('Native reader is not this exact registered result')
            } else if (workFileRead) validateNativeWorkFileRetake({capture,child,retake,item,directory,sourceDirectory,run})
            else if (workDiagramRead) validateNativeWorkDiagramRetake({capture,child,retake,item,sourceDirectory,retakeDirectory:origin,run})
            else if (artifactReader) validateNativeArtifactReader({capture,child,retake,item})
            else if (appReader) validateNativeNotebookAppReader({capture,child,retake,item,sourceDirectory,readerDirectory:origin,run,rootDirectory:ROOT,renderExcludedRanges:render.excludedRanges||[]})
            else if (inlineWidgetReader) validateInlineWidgetReader({capture,child,retake,item,sourceDirectory,readerDirectory:origin,run,rootDirectory:ROOT,exclusions:render.excludedRanges||[]})
            else if (learningPreview) {
              const qualification=validateNativeLearningPreviewRetake({capture,child,retake,item,sourceDirectory,retakeDirectory:origin,run,rootDirectory:ROOT,renderExcludedRanges:render.excludedRanges||[]})
              if(JSON.stringify(qualification.nativeInputEvidence)!==JSON.stringify(render.nativeLearningInputEvidence))throw Error('Saved Learning native AX/unmarked marker qualification differs from immutable source')
            }
            else if (continuation) validateNativeNotebookContinuation({capture,child,retake,run,item})
            else if (child.conversationUrl!==owner) throw Error('Retake notebook identity mismatch')
            if (!retake.retainsParentResult && !artifactReader && !appReader && !inlineWidgetReader && !learningPreview) {
              const resultFile=path.resolve(ROOT,retake.childResult.path)
              if (!resultFile.startsWith(path.resolve(run)+path.sep) || !fs.existsSync(resultFile) || sha(resultFile)!==retake.resultSha256) throw Error('Retake clipboard result mismatch')
            }
            const copied=capture.frames.filter(f=>f.nativeRetakeOrigin?.captureSha256===retake.origin.captureSha256)
            if (copied.length!==child.frames.length) throw Error('Retake frame set incomplete')
            for (const frame of copied) {
              const original=child.frames.find(f=>f.file===frame.nativeRetakeOrigin.file&&f.at===frame.nativeRetakeOrigin.sourceAt)
              if (!original || frame.timestamp!==original.timestamp || frame.at!==Math.round(original.timestamp*1000-capture.started) || !existingEvidence(origin,original.file) || !existingEvidence(sourceDirectory,frame.file) || sha(path.resolve(origin,original.file))!==frame.nativeRetakeOrigin.sha256 || sha(path.resolve(sourceDirectory,frame.file))!==frame.nativeRetakeOrigin.sha256) throw Error('Native retake pixels or absolute time changed')
            }
          } catch { failures.push('native-usage-retake-origin-mismatch') }
        }
      }
    }
    if (!qa?.accepted) failures.push('not-accepted-by-review')
    if (!render || qa?.videoSha256 !== render.files?.video?.sha256) failures.push('qa-does-not-match-current-video')
    if (!render || qa?.captureSha256 !== render.capture?.sha256) failures.push('qa-does-not-match-current-capture')
    for (const field of ['completeCapture', 'noHistoryVisible', 'uncropped', 'fluidMotionReviewed', 'promptMatches', 'meaningfulUse', 'clickMarkersVerified', 'captionsReviewed']) if (qa?.checks?.[field] !== true) failures.push(`qa:${field}`)
    if (!qa?.evidence?.length || !qa.evidence.every(f => existingEvidence(directory, f))) failures.push('missing-qa-evidence')
    if (render?.omittedClickMarkers?.length && qa?.omittedClickMarkersReviewed !== true) failures.push('omitted-marker-audit-not-reviewed')
    const recipientContexts=result?.kind==='file' ? ['signed-out','independent-account','stateless-http'] : ['signed-out','independent-account']
    if (!result || !item.resultRequirements.kinds.includes(result.kind) || !result.recipientVerified || !result.ownerIndependent || !recipientContexts.includes(result.recipientContext) || !result.verifiedAt) failures.push('missing-verified-result-link')
    if (result) {
      if (result.kind === 'chatgpt-share' && !isPublicChatResultUrl(result.url)) failures.push('not-a-public-chat-share-url')
      if (item.resultRequirements.interactiveRequired && (!result.interactiveVerified || !result.interaction?.action || !result.interaction?.observedChange)) failures.push('shared-widget-not-verified-interactive')
      if (!result.evidence.length || !result.evidence.every(f => existingEvidence(directory, f))) failures.push('missing-recipient-evidence')
      if (result.kind === 'file' && (!existingEvidence(directory, result.file?.path) || sha(path.resolve(directory, result.file.path)) !== result.file.sha256)) failures.push('missing-exported-result-file')
      if (result.kind === 'file') {
        try { failures.push(...auditFileResult({run,item,directory,result,sourceFile:path.resolve(ROOT,render?.capture?.path || '', 'capture.json')})) }
        catch { failures.push('invalid-native-file-result-proof') }
        failures.push(...auditDerivedPdfQuality({directory,result,qa}))
        failures.push(...auditNativeMapScreenshotQuality({directory,result,qa}))
      }
      if (result.kind === 'native' && !/^https:\/\//.test(result.url || '')) failures.push('invalid-native-result-url')
      if (item.service === 'ChatGPT') {
        if (WORK_UI_KEYS.has(item.key)) {
          try {
            const sourceDirectory=path.resolve(ROOT,render?.capture?.path||'')
            if (!sourceDirectory.startsWith(path.resolve(run)+path.sep)) throw Error('Work source outside staging')
            validateWorkSharedResult({capture:read(path.join(sourceDirectory,'capture.json')),sourceDirectory,item,result})
            for (const recordName of result.supplementalFileResults||[]) {
              if (!/^supplemental-[a-z0-9-]+\.json$/.test(recordName)||!existingEvidence(directory,recordName)) throw Error('Unsafe or missing supplementary native Work export')
              const auxiliary=read(path.join(directory,recordName))
              const extra=auditFileResult({run,item,directory,result:auxiliary,sourceFile:path.join(sourceDirectory,'capture.json'),supplementalWork:true})
              failures.push(...extra.map(message=>'supplemental-work:'+message))
            }
          } catch { failures.push('shared-work-result-does-not-match-native-ui-identity') }
        } else {
        const expectedResponse = render?.capture?.ownerResponseId
        const expectedConversation = render?.capture?.ownerConversationUrl
        const resultResponse = result.sourceResponseId || result.ownerResponseId
        const resultConversation = result.sourceConversationUrl || result.ownerConversationUrl
        if (expectedResponse ? resultResponse !== expectedResponse : !expectedConversation || resultConversation !== expectedConversation) failures.push('shared-result-does-not-match-recorded-owner-result')
        }
      }
    }
    if (failures.length) issues.push({ key: item.key, failures })
    reports.push({ key: item.key, accepted: failures.length === 0, failures })
  }
  const scopeUnreviewed = inventory.scopeReviewRequired.filter(i => i.decision !== 'preserve-existing' || !i.reviewedAt || !i.note)
  const pilotFile = path.join(run, 'pilot-gate.json')
  const pilots = fs.existsSync(pilotFile) ? read(pilotFile) : null
  const pilotPassed = pilots?.passed === true && pilots?.examples?.length >= 2 && pilots.examples.map(normalizedResult).every(p => p.recipientVerified && p.interactiveVerified && p.ownerIndependent && p.interaction?.action && p.interaction?.observedChange && p.evidence.length && p.evidence.every(f => existingEvidence(run, f)) && isPublicChatResultUrl(p.url))
  return { schemaVersion: 1, approved: inventory.approvedVideoCount, inventoryValid, accepted: reports.filter(r => r.accepted).length,
    publishAllowed: !scopedAudit && inventoryValid && baseline.unchanged && issues.length === 0 && scopeUnreviewed.length === 0 && pilotPassed,
    ...(scopedAudit ? {scopedAudit:true,auditedKeys:onlyKeys,publicationProofSupplied:false} : {}),
    baseline, pilotPassed, scopeUnreviewed, issues, clips: reports, activeScope, ...(scopeValidationError ? {scopeValidationError} : {}) }
}

function main() {
  const [command = 'status', ...args] = process.argv.slice(2)
  const supplied = args.find((a) => !a.startsWith('--')) || '2026-11-07'
  const run = path.resolve(STAGING, supplied)
  if (!run.startsWith(STAGING + path.sep))
    throw new Error('Run must be inside video-refresh staging')
  if (command === 'init') {
    if (fs.existsSync(path.join(run, 'inventory.json')))
      throw new Error('Run already initialized; baseline will not be silently overwritten')
    const inventory = collectInventory()
    write(path.join(run, 'inventory.json'), inventory)
    write(path.join(run, 'baseline.json'), snapshotBaseline(inventory))
    console.log(
      JSON.stringify({
        run: relative(run),
        approved: inventory.items.length,
        active: inventory.activeUniqueVideoCount,
        scopeReviewRequired: inventory.scopeReviewRequired
      })
    )
  } else if (command === 'verify-baseline') {
    const report = verifyBaseline(run)
    console.log(JSON.stringify(report, null, 2))
    if (!report.unchanged) process.exitCode = 1
  } else if (command === 'status' || command === 'promotion-dry-run') {
    const report = auditRun(run)
    write(path.join(run, 'release-audit.json'), report)
    console.log(
      JSON.stringify(
        {
          approved: report.approved,
          accepted: report.accepted,
          publishAllowed: report.publishAllowed,
          baseline: report.baseline,
          pilotPassed: report.pilotPassed,
          scopeUnreviewed: report.scopeUnreviewed,
          incomplete: report.issues.map((i) => i.key)
        },
        null,
        2
      )
    )
    if (command === 'promotion-dry-run' && !report.publishAllowed) process.exitCode = 1
  } else if (command === 'release-prepare') {
    const at = args.indexOf('--authorization'),
      authorizationPath = at >= 0 ? args[at + 1] : null
    if (!authorizationPath)
      throw Error('release-prepare requires --authorization ACTUAL_USER_INSTRUCTION_JSON')
    console.log(
      JSON.stringify(prepareAcceptedRelease({ run, authorizationPath, auditRun }), null, 2)
    )
  } else if (command === 'release-apply') {
    console.log(JSON.stringify(applyAcceptedRelease({ run }), null, 2))
  } else if (command === 'release-verify') {
    const installed =
      args.includes('--installed') || fs.existsSync(path.join(run, 'release/packet/committed.json'))
    console.log(JSON.stringify(verifyAcceptedRelease({ run, installed }), null, 2))
  } else
    throw new Error(
      'Commands: init, status, verify-baseline, promotion-dry-run, release-prepare, release-apply, release-verify. Accepted-subset publication requires its explicit user authorization packet.'
    )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
