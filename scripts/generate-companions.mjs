import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { parse } = require('vue/compiler-sfc')
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const slides = JSON.parse(read('data/slides.json'))
const flows = JSON.parse(read('data/flows.json'))
const sources = JSON.parse(read('data/sources.json'))
const renderer = read('components/DeckSlide.vue')
const { descriptor, errors } = parse(renderer)
assert.equal(errors.length, 0, 'DeckSlide.vue must parse')
const ast = descriptor.template.ast
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const textKeys = ['title', 'message', 'body', 'guardrails', 'context', 'results', 'result_note', 'finding', 'limit', 'prompt', 'response', 'supplied', 'quote', 'takeaway', 'output']
const knownKeys = new Set([...textKeys, 'id', 'number', 'type', 'kind', 'section', 'notes', 'sources', 'duration', 'cards'])

assert.equal(slides.length, 43, 'Expected all 43 slides')
assert.equal(new Set(slides.map(s => s.id)).size, 43, 'Duplicate slide IDs')
slides.forEach((s, index) => {
  assert.equal(s.id, `S${String(index + 1).padStart(2, '0')}`)
  assert.equal(s.number, index + 1)
  for (const key of Object.keys(s)) assert.ok(knownKeys.has(key), `Unmapped slide field: ${key}`)
  for (const id of s.sources) assert.ok(sources[id], `${s.id}: unresolved source ${id}`)
  for (const card of s.cards || []) {
    for (const key of Object.keys(card))
      assert.ok(['title', 'body', 'label', 'value', 'image', 'span', 'tone'].includes(key), `Unmapped card field: ${key}`)
  }
})
const byId = new Map(slides.map(s => [s.id, s]))
const seconds = value => Math.round(value * 60)
const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const schedules = new Map()
for (const flow of flows) {
  assert.equal(new Set(flow.slideIds).size, flow.slideIds.length, `${flow.id}: repeated slide`)
  let elapsed = 0
  const schedule = flow.slideIds.map((id, index) => {
    const slide = byId.get(id)
    assert.ok(slide, `${flow.id}: unknown slide ${id}`)
    const minutes = slide.duration[flow.id]
    assert.ok(Number.isFinite(minutes) && minutes >= 0, `${id}: invalid duration`)
    const entry = { id, index: index + 1, minutes, start: elapsed, end: elapsed + seconds(minutes) }
    elapsed = entry.end
    return entry
  })
  assert.equal(elapsed, seconds(flow.minutes), `${flow.id}: timeboxes must match the route total`)
  schedules.set(flow.id, schedule)
}

function walk(node, visit) {
  visit(node)
  for (const child of node.children || []) walk(child, visit)
}
function directive(node, name) {
  return node.props?.find(p => p.type === 7 && p.name === name)
}
function attr(node, name) {
  return node.props?.find(p => p.type === 6 && p.name === name)?.value?.content || ''
}
function bound(node, name) {
  return node.props?.find(p => p.type === 7 && p.name === 'bind' && p.arg?.content === name)?.exp?.content || ''
}
function findCondition(expression) {
  let found
  walk(ast, node => {
    if (!found && ['if', 'else-if'].some(name => directive(node, name)?.exp?.content === expression)) found = node
  })
  assert.ok(found, `Renderer branch changed: ${expression}`)
  return found
}
function resolve(expression, slide) {
  const match = expression?.match(/^s\.(\w+)(?:\[(\d+)\])?$/)
  if (!match) return ''
  const value = slide[match[1]]
  return match[2] === undefined ? (typeof value === 'string' ? value : '') : value?.[Number(match[2])] || ''
}
function nodeText(node, slide) {
  if (node.type === 2) return node.content
  if (node.type === 5) return resolve(node.content.content, slide)
  if (node.tag === 'br') return ' '
  return (node.children || []).map(child => nodeText(child, slide)).join('')
}
function literalBlocks(node, slide) {
  const blocks = []
  function visit(element) {
    if (element.type !== 1) {
      for (const child of element.children || []) visit(child)
      return
    }
    if (element.tag === 'BentoCard') {
      const parts = ['label', 'value', 'title', 'body'].map(key => attr(element, key) || resolve(bound(element, key), slide)).filter(Boolean)
      if (parts.length) blocks.push(parts.map(normalize).join(' — '))
      return
    }
    if (['p', 'h1', 'h2', 'blockquote', 'a', 'button'].includes(element.tag)) {
      const text = normalize(nodeText(element, slide))
      let target = attr(element, 'href')
      const file = bound(element, 'href').match(/^file\('([^']+)'\)$/)
      if (file) target = `${file[1]} (same materials folder)`
      const go = directive(element, 'on')?.exp?.content?.match(/flow\.go\((\d+)\)/)
      if (go) target = `S${String(go[1]).padStart(2, '0')}`
      if (text) blocks.push(`${text}${target ? `: ${target}` : ''}`)
      return
    }
    for (const child of element.children || []) visit(child)
  }
  visit(node)
  return [...new Set(blocks)]
}

