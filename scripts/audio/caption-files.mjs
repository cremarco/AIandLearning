import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildCaptionWordTrack } from '../../utils/caption-words.mjs'

const root = new URL('../../', import.meta.url)
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const hash = value => createHash('sha256').update(value).digest('hex')
const compact = value => value.replace(/\s+/gu, '')
export const captionLessons = [{ lesson: 'druskininkai-lt', source: 'data/druskininkai/narration', directory: 'druskininkai' }]
export const lessonCaptionManifest = lesson => {
  const specification = captionLessons.find(item => item.lesson === lesson)
  assert.ok(specification, 'supported narration lesson')
  return `data/druskininkai/narration/captions/manifest.json`
}

/** Validate the pinned audio, exact script, word alignment and deployable VTT together. */
export async function readLessonCaptions(lesson) {
  const specification = captionLessons.find(item => item.lesson === lesson)
  const manifest = await json(lessonCaptionManifest(lesson))
  const prefix = `data/druskininkai/narration/captions/`
  const webPrefix = `/captions/${specification.directory}/`
  assert.equal(manifest.version, 1)
  assert.equal(manifest.languageCode, 'lt')
  assert.equal(manifest.lesson, lesson)
  assert.equal(manifest.audioSelectionSource, specification.source + '/audio-approved.json')
  assert.equal(manifest.textSource, specification.source + '/speaker-notes-original.json')
  const selection = await json(manifest.audioSelectionSource)
  const notes = await json(manifest.textSource)
  assert.deepEqual(Object.keys(manifest.clips), Object.keys(selection.clips), 'every selected audio has captions in lesson order')
  const files = new Map()
  for (const [alias, clip] of Object.entries(manifest.clips)) {
    const audio = selection.clips[alias]
    const filename = audio.source.split('/').at(-1).replace(/\.mp3$/, '.vtt')
    assert.equal(clip.source, prefix + filename)
    assert.equal(clip.web, webPrefix + filename)
    assert.equal(clip.wordsSource, clip.source.replace(/\.vtt$/, '.words.json'))
    assert.equal(clip.audioSha256, audio.sha256, alias + ': captions belong to the approved audio')
    assert.equal(clip.durationSeconds, audio.durationSeconds)
    assert.equal(clip.textSha256, hash(notes[alias]), alias + ': captions belong to the current script')
    const bytes = await readFile(new URL(clip.source, root))
    const alignmentBytes = await readFile(new URL(clip.wordsSource, root))
    assert.equal(hash(bytes), clip.sha256)
    assert.equal(hash(alignmentBytes), clip.wordsSha256)
    const { words, cues } = JSON.parse(alignmentBytes)
    assert.equal(clip.cueCount, cues.length)
    assert.equal(clip.wordCount, words.length)
    assert.ok(cues.length > 0 && words.length > 0)
    const instant = words.filter(word => word.start >= word.end).length
    assert.equal(clip.zeroDurationWords, instant)
    assert.ok(instant / words.length <= .08, alias + ': word alignment meets the generation quality threshold')
    assert.equal(compact(words.map(word => word.word).join('')), compact(notes[alias]))
    assert.equal(compact(cues.map(cue => cue.text).join('')), compact(notes[alias]), alias + ': the whole approved script is retained')
    let previousEnd = 0
    for (const word of words) {
      assert.ok(Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= previousEnd - .001
        && word.end >= word.start && word.end <= audio.durationSeconds, alias + ': valid word timing')
      previousEnd = word.end
    }
    previousEnd = 0
    const blocks = bytes.toString('utf8').trim().split(/\n\n/)
    assert.equal(blocks.shift(), 'WEBVTT')
    assert.equal(blocks.length, cues.length)
    const seconds = stamp => stamp.split(':').reduce((total, number) => total * 60 + Number(number), 0)
    for (const [index, cue] of cues.entries()) {
      assert.ok(cue.start >= previousEnd && cue.end > cue.start && cue.end <= audio.durationSeconds, alias + ': non-overlapping cues')
      assert.ok(cue.text.split('\n').length <= 2 && cue.text.split('\n').every(line => line.length <= 42), alias + ': two short lines at most')
      previousEnd = cue.end
      const [id, timing, ...lines] = blocks[index].split('\n')
      assert.equal(id, String(index + 1))
      assert.match(timing, /^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}$/)
      const [start, end] = timing.split(' --> ').map(seconds)
      assert.ok(Math.abs(start - cue.start) < .001 && Math.abs(end - cue.end) < .001)
      assert.equal(lines.join('\n'), cue.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'))
    }
    files.set(filename, bytes)
    // A compact browser companion reuses the original word alignment without inference.
    files.set(filename.replace(/\.vtt$/, '.words.json'), Buffer.from(JSON.stringify(buildCaptionWordTrack({ words, cues })) + '\n'))
  }
  return { manifest, files }
}
