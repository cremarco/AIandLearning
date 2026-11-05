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
  assert.deepEqual(slides.slice(bookIndex + 2, bookIndex + 5).map(slide => slide.id), ['S53TYPES', 'S53FORMALWEB', 'S53FORMALAPP'], 'Explain formal commands and their platform scope before the informal catalogue')
  const formalWeb = slides.find(slide => slide.id === 'S53FORMALWEB')
  const formalDesktop = slides.find(slide => slide.id === 'S53FORMALAPP')
  assert.equal(formalWeb.commandCategory, 'formal-web')
  assert.equal(formalDesktop.commandCategory, 'formal-desktop')
  assert(formalWeb.commands.every(row => !row.command.startsWith('/')), 'Web menu action labels must not be turned into invented slash codes')
  assert(formalDesktop.commands.every(row => row.command.startsWith('/')), 'Desktop examples must retain their documented slash syntax')
  const formalRecord = read('public/materials/chatgpt-formal/provenance.json')
  for (const row of formalWeb.commands) {
    const recorded = formalRecord.actions.find(action => action.action === row.command)
    assert(recorded && row.result, `${row.command}: a formal result needs its original execution record`)
    assert.equal(row.result.media.src, `materials/chatgpt-formal/${recorded.capture}`)
    const status = recorded.status.startsWith('opened') ? 'opened' : recorded.status === 'executed' ? 'executed' : 'not-executed'
    assert.equal(row.result.status, status, `${row.command}: do not present an unopened or unexecuted action as executed`)
    if (row.result.text) assert.equal(row.result.text.replace(/\s+/g, ' ').trim(), recorded.result.replace(/\s+/g, ' ').trim(), `${row.command}: preserve the actual ChatGPT response`)
  }
  const commandSlides = slides.slice(bookIndex + 5, bookIndex + 13)
  assert(commandSlides.every(slide => slide.kind === 'prompt-commands' && slide.commandCategory === 'informal'), 'Eight informal shortcut tables must follow the formal command section')
  const commands = commandSlides.flatMap(slide => slide.commands.map(row => row.command))
  assert.equal(commands.length, 79, 'Preserve all 79 informal prompt shortcuts')
  assert.equal(new Set(commands).size, commands.length, 'Informal shortcuts must not be duplicated')
  const skillResearch = read('data/skills-research.json')
  const skillIds = slides.flatMap(slide => slide.skillIds || [])
  assert.equal(skillIds.length, 12, 'The researched skill catalogue must be available in the deck')
  assert.equal(new Set(skillIds).size, skillIds.length, 'Each selected skill must appear once in the catalogue')
  const guide = fs.readFileSync(path.join(root, 'public/materials/skills-guide.html'), 'utf8')
  for (const skill of skillResearch.skills) {
    assert(skillIds.includes(skill.id), `${skill.name}: researched skill is missing from the slides`)
    assert.equal(sources[skill.sourceId]?.url, skill.sourceUrl, `${skill.name}: cite its publisher’s reviewed instructions`)
    assert.equal(skill.reviewStatus, 'source-reviewed')
    assert.equal(skill.executionStatus, 'not-executed', `${skill.name}: examples must not be relabelled as real executions`)
    assert(skill.requirements && skill.license && skill.installCommand && skill.caveat, `${skill.name}: preserve requirements and limits`)
    assert(guide.includes(`id="${skill.id}"`), `${skill.name}: accessible guide entry missing`)
  }
  const qr = read('public/images/qr/eduforum-github-pages.json')
  assert.equal(qr.decodedPayload, 'https://cremarco.github.io/EduForum/')
  assert.equal(slides.find(slide => slide.id === 'S50QR').links[0].url, qr.decodedPayload)
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S50QR') + 1]?.id, 'S50LEGEND')
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S51') - 1]?.id, 'S50LEGEND')
  console.log(`Content checks passed: ${slides.length} ordered slides, formal web/desktop scope, ${commands.length} unique informal shortcuts, references and QR, no presenter notes.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkData()