const specialTypes = new Set(['cover', 'profile', 'agenda', 'case', 'summary', 'discussion', 'evidence_card'])
const chapterScript = renderer.match(/const chapters = \[([\s\S]*?)\n\]/)?.[1]
const datasetScript = renderer.match(/const dataset = \[([\s\S]*?)\n\]/)?.[1]
assert.ok(chapterScript && datasetScript, 'Renderer chapter/card navigation changed')
const chapters = [...chapterScript.matchAll(/title: '([^']+)'/g)].map(match => match[1])
const dataset = [...datasetScript.matchAll(/number: (\d+), title: '([^']+)', label: '([^']+)'/g)].map(match => ({ id: `S${match[1]}`, title: match[2], label: match[3] }))
assert.equal(chapters.length, 4)
assert.equal(dataset.length, 3)
const evidenceTitles = ['Design', 'Participants and task', 'Finding', 'Limit']
assert.ok(renderer.includes("['Design','Participants and task','Finding','Limit']"), 'Evidence card labels changed')

function extras(slide) {
  let result = []
  if (specialTypes.has(slide.type)) result.push(...literalBlocks(findCondition(`s.type === '${slide.type}'`), slide))
  if (slide.id === 'S03') result.push(...chapters.map((title, i) => `${i + 1}. ${title}`))
  if (slide.id === 'S18') {
    const map = findCondition("s.id === 'S18'")
    assert.ok(attr(map, 'aria-label'), 'The map must retain its linear description')
    result.push(attr(map, 'aria-label'))
  }
  if (slide.id === 'S26') result.push(...literalBlocks(findCondition("s.id === 'S26'"), slide))
  if (slide.id === 'S30') result.push(...literalBlocks(findCondition("s.id === 'S30'"), slide))
  if (slide.id === 'S33') {
    result.push(...dataset.map(card => `${card.title} — ${card.label}; see ${card.id}`))
    result.push(...literalBlocks(findCondition("s.id === 'S33'"), slide).filter(line => !line.startsWith('↗')))
  }
  return [...new Set(result.filter(Boolean))]
}

