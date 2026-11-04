import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'))
export const slides = read('data/slides.json')
export const sources = read('data/sources.json')
export const flows = read('data/flows.json')

export function checkData() {
  const opening = read('data/opening-slides.json')
  const workshop = read('data/workshop-slides.json')
  assert.deepEqual(slides.map(slide => slide.id), [...opening, ...workshop].map(slide => slide.id), 'Generated slides must match the authored sequence')
  assert.equal(new Set(slides.map(slide => slide.id)).size, slides.length, 'Slide IDs must be unique')
  const markdown = fs.readFileSync(path.join(root, 'slides.md'), 'utf8')
  assert(!markdown.includes('<!--'), 'The presentation must not contain presenter notes')
  assert.equal([...markdown.matchAll(/<DeckSlide id="([^"]+)"/g)].length, slides.length)
  for (const [index, slide] of slides.entries()) {
    assert.equal(slide.number, index + 1, `${slide.id}: incorrect slide number`)
    assert(!Object.hasOwn(slide, 'notes'), `${slide.id}: removed presenter notes must not return`)
    for (const id of slide.sources) assert(sources[id], `${slide.id}: missing source ${id}`)
  }
  assert.equal(flows.length, 1, 'Only one complete presentation path is supported')
  assert.equal(flows[0].id, 'all')
  assert.deepEqual(flows[0].slideIds, slides.map(slide => slide.id))
  const bookIndex = slides.findIndex(slide => slide.id === 'S53')
  assert(bookIndex >= 0, 'The assigned chapter must be present')
  assert.equal(slides[bookIndex + 1].id, 'S53GPT', 'The ChatGPT introduction must immediately follow the book')
  const commandSlides = slides.slice(bookIndex + 2, bookIndex + 10)
  assert(commandSlides.every(slide => slide.kind === 'prompt-commands'), 'Eight command tables must follow the ChatGPT introduction')
  const commands = commandSlides.flatMap(slide => slide.commands.map(row => row.command))
  assert.equal(commands.length, 79, 'Preserve all 79 prompt commands')
  assert.equal(new Set(commands).size, commands.length, 'Prompt commands must not be duplicated')
  const qr = read('public/images/qr/eduforum-github-pages.json')
  assert.equal(qr.decodedPayload, 'https://cremarco.github.io/EduForum/')
  assert.equal(slides.find(slide => slide.id === 'S50QR').links[0].url, qr.decodedPayload)
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S50QR') + 1]?.id, 'S50LEGEND')
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S51') - 1]?.id, 'S50LEGEND')
  console.log(`Content checks passed: ${slides.length} ordered slides, ${commands.length} unique commands, references and QR, no presenter notes.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkData()
