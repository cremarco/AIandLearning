import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectPath, readJson } from '../lib/project.mjs'

const slides = readJson('data/druskininkai/slides.json')
const original = readJson('data/generated/slides-runtime.json')
const notes = readJson('data/druskininkai/speaker-notes.json')
const highlights = readJson('data/druskininkai/highlights.json')
const removed = new Set(["S53SKILLSSECTION", "S53SKILLS", "S53SKILLHOSTS", "S53SKILLSTUDY", "S53SKILLLEARN", "S53SKILLLEARNING", "S53SKILLMERMAID", 'S53RISKS', 'S53FORMALWEB', 'S52FEELINGS', 'S52ROUTE', 'S44', 'S48', 'S53TRYSHORTCUTS', 'S53TRYSKILLS', 'S67TRYNOTEBOOK', 'S102TRANSFER',
  'S58TOOLGOBLIN', 'S58OVERVIEW', 'S58COMPILER', 'S58', 'S58ESTIMATOR', 'S58TASKMASTER', 'S58PROFESSOR', 'S58FORMALIZER'])
assert.deepEqual(slides.map(s => s.id), original.filter(s => !removed.has(s.id)).map(s => s.id), 'Keep the EduForum sequence apart from the requested removals')
assert.equal(slides.length, 61)
assert.equal(slides.findIndex(s => s.kind === 'thanks') + 1, 60)
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
assert(Object.keys(highlights).every(id => slides.some(s => s.id === id)))
const markdown = fs.readFileSync(projectPath('druskininkai.md'), 'utf8')
const rendered = [...markdown.matchAll(/<DeckSlide id="([^"]+)" \/>\s*<!--\n([\s\S]*?)\n-->/g)]
assert.deepEqual(rendered.map(([, id, text]) => [id, text]), slides.map(s => [s.id, notes[s.id]]), 'Keep independent presenter notes attached to the right slides')
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
console.log('Druskininkai checks passed: 61 slides, 13 November event, independent notes and QR, no logos, Goblin or exercises; EduForum retained.')