function routeOverview(language) {
  const it = language === 'it'
  const lines = [it ? 'ORDINE E TEMPI DEI TRE PERCORSI' : 'ORDER AND TIMING OF THE THREE ROUTES', '']
  for (const flow of flows) {
    lines.push(`${flow.name} — ${flow.minutes} ${it ? 'minuti' : 'minutes'}`, `${flow.event}`, `${it ? 'Focus' : 'Focus'}: ${flow.focus}`)
    for (const entry of schedules.get(flow.id)) {
      lines.push(`${entry.index}. ${entry.id} — ${byId.get(entry.id).title}`)
      lines.push(`   ${clock(entry.start)} ${it ? 'a' : 'to'} ${clock(entry.end)}; ${entry.minutes} min`)
    }
    lines.push('')
  }
  const scheduled = new Set(flows.flatMap(flow => flow.slideIds))
  const extras = slides.filter(slide => !scheduled.has(slide.id)).map(slide => slide.id)
  lines.push(`${it ? 'Riferimenti fuori dalla sequenza programmata' : 'References outside the scheduled sequences'}: ${extras.join(', ')}.`, '')
  return lines
}
function timing(slide, language) {
  return flows.map(flow => {
    const entry = schedules.get(flow.id).find(entry => entry.id === slide.id)
    return entry
      ? `${flow.name}: ${entry.minutes} min; ${clock(entry.start)}–${clock(entry.end)}; ${language === 'it' ? 'posizione' : 'position'} ${entry.index}/${flow.slideIds.length}`
      : `${flow.name}: ${language === 'it' ? 'fuori dalla sequenza programmata' : 'outside the scheduled sequence'} (${slide.duration[flow.id]} min)`
  })
}
function sourceLines(ids) {
  return ids.flatMap(id => {
    const source = sources[id]
    const lines = [`[${id}] ${source.label || source.title}`, source.citation || source.title]
    if (source.citation && source.citation !== source.title) lines.push(source.title)
    if (source.url) lines.push(source.url)
    const doiURL = source.doi ? `https://doi.org/${source.doi}` : ''
    if (doiURL && doiURL !== source.url) lines.push(doiURL)
    return [...new Set(lines)]
  })
}
function content(slide) {
  const lines = []
  const field = (label, value) => { if (value) lines.push(`${label}: ${value}`, '') }
  field('Message', slide.message)
  if (slide.body.length) {
    lines.push(slide.type === 'evidence_card' ? 'Evidence card:' : 'Content / steps (linear reading order):')
    slide.body.forEach((line, index) => lines.push(`${slide.type === 'evidence_card' ? `${evidenceTitles[index]}:` : `${index + 1}.`} ${line}`))
    lines.push('')
  }
  if (slide.cards?.length) {
    lines.push('Custom cards (linear reading order):')
    slide.cards.forEach((card, index) => {
      lines.push(`Card ${index + 1}`)
      for (const key of ['label', 'value', 'title', 'body']) if (card[key]) lines.push(`${key}: ${card[key]}`)
    })
    lines.push('')
  }
  field('Study / context', slide.context)
  if (slide.results?.length) {
    lines.push('Observed in this study:')
    slide.results.forEach(result => lines.push(`${result.value} — ${result.label}`))
    lines.push('')
  }
  for (const [key, label] of [['result_note', 'Result note'], ['finding', 'Finding'], ['limit', 'Limit'], ['supplied', 'Supplied study'], ['prompt', 'Prompt'], ['response', 'Illustrative response — prepared example, not a live result'], ['quote', 'Prepared workshop quotation / example'], ['output', 'Your output'], ['takeaway', 'Takeaway']]) field(label, slide[key])
  if (slide.guardrails.length) lines.push('Additional limits / guardrails from the deck data:', ...slide.guardrails.map(line => `- ${line}`), '')
  const additional = extras(slide)
  if (additional.length) lines.push('Additional displayed content / linear descriptions / links:', ...additional.map(line => `- ${line}`), '')
  return lines
}

