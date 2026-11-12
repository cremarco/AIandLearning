import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { projectPath, readJson } from '../lib/project.mjs'
import { plainSpeakerNotes } from '../../utils/narration-text.mjs'
import { buildNarrationReveals } from '../../utils/narration-reveals.mjs'
import { readLessonCaptions } from '../audio/caption-files.mjs'

const slides = readJson('data/druskininkai/slides.json')
const original = readJson('data/generated/slides-runtime.json')
const notes = readJson('data/druskininkai/speaker-notes.json')
const lithuanianNotes = readJson('data/druskininkai/speaker-notes.lt.json')
const highlights = readJson('data/druskininkai/highlights.json')
const runtime = readJson('data/druskininkai/slides-runtime.json')
const bilingualHighlights = readJson('data/druskininkai/highlights-runtime.json')
// Unambiguous names stay verbatim; generic words such as quiz and flashcards are localized.
const protectedNames = readJson('data/druskininkai/protected-names.json').map(name => [
  name, new RegExp(`(?<![\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u'),
])
function assertNamesPreserved(english, lithuanian, path) {
  if (typeof english === 'string' && typeof lithuanian === 'string') {
    for (const [name, pattern] of protectedNames) {
      if (pattern.test(english)) assert(pattern.test(lithuanian), `${path}: retain the original name ${name}`)
    }
  } else if (Array.isArray(english)) {
    english.forEach((value, index) => assertNamesPreserved(value, lithuanian?.[index], `${path}[${index}]`))
  } else if (english && typeof english === 'object') {
    for (const [key, value] of Object.entries(english)) assertNamesPreserved(value, lithuanian?.[key], `${path}.${key}`)
  }
}
const removed = new Set(["S53SKILLSSECTION", "S53SKILLS", "S53SKILLHOSTS", "S53SKILLSTUDY", "S53SKILLLEARN", "S53SKILLLEARNING", "S53SKILLMERMAID", 'S53RISKS', 'S53FORMALWEB', 'S52FEELINGS', 'S52ROUTE', 'S44', 'S48', 'S53TRYSHORTCUTS', 'S53TRYSKILLS', 'S67TRYNOTEBOOK', 'S102TRANSFER',
  'S58TOOLGOBLIN', 'S58OVERVIEW', 'S58COMPILER', 'S58', 'S58ESTIMATOR', 'S58TASKMASTER', 'S58PROFESSOR', 'S58FORMALIZER', 'S52DESIGN', 'S67REPORTS'])
assert.deepEqual(slides.map(s => s.id), original.filter(s => !removed.has(s.id)).map(s => s.id), 'Keep the EduForum sequence apart from the requested removals')
assert.equal(slides.length, 59)
assert.equal(slides.findIndex(s => s.kind === 'thanks') + 1, 58)
assert(slides.every((s, i) => s.number === i + 1 && !s.hide && !s.activityTimer && s.kind !== 'activity'))
assert(!/goblin/i.test(JSON.stringify(slides)), 'Remove Goblin slides and resource rows')
assert(!/\b(?:formal|informal)\b/i.test(JSON.stringify(slides)), 'Use generic shortcuts without a formal/informal distinction')
assert(!/\b(?:formal|informal)\b/i.test(JSON.stringify(notes)))
assert.equal(slides.find(s => s.id === 'S53SHORTCUTS').title, 'Shortcuts')
assert.equal(slides.find(s => s.id === 'S53TYPES').title, 'How shortcuts work')
assert(slides.every(s => !s.id.includes('SKILL') && !s.skillIds?.length), 'Remove the Agent Skills section and demonstrations')
const cover = slides[0]
assert.equal(cover.title, 'Beyond prompting')
assert.equal(cover.coverDate, '13 November 2026')
assert.equal(cover.coverLocation, 'Druskininkai, Lithuania')
assert.equal(cover.coverLogos, false)
assert(!cover.coverNotice && !cover.coverEventLogo && !cover.coverOrganisationLogo)
const event = slides.find(s => s.id === 'S50')
assert(event && !event.hide && event.message.includes('13 November 2026') && event.message.includes('Druskininkai'))
assert.deepEqual(Object.keys(notes).sort(), slides.map(s => s.id).sort())
assert.deepEqual(Object.keys(lithuanianNotes).sort(), Object.keys(notes).sort())
for (const [id, english] of Object.entries(notes)) {
  const translated = lithuanianNotes[id]
  assert(translated && translated !== english && /[ąčęėįšųūž]/i.test(translated), `${id}: supply Lithuanian speaker notes`)
  assert.equal((translated.match(/\[click\]/g) || []).length, slides.find(slide => slide.id === id).clicks || 0, `${id}: mark each Lithuanian animation in the narration`)
  assert.equal((translated.match(/\*\*/g) || []).length, (english.match(/\*\*/g) || []).length, `${id}: retain emphasis`)
  assert(!/<!--|-->/.test(translated), `${id}: avoid nested note comments`)
  assertNamesPreserved(english, translated, `${id} notes`)
}
assert(Object.keys(highlights).every(id => slides.some(s => s.id === id)))
const markdown = fs.readFileSync(projectPath('druskininkai.md'), 'utf8')
const rendered = [...markdown.matchAll(/<DeckSlide id="([^"]+)" \/>\s*<!--\n([\s\S]*?)\n-->/g)]
assert.deepEqual(rendered.map(([, id, text]) => [id, text]), runtime.map(s => [s.id, (s.lang === 'lt' ? lithuanianNotes : notes)[s.sourceId]]), 'Presenter notes must match each slide language')
assert.equal(runtime.length, 118)
assert.equal(runtime.findLastIndex(s => s.kind === 'thanks') + 1, 116)
assert.equal(new Set(runtime.map(s => s.id)).size, runtime.length)
assert.deepEqual(Object.keys(bilingualHighlights).sort(), runtime.map(s => s.id).sort())
for (const [i, source] of slides.entries()) {
  const [english, lithuanian] = runtime.slice(i * 2, i * 2 + 2)
  assert.equal(english.id, source.id)
  assert.equal(lithuanian.id, `${source.id}LT`)
  assert.equal(english.sourceId, source.id)
  assert.equal(lithuanian.sourceId, source.id)
  assert.equal(english.lang, 'en')
  assert.equal(lithuanian.lang, 'lt')
  assert.equal(english.number, i * 2 + 1)
  assert.equal(lithuanian.number, i * 2 + 2)
  const { sourceId, lang, number, ...englishContent } = english
  const { number: originalNumber, lang: originalLanguage, ...originalContent } = source
  assert.deepEqual(englishContent, originalContent, `${source.id}: English content must remain intact`)
  assert.equal(lithuanian.kind, source.kind)
  assertNamesPreserved(english, lithuanian, source.id)
  assert.deepEqual(lithuanian.sources, source.sources)
  if (source.prompt) assert.equal(lithuanian.prompt, source.prompt, 'Keep recorded prompts verbatim')
  if (source.media) for (const key of ['src', 'poster', 'captions', 'transcriptFile', 'sha256', 'prompt', 'provenance']) {
    assert.equal(lithuanian.media[key], source.media[key], `${source.id}: preserve recording ${key}`)
  }
  if (source.commands) assert.deepEqual(lithuanian.commands.map(c => c.command), source.commands.map(c => c.command))
  if (source.references) assert.deepEqual(lithuanian.references.map(r => [r.url, r.citation]), source.references.map(r => [r.url, r.citation]))
}
assert.equal(runtime[1].title, 'Beyond prompting')
assert.equal(runtime[1].coverLocation, 'Druskininkai, Lithuania')
assert.equal(runtime.find(s => s.id === 'S53SHORTCUTSLT').title, 'Užklausų trumpiniai')
assert.equal(runtime.at(-1).title, 'Literatūra')
const audioHistory = readJson('public/audio/druskininkai/manifest.json')
const { manifest: captionManifest, files: captionFiles } = await readLessonCaptions('druskininkai-lt')
assert.deepEqual(Object.keys(captionManifest.clips), runtime.filter(slide => slide.narrationAudio).map(slide => slide.id.toLowerCase()), 'Every narrated slide must have matching captions')
for (const [name, bytes] of captionFiles) assert.deepEqual(fs.readFileSync(projectPath('public/captions/druskininkai', name)), bytes, 'Publish the verified captions and word timings')
for (const slide of runtime.filter(slide => slide.narrationAudio)) {
  const { src, lang } = slide.narrationAudio
  assert.equal(lang, 'lt')
  assert.equal(slide.lang, lang, 'Narration belongs only to its language copy')
  const receipt = audioHistory.clips.findLast(clip => clip.file === `public/${src}`)
  assert.equal(receipt?.alias, slide.id.toLowerCase())
  assert.equal(receipt.settings.languageCode, lang)
  assert.equal(receipt.plainText, plainSpeakerNotes(lithuanianNotes[slide.sourceId]), 'Narration must match the current notes')
  const captions = captionManifest.clips[receipt.alias]
  assert.equal(slide.narrationAudio.captions, captions.web)
  assert.equal(captions.audioSha256, receipt.audioSha256)
  assert.equal(captions.textSha256, receipt.plainTextSha256)
  if (slide.clicks) {
    const alignment = readJson(captions.wordsSource)
    assert.deepEqual(slide.narrationAudio.reveals, buildNarrationReveals(lithuanianNotes[slide.sourceId], alignment.words, slide.clicks))
  } else assert(!slide.narrationAudio.reveals)
  const bytes = fs.readFileSync(projectPath('public', src))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.audioSha256)
}
const narratedIntroductionEnd = runtime.findIndex(slide => slide.id === 'S53DETAILFLASHCARDLT')
assert(narratedIntroductionEnd >= 0, 'Keep an explicit endpoint for the narrated introduction')
for (const slide of runtime.slice(0, narratedIntroductionEnd + 1).filter(slide => slide.lang === 'lt')) {
  assert(slide.narrationAudio?.captions, `${slide.id}: every Lithuanian introduction slide needs narration and captions`)
}
assert(!markdown.includes('hide: true'))
const qr = readJson('public/images/qr/druskininkai-direct.json')
assert.equal(qr.decodedPayload, 'https://cremarco.github.io/AIandLearning/druskininkai/')
assert.equal(slides.find(s => s.id === 'S50QR').links[0].url, qr.decodedPayload)
for (const slide of slides) {
  if (slide.media) assert(fs.existsSync(projectPath('public', slide.media.src)))
}
// The original deck must retain its separate event, exercises and cover.
assert.equal(original.length, 86)
assert(original.find(s => s.id === 'S48')?.message.includes('11 November 2026'))
assert(original.find(s => s.id === 'S50')?.hide)
assert(original.some(s => s.tool === 'goblin') && original.some(s => s.activityTimer))
assert(original[0].title.startsWith('From Curiosity') && original[0].coverEventLogo && original[0].coverNotice)
console.log('Druskininkai checks passed: 59 English/Lithuanian pairs, preserved media and prompts, independent notes and QR; EduForum retained.')
