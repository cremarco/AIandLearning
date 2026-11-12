import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { plainSpeakerNotes } from '../../utils/narration-text.mjs'
import { readLessonCaptions } from './caption-files.mjs'

const root = new URL('../../', import.meta.url)
const directory = 'data/druskininkai/narration/'
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const writeJson = (path, value) => writeFile(new URL(path, root), JSON.stringify(value, null, 2) + '\n')
const hash = value => createHash('sha256').update(value).digest('hex')
const [slides, history, original] = await Promise.all([
  json('data/druskininkai/slides-runtime.json'), json('public/audio/druskininkai/manifest.json'),
  json('data/druskininkai/speaker-notes.lt.json'),
])
const clips = {}, notes = {}
for (const slide of slides.filter(slide => slide.narrationAudio)) {
  const alias = slide.id.toLowerCase()
  const text = plainSpeakerNotes(original[slide.sourceId])
  const clip = history.clips.findLast(clip => clip.file === `public/${slide.narrationAudio.src}`)
  assert.equal(clip?.plainText, text, `${alias}: current notes and recording must match`)
  assert.equal(clip.settings.languageCode, 'lt')
  assert.equal(hash(await readFile(new URL(clip.file, root))), clip.audioSha256)
  assert(clip.durationSeconds > 0, `${alias}: verified audio duration required`)
  clips[alias] = { source: clip.file, sha256: clip.audioSha256, durationSeconds: clip.durationSeconds }
  notes[alias] = text
}
assert(Object.keys(clips).length, 'No matching Lithuanian recordings')
await writeJson(directory + 'audio-approved.json', { version: 1, lesson: 'druskininkai-lt', clips })
await writeJson(directory + 'speaker-notes-original.json', notes)

const python = process.env.CAPTION_PYTHON || fileURLToPath(new URL('.venv-captions/bin/python', root))
assert(existsSync(python), 'Prepare the local caption environment described in README.md or set CAPTION_PYTHON')
const alignment = spawnSync(python, ['scripts/audio/druskininkai-captions.py', '--lesson', 'druskininkai-lt', ...process.argv.slice(2)], {
  cwd: fileURLToPath(root), stdio: 'inherit',
})
if (alignment.status !== 0) process.exit(alignment.status || 1)
const { files } = await readLessonCaptions('druskininkai-lt')
await mkdir(new URL('public/captions/druskininkai/', root), { recursive: true })
for (const [name, bytes] of files) await writeFile(new URL(`public/captions/druskininkai/${name}`, root), bytes)
const generated = spawnSync(process.execPath, ['scripts/content/generate-slides.mjs', 'druskininkai'], {
  cwd: fileURLToPath(root), stdio: 'inherit',
})
if (generated.status !== 0) process.exit(generated.status || 1)
console.log(`Prepared ${files.size / 2} Lithuanian caption tracks with synchronized word highlighting.`)