const en = [
  'BEYOND PROMPTING — ACCESSIBLE DECK TEXT',
  'Visual tools for self-directed learning with artificial intelligence',
  '',
  'Generated from data/slides.json, data/flows.json, data/sources.json and the DeckSlide.vue renderer.',
  'The 43 slide sections below preserve the English data, custom cards, results, limits, prompts and prepared examples. Renderer-only content and diagram descriptions are included in linear order. Decorative background images are omitted.',
  'Route timeboxes are expressed as elapsed minutes:seconds. The optional reference cards remain available outside the scheduled routes.',
  'Original Italian presenter notes and complete original-language source metadata are preserved in Presenter_Notes_IT.txt in the same materials folder.',
  '',
  ...routeOverview('en'),
  'ALL 43 SLIDES — NUMERICAL REFERENCE ORDER',
  '',
]
const it = [
  'BEYOND PROMPTING — NOTE DEL RELATORE',
  '',
  'Generato da data/slides.json, data/flows.json, data/sources.json e dal renderer DeckSlide.vue.',
  'Le note seguenti riproducono il campo notes senza riscriverlo. Il testo inglese completo delle slide, comprese card personalizzate, risultati e limiti, è in Accessible_Deck_EN.txt nella stessa cartella.',
  'I timebox derivano dai dati correnti; le schede di riferimento non aggiungono tempo alle sequenze. I tempi trascorsi sono espressi in minuti:secondi.',
  '',
  ...routeOverview('it'),
  'NOTE PER TUTTE LE 43 SLIDE — ORDINE NUMERICO DI RIFERIMENTO',
  '',
]
for (const slide of slides) {
  en.push(`SLIDE ${slide.id} — ${slide.title}`, ...timing(slide, 'en'), '', ...content(slide), 'Sources:', ...sourceLines(slide.sources), '', '')
  it.push(`SLIDE ${slide.id} — ${slide.title}`, ...timing(slide, 'it'), '', 'NOTA DEL RELATORE:', slide.notes, '')
  for (const [key, label] of [['supplied', 'Fonte fornita nella demo (testo EN)'], ['prompt', 'Prompt esatto (EN)'], ['response', 'Risposta illustrativa preparata (EN)'], ['quote', 'Esempio preparato (EN)'], ['output', 'Prodotto richiesto (EN)']]) {
    if (slide[key]) it.push(`${label}: ${slide[key]}`, '')
  }
  it.push('FONTI:', ...sourceLines(slide.sources), '', '')
}
en.push('COMPLETE SOURCE INDEX', '')
it.push('REGISTRO COMPLETO DELLE FONTI — METADATI ORIGINALI', '')
for (const [id, source] of Object.entries(sources)) {
  en.push(...sourceLines([id]), '')
  it.push(`[${id}] ${source.title}`)
  const labels = { label: 'Etichetta', citation: 'Citazione', doi: 'DOI', url: 'URL', license: 'Licenza', claim_locator: 'Passaggio', limitations: 'Limiti', publication_status: 'Stato editoriale' }
  for (const [key, label] of Object.entries(labels)) if (source[key]) it.push(`${label}: ${source[key]}`)
  it.push('')
}
const english = `${en.join('\n').trim()}\n`
const italian = `${it.join('\n').trim()}\n`

// Validate actual strings, not only the count of headings. Layout-only image,
// tone and span fields are deliberately excluded from the textual equivalent.
function strings(value) {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}
const enNormalized = normalize(english)
const itNormalized = normalize(italian)
let checkedStrings = 0
for (const slide of slides) {
  const expected = textKeys.flatMap(key => strings(slide[key]))
  expected.push(...(slide.cards || []).flatMap(card => ['label', 'value', 'title', 'body'].flatMap(key => strings(card[key]))))
  expected.push(...extras(slide))
  for (const value of expected) {
    assert.ok(enNormalized.includes(normalize(value)), `${slide.id}: missing English content: ${value}`)
    checkedStrings++
  }
  assert.ok(itNormalized.includes(normalize(slide.notes)), `${slide.id}: missing presenter note`)
}
for (const [id, source] of Object.entries(sources)) for (const value of strings(source)) assert.ok(itNormalized.includes(normalize(value)), `${id}: missing source metadata`)
assert.equal((english.match(/^SLIDE S\d{2} —/gm) || []).length, 43)
assert.equal((italian.match(/^SLIDE S\d{2} —/gm) || []).length, 43)

const destination = path.join(root, 'public/materials')
fs.mkdirSync(destination, { recursive: true })
fs.writeFileSync(path.join(destination, 'Accessible_Deck_EN.txt'), english)
fs.writeFileSync(path.join(destination, 'Presenter_Notes_IT.txt'), italian)
console.log(JSON.stringify({ slides: slides.length, sources: Object.keys(sources).length, checkedEnglishStrings: checkedStrings, routes: flows.map(flow => ({ id: flow.id, minutes: flow.minutes, slides: flow.slideIds.length })), outputs: ['public/materials/Accessible_Deck_EN.txt', 'public/materials/Presenter_Notes_IT.txt'] }, null, 2))
