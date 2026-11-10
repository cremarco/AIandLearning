import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { projectRoot as root } from '../lib/project.mjs'

// Restore the genuine episode audio to the existing, silent screen recording.
// Keep all original release assets immutable and publish a derived packet.
const releaseId = '2026-11-10-notebook-audio-restored'
const base = `materials/video-refresh/${releaseId}`
const previousManifest = 'materials/video-refresh/2026-11-09-flashcard-short-prompt/release-manifest.json'
const publicFile = file => path.join(root, 'public', file)
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const describe = file => {
  const bytes = fs.readFileSync(publicFile(file))
  return { path: file, sha256: digest(bytes), bytes: bytes.length }
}
const previous = read(publicFile(previousManifest))
const clip = previous.clips.find(item => item.key === 'notebook-audio')
const original = clip.media
const sourceVideo = describe(original.src)
const sourceAudio = describe(original.result.url.replace(/^\//, ''))
assert.equal(sourceVideo.sha256, original.sha256)
assert.equal(sourceAudio.sha256, original.result.sha256)
const duration = original.durationSeconds
// The screen capture exposes whole-second player times (12→17, then 17→22).
// Fractional source alignment is an estimate; preserve normal-speed speech.
const segments = [
  { videoStart: 12.421416667, videoEnd: 17.783, audioStart: 12.5 },
  { videoStart: 23.977, videoEnd: 28.404, audioStart: 17.861583333 },
]
const target = `${base}/notebook-audio/video.mp4`
fs.mkdirSync(path.dirname(publicFile(target)), { recursive: true })
const trims = segments.map((s, i) => `[s${i}]atrim=start=${s.audioStart}:duration=${s.videoEnd - s.videoStart},asetpts=N/SR/TB,adelay=${Math.round(s.videoStart * 44100)}S:all=1[a${i}]`)
const filter = `[1:a]asplit=2[s0][s1];${trims.join(';')};[a0][a1]amix=inputs=2:normalize=0,asetpts=N/SR/TB,apad=whole_dur=${duration},atrim=duration=${duration}[audio]`
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', publicFile(sourceVideo.path), '-i', publicFile(sourceAudio.path), '-filter_complex', filter, '-map', '0:v:0', '-map', '[audio]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration), '-movflags', '+faststart', publicFile(target)])

// Verify unchanged compressed video packets, audible excerpts and silent pauses.
const videoHash = file => execFileSync('ffmpeg', ['-v', 'error', '-i', publicFile(file), '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'], { encoding: 'utf8' }).trim()
assert.equal(videoHash(target), videoHash(sourceVideo.path), 'Screen recording must remain unchanged')
const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', publicFile(target), '-map', '0:a:0', '-ar', '16000', '-ac', '1', '-f', 'f32le', '-'], { maxBuffer: 8 * 1024 * 1024 })
assert(pcm.length >= (duration - 0.02) * 16000 * 4, 'Audio must cover the complete video timeline')
const signal = (start, end) => {
  const first = Math.ceil(start * 16000)
  const last = Math.floor(end * 16000)
  let sum = 0
  for (let i = first; i < last; i++) sum += pcm.readFloatLE(i * 4) ** 2
  return 10 * Math.log10(Math.max(sum / (last - first), 1e-16))
}
const verification = {
  videoPacketsUnchanged: true,
  activeRmsDb: [[12.7, 17.5], [24.3, 28.1]].map(([a, b]) => signal(a, b)),
  pauseRmsDb: [[0, 12.2], [18, 23.7], [28.7, 34.5]].map(([a, b]) => signal(a, b)),
}
assert(verification.activeRmsDb.every(db => db > -50), 'Both playback excerpts must be audible')
assert(verification.pauseRmsDb.every(db => db < -70), 'Setup and paused playback must remain silent')

const transcriptFile = `${base}/notebook-audio/transcript.txt`
const transcript = original.transcript.replace(
  'This is a silent native screen capture of selected control excerpts. Genuine nativeDownload M4A bytes/provenance are retained separately for independent playback; no full continuous listening or recorded voice track is claimed.',
  'The original screen capture was silent. This version restores excerpts from the genuine downloaded M4A during the two playback intervals, with silence during setup and pauses. The original video frames and full M4A are unchanged. Source audio starts at 12.500 s, continuing at 17.862 s in the second interval. Fractional alignment is estimated from the on-screen whole-second player times; this is not a live system-audio capture or a full continuous listening session.'
).split('\n').map(line => line.trimEnd()).join('\n').trimEnd() + '\n'
assert.notEqual(transcript, original.transcript)
fs.writeFileSync(publicFile(transcriptFile), transcript)
const provenanceFile = `${base}/notebook-audio/provenance.json`
const contentFile = path.join(root, 'data/content/media.json')
const content = read(contentFile)
const media = { ...content.S67AUDIO, ...original, src: target, transcript, transcriptFile, provenance: provenanceFile,
  sha256: describe(target).sha256, recordingMode: 'native-capture-restored-audio', refreshReleaseId: releaseId }
write(publicFile(provenanceFile), {
  schemaVersion: 1, kind: 'notebook-audio-restoration', sourceVideo, sourceAudio, segments,
  synchronization: 'Normal-speed excerpts aligned to whole-second native player times; fractional source positions are estimated.',
  originalProvenance: original.provenance, verification,
  files: { video: describe(target), transcript: describe(transcriptFile) },
})
const updated = { ...clip, media, files: { ...clip.files, video: describe(target), transcript: describe(transcriptFile) },
  originalCaptureQaSha256: clip.qaSha256, audioVerification: verification }
delete updated.qaSha256 // The prior capture review did not review this restored audio.
const manifest = { ...previous, releaseId, run: releaseId, previousManifest,
  authorization: { exactUserQuote: 'non si sente audio in questo video', scope: 'Restore original audio to the NotebookLM Audio Overview screen recording; preserve the other recordings.' },
  previousOperationsSha256: previous.operationsSha256,
  operationsSha256: digest(JSON.stringify({ sourceVideo, sourceAudio, segments })),
  clips: previous.clips.map(item => item.key === clip.key ? updated : item),
  files: [...previous.files, describe(target), describe(transcriptFile), describe(provenanceFile)],
}
delete manifest.preparedAt
const manifestFile = `${base}/release-manifest.json`
write(publicFile(manifestFile), manifest)
content.S67AUDIO = media
write(contentFile, content)
write(path.join(root, 'data/demos/video-release.json'), { manifest: manifestFile })
console.log(JSON.stringify({ target, verification }, null, 2))
