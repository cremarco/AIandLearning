#!/usr/bin/env node
/** Propose explicit recorder-off cuts, or reviewed legacy native-frame gaps. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const STAGING = path.join(ROOT, 'output/review/video-refresh')
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const inside = file => path.resolve(file).startsWith(STAGING + path.sep)
const fast = /(^|[-_])(setup|home|temporary|new|open|upload|pdf|attach|input|typing|write|configure|configuration|settings|select|send)([-_]|$)/
const normal = /usage|widget|review|feedback|hint|answer|retry|summary|read|playback|result|learner|prompt-ready|prompt-hold/
const protectedPhase = phase => phase.preserveTiming === true || phase.readHold === true ||
  ['read', 'reading', 'playback'].includes(phase.category) || /^(read|reading|playback)(?:[-_]|$)/.test(phase.name)
const classify = phase => {
  const category = (phase.category || phase.name).toLowerCase()
  if (category.includes('generation')) return { kind: 'generation', rate: 4, cap: 4 }
  if (normal.test(category)) return { kind: 'usage', rate: 1, cap: 7.5 }
  return fast.test(category) ? { kind: 'setup', rate: 3, cap: 2 } : { kind: 'usage', rate: 1, cap: 7.5 }
}
const range = r => Array.isArray(r) ? { start: r[0], end: r[1] } : r
const validRange = r => Number.isFinite(r.start) && Number.isFinite(r.end) && r.start < r.end
const subtract = (start, end, protectedRanges) => {
  let fragments = [{ start, end }]
  for (const p of protectedRanges) fragments = fragments.flatMap(f => p.end <= f.start || p.start >= f.end ? [f] : [
    ...(p.start > f.start ? [{ start: f.start, end: p.start }] : []),
    ...(p.end < f.end ? [{ start: p.end, end: f.end }] : []),
  ])
  return fragments
}

function recordingWindowProposal(capture, context) {
  const {frames,phases,phaseAt,protectedRanges,inversions,actionProtectionMs,capDomain}=context
  if (actionProtectionMs<1500) throw new Error('Recording-window cuts must preserve at least±1.5s around recorded actions and chooser steps')
  const windows=capture.recordingWindows
  if (!Array.isArray(windows) || !windows.length) throw new Error('recording-windows mode requires observed recorder lifecycle metadata; no gaps will be guessed')
  for (let i=0;i<windows.length;i++) {
    const w=windows[i]
    if (w.failure) throw new Error('A failed recorder lifecycle window cannot establish guaranteed inactivity; review its native stream first')
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start<0 || w.end<w.start || w.end>capture.durationMs || i && windows[i-1].end>w.start) throw new Error('Recording windows must be closed, ordered, nonoverlapping and inside the source duration')
  }
  const proposals=[],gaps=[],skipped=[]
  for (let i=0;i<windows.length-1;i++) {
    const previous=windows[i],next=windows[i+1],start=previous.end,end=next.start
    if (end-start<250) continue
    const gap={start,end,seconds:(end-start)/1000,previousWindowId:previous.id,nextWindowId:next.id,
      guaranteedRecorderInactive:true,previousWindowEnd:start,nextWindowStart:end}
    gaps.push(gap)
    const boundaries=[start,...phases.map(p=>p.at).filter(at=>start<at&&at<end),end]
    for (let n=0;n<boundaries.length-1;n++) {
      const a=boundaries[n],b=boundaries[n+1],phase=phaseAt(a),timing=classify(phase)
      if (phase.preserveTiming===true || phase.readHold===true) {
        skipped.push({start:a,end:b,phase:phase.name,reason:'Explicit preserveTiming/readHold remains intact even outside a recorder window'})
        continue
      }
      const fragments=subtract(a,b,protectedRanges).filter(f=>f.end-f.start>=250)
      if (!fragments.length) skipped.push({start:a,end:b,phase:phase.name,reason:'Recorder-off gap is already edited or protected by an explicit hold/action'})
      for (const f of fragments) proposals.push({...f,keepSeconds:0,
        reason:'Reviewed gap between explicitly closed recorder windows; preserve every in-window read hold and all annotated action/chooser context.',
        proposedBy:'recording-window-inactivity',phase:phase.name,phaseCaption:phase.caption||'',category:timing.kind,
        sourcePlaybackRate:timing.rate,removedSourceSeconds:(f.end-f.start)/1000,
        removedOutputSeconds:(f.end-f.start)/1000/timing.rate,recordingWindowEvidence:gap,
        reviewRequired:true,reviewNote:'Confirm recorder lifecycle windows cover this interval and no meaningful action/chooser context is omitted.'})
    }
  }
  return {schemaVersion:2,mode:'dry-run',timingMode:'recording-windows',generatedAt:new Date().toISOString(),
    sourceComplete:capture.complete===true,capDomain,
    thresholds:{minimumRecorderOffGapSeconds:.25,actionProtectionSeconds:actionProtectionMs/1000},
    policy:'Only gaps between observed closed recorder windows are candidates. Every in-window frame, pause and deliberate read hold is preserved; no7.5s reading heuristic is used.',
    recordingWindowTracking:capture.recordingWindowTracking||null,recordingWindows:windows,
    ...(capture.recordingWindowTracking?.startedWithBegin===false ? {uncoveredLegacyPrefix:{start:0,end:windows[0].start,preserved:true,reason:'No recorder lifecycle observations exist before wrapper attachment; do not infer inactive gaps.'}} : {}),
    nativeTimestampOrdering:{method:'Stable-sort by recorded native timestamp; source delivery order and source JSON remain unchanged',inversions},
    counts:{nativeFrames:frames.length,recordingWindows:windows.length,longGaps:gaps.length,proposedRanges:proposals.length,protectedSegments:skipped.length},
    estimatedSavedSourceSeconds:proposals.reduce((n,r)=>n+r.removedSourceSeconds,0),estimatedSavedOutputSeconds:proposals.reduce((n,r)=>n+r.removedOutputSeconds,0),
    idleRanges:proposals,recorderOffGaps:gaps,protectedSegments:skipped}
}

function hybridProposal(capture,options,context) {
  const windows=recordingWindowProposal(capture,context)
  const coverage=capture.recordingWindowTracking?.coverageStartAt ?? capture.recordingWindows[0].start
  if (!Number.isFinite(coverage) || coverage<0 || coverage>capture.recordingWindows[0].start) throw new Error('Hybrid coverage boundary must be at or before the first observed recording window')
  const legacy=proposeIdleRanges(capture,{...options,mode:'native-gaps'})
  const prefix=legacy.idleRanges.filter(r=>r.start<coverage&&['setup','generation'].includes(r.category)).map(r=>({
    ...r,end:Math.min(r.end,coverage),
    reason:'Reviewed legacy setup/generation native-frame gap strictly before v2 recording coverage. '+r.reason,
    proposedBy:'legacy-prefix-before-recording-windows',hybridCoverageBoundary:coverage,
  })).filter(r=>r.end-r.start>=250).map(r=>({...r,removedSourceSeconds:(r.end-r.start)/1000,removedOutputSeconds:(r.end-r.start)/1000/r.sourcePlaybackRate}))
  const ranges=[...prefix,...windows.idleRanges].sort((a,b)=>a.start-b.start)
  if (ranges.some((r,i)=>i&&ranges[i-1].end>r.start)) throw new Error('Hybrid cuts must not overlap across the observed coverage boundary')
  return {schemaVersion:2,mode:'dry-run',timingMode:'hybrid',generatedAt:new Date().toISOString(),sourceComplete:capture.complete===true,capDomain:context.capDomain,
    thresholds:{...windows.thresholds,legacy:legacy.thresholds},
    policy:'Before observed v2 coverage, propose only reviewed legacy setup/generation native gaps. From coverage onward, remove only observed recorder-off window gaps; preserve every in-window read hold exactly.',
    hybridCoverage:{sourceAt:coverage,legacyPrefixCategories:['setup','generation'],trackedWindowsPreservedInFull:true},
    recordingWindowTracking:capture.recordingWindowTracking||null,recordingWindows:capture.recordingWindows,
    nativeTimestampOrdering:legacy.nativeTimestampOrdering,
    counts:{nativeFrames:context.frames.length,recordingWindows:capture.recordingWindows.length,longGaps:legacy.nativeGaps.filter(g=>g.start<coverage).length+windows.recorderOffGaps.length,legacyPrefixRanges:prefix.length,recorderOffRanges:windows.idleRanges.length,proposedRanges:ranges.length,protectedSegments:legacy.protectedSegments.length+windows.protectedSegments.length},
    estimatedSavedSourceSeconds:ranges.reduce((n,r)=>n+r.removedSourceSeconds,0),estimatedSavedOutputSeconds:ranges.reduce((n,r)=>n+r.removedOutputSeconds,0),
    idleRanges:ranges,nativeGaps:legacy.nativeGaps.filter(g=>g.start<coverage),recorderOffGaps:windows.recorderOffGaps,
    protectedSegments:[...legacy.protectedSegments.filter(r=>r.start<coverage),...windows.protectedSegments]}
}

export function proposeIdleRanges(capture, options = {}) {
  const thresholdMs = options.thresholdMs ?? 10000
  const capDomain = options.capDomain || 'source'
  if (!['source', 'output'].includes(capDomain)) throw new Error('capDomain must be source or output')
  const originalFrames = capture.frames || [], phases = capture.phases || []
  const inversions = originalFrames.flatMap((f,i) => i && originalFrames[i-1].at>f.at ? [{ previousFile:originalFrames[i-1].file, previousAt:originalFrames[i-1].at, file:f.file, at:f.at, deltaMs:originalFrames[i-1].at-f.at }] : [])
  if (inversions.some(i=>i.deltaMs>100) && !(capture.timestampOrderReview?.reviewedBy && capture.timestampOrderReview?.reason)) throw new Error('Native timestamp inversions over100ms require explicit timestampOrderReview')
  const frames = originalFrames.map((f,index)=>({f,index})).sort((a,b)=>a.f.at-b.f.at||a.index-b.index).map(item=>item.f)
  if (frames.length < 2 || !phases.length) throw new Error('Ordered native frames and phases are required')
  const phaseAt = ms => [...phases].reverse().find(p => p.at <= ms) || phases[0]
  const protectedRanges = [
    ...(capture.readHolds || []), ...(capture.readingHolds || []), ...(capture.protectedRanges || []), ...(capture.deliberateHolds || []),
    ...(capture.idleRanges || []), ...(capture.excludedRanges || []),
  ].map(range).filter(validRange)
  // Preserve every recorder action, including actions which caused no damage frame.
  const actionProtectionMs = options.actionProtectionMs ?? 1500
  for (const action of capture.actions || []) protectedRanges.push({
    start: Math.max(0, action.at - actionProtectionMs),
    end: (action.end ?? action.actualActionEndAt ?? action.at) + actionProtectionMs,
    reason: 'Recorder action and its immediate context',
  })
  if (Number.isFinite(capture.promptReadyAt)) protectedRanges.push({
    start: capture.promptReadyAt, end: capture.promptReadyAt + 2000,
    reason: 'Complete prompt reading hold',
  })
  const timingMode=options.mode||'auto'
  if (!['auto','hybrid','recording-windows','native-gaps'].includes(timingMode)) throw new Error('mode must be auto, hybrid, recording-windows or native-gaps')
  if (timingMode==='hybrid' || timingMode==='auto' && capture.recordingWindows?.length && capture.recordingWindowTracking?.startedWithBegin===false) return hybridProposal(capture,options,{frames,phases,phaseAt,protectedRanges,inversions,actionProtectionMs,capDomain})
  if (timingMode==='recording-windows' || timingMode==='auto' && capture.recordingWindows?.length) return recordingWindowProposal(capture,{frames,phases,phaseAt,protectedRanges,inversions,actionProtectionMs,capDomain})
  const proposals = [], gaps = [], skipped = []
  for (let i = 0; i < frames.length - 1; i++) {
    const previous = frames[i], next = frames[i + 1]
    const start = previous.at, end = next.at
    if (end - start <= thresholdMs) continue
    const gap = { start, end, seconds: (end - start) / 1000, previousFrame: previous.file, nextFrame: next.file }
    gaps.push(gap)
    const boundaries = [start, ...phases.map(p => p.at).filter(at => start < at && at < end), end]
    for (let n = 0; n < boundaries.length - 1; n++) {
      const a = boundaries[n], b = boundaries[n + 1], phase = phaseAt(a)
      const timing = classify(phase)
      if (protectedPhase(phase)) {
        skipped.push({ start: a, end: b, phase: phase.name, reason: 'Explicit reading/playback hold is protected in full' })
        continue
      }
      const keepSourceMs = timing.cap * 1000 * (capDomain === 'output' ? timing.rate : 1)
      const cutStart = a + keepSourceMs
      if (cutStart >= b) continue
      const fragments = subtract(cutStart, b, protectedRanges)
      if (!fragments.length) {
        skipped.push({ start: cutStart, end: b, phase: phase.name, reason: 'Already edited or protected by a reading hold / recorder action' })
        continue
      }
      for (const fragment of fragments) {
        if (fragment.end - fragment.start < 250) continue
        proposals.push({ ...fragment, keepSeconds: 0,
          reason: `Reviewed native-frame inactivity gap (${gap.seconds.toFixed(3)}s); preserve ${keepSourceMs / 1000}s source in ${phase.name}, protect actions and explicit reading holds.`,
          proposedBy: 'native-frame-gap-analysis', phase: phase.name, phaseCaption: phase.caption || '',
          category: timing.kind, sourcePlaybackRate: timing.rate,
          preservedSourceSeconds: keepSourceMs / 1000,
          preservedOutputSeconds: keepSourceMs / 1000 / timing.rate,
          removedSourceSeconds: (fragment.end - fragment.start) / 1000,
          removedOutputSeconds: (fragment.end - fragment.start) / 1000 / timing.rate,
          gapEvidence: gap,
          reviewRequired: true,
          reviewNote: timing.kind === 'usage' ? 'Confirm this is an inactive recorder gap rather than intentional learner reading.' : 'Confirm no meaningful native transition is omitted.',
        })
      }
    }
  }
  return { schemaVersion: 1, mode: 'dry-run', timingMode:'native-gaps', generatedAt: new Date().toISOString(),
    sourceComplete: capture.complete === true, capDomain,
    thresholds: { nativeGapSeconds: thresholdMs / 1000, capsSeconds: { usage: 7.5, setup: 2, generation: 4 }, capDomain, actionProtectionSeconds: actionProtectionMs / 1000 },
    policy: 'Legacy native-frame-gap mode: no source mutation in dry-run. Explicit read/playback holds and recorder actions are protected. Every proposed normal-use cut needs coordinator review. New v2 recordings should use recording-windows mode.',
    nativeTimestampOrdering: { method: 'Stable-sort by recorded native timestamp; source delivery order and source JSON remain unchanged', inversions },
    counts: { nativeFrames: frames.length, longGaps: gaps.length, proposedRanges: proposals.length, protectedSegments: skipped.length },
    estimatedSavedSourceSeconds: proposals.reduce((n, r) => n + r.removedSourceSeconds, 0),
    estimatedSavedOutputSeconds: proposals.reduce((n, r) => n + r.removedOutputSeconds, 0),
    idleRanges: proposals, nativeGaps: gaps, protectedSegments: skipped }
}

export function applyIdleProposal(captureFile, proposalFile, reviewer) {
  if (!reviewer?.trim()) throw new Error('Applying requires --reviewed-by <coordinator>; dry-run does not approve cuts')
  if (!inside(captureFile) || !inside(proposalFile)) throw new Error('Capture and proposal must remain inside video-refresh staging')
  const proposal = read(proposalFile), capture = read(captureFile)
  if (!capture.complete) throw new Error('An unfinished capture cannot be finalized')
  if (proposal.captureSha256 !== sha(captureFile)) throw new Error('Capture changed after the dry-run; generate a fresh proposal')
  if (path.resolve(proposal.capturePath) !== path.resolve(captureFile)) throw new Error('Proposal identifies another capture')
  if (!proposal.idleRanges.every(r => validRange(r) && r.keepSeconds === 0 && r.reason?.trim())) throw new Error('Proposal contains invalid or unexplained ranges')
  if (['recording-windows','hybrid'].includes(proposal.timingMode)) {
    const allowed=proposeIdleRanges(capture,{mode:proposal.timingMode,capDomain:proposal.capDomain||'source',actionProtectionMs:Math.max(1500,(proposal.thresholds?.actionProtectionSeconds??1.5)*1000)}).idleRanges
    if (!proposal.idleRanges.every(r=>allowed.some(a=>a.start<=r.start&&r.end<=a.end))) throw new Error('Recording-window proposal reaches inside a recorded window or protected action/read hold')
  }
  const backup = path.join(path.dirname(captureFile), `capture.before-idle-finalizer-${proposal.captureSha256.slice(0, 12)}.json`)
  if (!fs.existsSync(backup)) fs.copyFileSync(captureFile, backup)
  capture.idleRanges = [...(capture.idleRanges || []), ...proposal.idleRanges.map(r => ({ start: r.start, end: r.end, keepSeconds: 0, reason: r.reason, sourcePhase: r.phase }))]
  capture.finalization ||= []
  capture.finalization.push({ operation: 'reviewed-native-idle-ranges', reviewedBy: reviewer.trim(), appliedAt: new Date().toISOString(),
    proposalPath: proposalFile, proposalSha256: sha(proposalFile), originalCaptureSha256: proposal.captureSha256,
    backupPath: backup, rangesAdded: proposal.idleRanges.length, capDomain: proposal.capDomain,timingMode:proposal.timingMode||'native-gaps' })
  const temp = path.join(path.dirname(captureFile), '.capture.finalizing.tmp')
  fs.writeFileSync(temp, JSON.stringify(capture, null, 2) + '\n')
  fs.renameSync(temp, captureFile)
  return { applied: true, rangesAdded: proposal.idleRanges.length, backupPath: backup, captureSha256: sha(captureFile) }
}

function main() {
  const [command = 'propose', target, ...args] = process.argv.slice(2)
  if (!target || !['propose', 'apply'].includes(command)) throw new Error('Usage: finalize-staged-capture.mjs propose <capture.json> [--proposal <staged-file>] [--mode auto|hybrid|recording-windows|native-gaps] [--cap-domain source|output], or apply <capture.json> --proposal <file> --reviewed-by root')
  const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const captureFile = path.resolve(target), proposalFile = flag('--proposal') ? path.resolve(flag('--proposal')) : null
  if (!inside(captureFile) || proposalFile && !inside(proposalFile)) throw new Error('This tool only processes video-refresh staging')
  if (command === 'apply') {
    if (!proposalFile) throw new Error('Applying requires an existing reviewed --proposal')
    console.log(JSON.stringify(applyIdleProposal(captureFile, proposalFile, flag('--reviewed-by')), null, 2))
  } else {
    const capture = read(captureFile)
    const report = { ...proposeIdleRanges(capture, { capDomain: flag('--cap-domain') || 'source',mode:flag('--mode')||'auto' }),
      capturePath: captureFile, captureSha256: sha(captureFile) }
    if (proposalFile) {
      fs.mkdirSync(path.dirname(proposalFile), { recursive: true })
      fs.writeFileSync(proposalFile, JSON.stringify(report, null, 2) + '\n')
      console.log(JSON.stringify({ mode: report.mode,timingMode:report.timingMode, proposal: proposalFile, sourceComplete: report.sourceComplete, capDomain: report.capDomain,
        ...report.counts, estimatedSavedSourceSeconds: report.estimatedSavedSourceSeconds,
        estimatedSavedOutputSeconds: report.estimatedSavedOutputSeconds, captureUnchanged: sha(captureFile) === report.captureSha256 }, null, 2))
    } else console.log(JSON.stringify(report, null, 2))
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
