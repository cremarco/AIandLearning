import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { parseArgs } from 'node:util'
import { runLessonAudio } from './lesson-audio.mjs'
import { plainSpeakerNotes } from '../../utils/narration-text.mjs'

const root = new URL('../../', import.meta.url)
const directory = 'data/druskininkai/narration/'
const json = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const writeJson = (file, value) => writeFile(new URL(file, root), JSON.stringify(value, null, 2) + '\n')
const [slides, notes] = await Promise.all([
  json('data/druskininkai/slides-runtime.json'),
  json('data/druskininkai/speaker-notes.lt.json'),
])

// Keep Slidev's notes intact. The speech copy omits click markers, Markdown
// emphasis and Markdown line breaks, and follows CVeDI's neutral delivery.
const narration = Object.fromEntries(slides.filter(slide => slide.lang === 'lt').map(slide => {
  const source = notes[slide.sourceId]
  if (!source?.trim()) throw new Error(`${slide.id}: note lituane mancanti.`)
  const plain = plainSpeakerNotes(source)
  const spoken = plain.split(/\n\s*\n/).map(paragraph => paragraph.trim()).join('[pause]\n\n')
  return [slide.id.toLowerCase(), '[calm, matter-of-fact delivery]' + spoken]
}))

await writeJson(directory + 'speaker-notes.json', narration)
await writeJson(directory + 'lesson.json', {
  version: 1,
  lesson: 'druskininkai-lt',
  languageCode: 'lt',
  speakerNotesSource: directory + 'speaker-notes.json',
  originalSpeakerNotesSource: 'data/druskininkai/speaker-notes.lt.json',
  slides: slides.filter(slide => slide.lang === 'lt').map(slide => ({
    lessonSlide: slide.number,
    alias: slide.id.toLowerCase(),
    sourceId: slide.sourceId,
    title: slide.title,
  })),
})

await runLessonAudio({
  lessonSource: directory + 'lesson.json',
  settingsSource: directory + 'settings.json',
  directory: 'public/audio/druskininkai/',
})

// Reconnect matching recordings to their slides without making further API calls.
if (process.argv.includes('--generate') && !process.exitCode) {
  const { values } = parseArgs({ options: {
    slides: { type: 'string' }, generate: { type: 'boolean' },
    delivery: { type: 'string' }, regenerate: { type: 'boolean' },
  } })
  const history = await json('public/audio/druskininkai/manifest.json')
  for (const number of values.slides.split(',').map(Number)) {
    const alias = slides.find(slide => slide.number === number)?.id.toLowerCase()
    const clip = history.clips.findLast(clip => clip.alias === alias && clip.text === narration[alias])
    assert(clip, `Slide ${number}: current narration missing`)
    const bytes = await readFile(new URL(clip.file, root))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.audioSha256)
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries',
      'stream=codec_name,sample_rate,bit_rate:format=duration', '-of', 'json', clip.file], { cwd: fileURLToPath(root), encoding: 'utf8' })
    assert.equal(probe.status, 0, `Slide ${number}: invalid audio metadata`)
    const metadata = JSON.parse(probe.stdout), stream = metadata.streams[0]
    assert.equal(stream.codec_name, 'mp3')
    assert.equal(Number(stream.sample_rate), 44100)
    assert.equal(Number(stream.bit_rate), 128000)
    const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', clip.file, '-f', 'null', '-'], { cwd: fileURLToPath(root), encoding: 'utf8' })
    assert.equal(decode.status, 0, `Slide ${number}: incomplete MP3`)
    assert.equal(decode.stderr.trim(), '')
    clip.durationSeconds = Number(metadata.format.duration)
  }
  await writeJson('public/audio/druskininkai/manifest.json', history)
  const result = spawnSync(process.execPath, ['scripts/content/generate-slides.mjs', 'druskininkai'], {
    cwd: fileURLToPath(root), stdio: 'inherit',
  })
  if (result.status !== 0) process.exitCode = result.status || 1
  else {
    const captions = spawnSync(process.execPath, ['scripts/audio/druskininkai-captions.mjs', '--slides', values.slides], {
      cwd: fileURLToPath(root), stdio: 'inherit',
    })
    if (captions.status !== 0) process.exitCode = captions.status || 1
  }
}
