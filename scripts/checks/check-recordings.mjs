import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { projectPath, readJson } from '../lib/project.mjs'

/** Verify the delivered packet independently of private capture tooling. */
export function checkPublishedRecordings(slides) {
  const pointer = readJson('data/demos/video-release.json', null)
  if (!pointer) return new Map()
  const publicRoot = projectPath('public')
  const localFile = url => {
    assert(typeof url === 'string' && !/^[a-z]+:/i.test(url), `Expected a local recording asset: ${url}`)
    const file = path.resolve(publicRoot, url.replace(/^\.?\//, ''))
    assert(file.startsWith(publicRoot + path.sep), `Recording asset escapes public/: ${url}`)
    return file
  }
  const manifest = JSON.parse(fs.readFileSync(localFile(pointer.manifest), 'utf8'))
  assert.equal(manifest.kind, 'accepted-subset-video-release')
  assert.equal(manifest.releasedCount, manifest.clips.length)
  assert.equal(new Set(manifest.clips.map(clip => clip.key)).size, manifest.clips.length)
  assert.equal(manifest.activeCount, manifest.releasedCount + manifest.skippedKeys.length)
  const files = new Map(manifest.files.map(file => [file.path, file]))
  assert.equal(files.size, manifest.files.length, 'Release assets must be unique')
  for (const [url, expected] of files) {
    const bytes = fs.readFileSync(localFile(url))
    assert.equal(bytes.length, expected.bytes, `${url}: release size changed`)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `${url}: release hash changed`)
  }
  const privateReference = /\/Users\/|\/var\/folders\/|output\/review\/|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i
  assert(!privateReference.test(JSON.stringify(manifest)), 'Public release metadata must not expose local review paths')
  // The two decks share a release, but may use different demonstrations.
  const publishedSlides = [...slides, ...readJson('data/mru/slides.json', [])]
  const records = new Map()
  for (const clip of manifest.clips) {
    const media = clip.media
    assert(files.has(media.src) && files.has(media.poster) && files.has(media.captions) && files.has(media.transcriptFile), `${clip.key}: incomplete playback assets`)
    assert.equal(files.get(media.src).sha256, media.sha256)
    assert(media.durationSeconds > 0 && media.prompt, `${clip.key}: missing recording context`)
    assert(media.result?.recipientVerified && media.result.ownerIndependent, `${clip.key}: result must work outside the author's session`)
    for (const result of [media.result, ...(media.result.supplemental || [])]) {
      assert(result.url && result.label, `${clip.key}: result link needs a destination and label`)
      if (/^https:/i.test(result.url)) {
        assert.equal(new URL(result.url).protocol, 'https:')
      } else {
        assert(files.has(result.url.replace(/^\.?\//, '')), `${clip.key}: result file missing from release`)
      }
    }
    const provenance = JSON.parse(fs.readFileSync(localFile(media.provenance), 'utf8'))
    assert(!privateReference.test(JSON.stringify(provenance)), `${clip.key}: public provenance exposes private paths`)
    if (clip.materialsPage) {
      assert(fs.existsSync(localFile(clip.materialsPage)), `${clip.key}: supplementary recording needs its materials page`)
    } else {
      assert(publishedSlides.some(slide => slide.media?.src === media.src || slide.commands?.some(command => command.result?.media.src === media.src)), `${clip.key}: recording missing from both decks`)
    }
    assert(!records.has(media.src), `${clip.key}: duplicate released video`)
    records.set(media.src, media)
  }
  return records
}

export function checkReleasedMedia(media, records) {
  const released = records.get(media?.src)
  if (!released) {
    assert(!media?.src?.includes('materials/video-refresh/'), 'Versioned video is missing from the current release manifest')
    return false
  }
  for (const field of ['src', 'poster', 'captions', 'transcriptFile', 'sha256', 'result']) {
    assert.deepEqual(media[field], released[field], `${media.src}: stale ${field}`)
  }
  return true
}

export function checkNativeVideoExport(media) {
  if (media?.recordingMode !== 'native-video-export') return false
  const provenance = readJson(`public/${media.provenance}`)
  assert.equal(provenance.kind, 'notebooklm-native-video-export')
  assert.equal(media.type, 'video')
  assert.equal(provenance.notebookUrl, media.source)
  assert(provenance.hasAudio && provenance.durationSeconds > 0, 'Native video must preserve its original audio and duration')
  assert.equal(media.durationSeconds, provenance.durationSeconds)
  assert.equal(media.sha256, provenance.files.src.sha256)
  const publicRoot = projectPath('public')
  for (const field of ['src', 'poster', 'captions', 'transcriptFile']) {
    const asset = provenance.files[field]
    assert.equal(media[field], asset.path, `Native video: stale ${field}`)
    const filename = path.resolve(publicRoot, asset.path)
    assert(filename.startsWith(publicRoot + path.sep), 'Native video asset escapes public/')
    const bytes = fs.readFileSync(filename)
    assert.equal(bytes.length, asset.bytes, `Native video: ${field} size changed`)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Native video: ${field} hash changed`)
  }
  return true
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const slides = readJson('data/generated/slides.json')
  const records = checkPublishedRecordings(slides)
  const nativeExports = slides.filter(slide => checkNativeVideoExport(slide.media)).length
  assert(records.size, 'No recording release is configured')
  console.log(`Verified ${records.size} published recordings and ${nativeExports} native video exports.`)
}
