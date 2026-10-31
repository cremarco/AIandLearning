import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const slides = JSON.parse(readFileSync(path.join(root, 'data/slides.json'), 'utf8'))
const flows = JSON.parse(readFileSync(path.join(root, 'data/flows.json'), 'utf8'))
const sources = JSON.parse(readFileSync(path.join(root, 'data/sources.json'), 'utf8'))
const yaml = value => JSON.stringify(value)
let output = `---\ntheme: apple-basic\nlayout: default\ntitle: Beyond prompting\nauthor: Marco Cremaschi\ninfo: Visual tools for self-directed learning with artificial intelligence\ncanvasWidth: 1280\naspectRatio: 16/9\ncolorSchema: dark\nwakeLock: false\nfonts:\n  sans: SF Pro Display, SF Pro Text, Helvetica Neue, sans-serif\n  provider: none\ntransition: fade\nduration: 90min\ndrawings:\n  persist: false\nmdc: true\npreload: false\n---\n\n`
for (const [index, slide] of slides.entries()) {
  if (index) output += `\n---\nlayout: default\nrouteAlias: ${slide.id.toLowerCase()}\ntitle: ${yaml(slide.title)}\n---\n\n`
  output += `<DeckSlide id="${slide.id}" />\n\n<!--\n${slide.notes}\n\n`
  for (const flow of flows) {
    const i = flow.slideIds.indexOf(slide.id)
    if (i < 0) output += `${flow.name}: approfondimento fuori percorso.\n`
    else {
      const start = flow.slideIds.slice(0, i).reduce((n, id) => n + slides.find(s => s.id === id).duration[flow.id], 0)
      output += `${flow.name}: ${slide.duration[flow.id]} min; finestra ${start}–${start + slide.duration[flow.id]} min.\n`
    }
  }
  if (slide.sources.length) {
    output += '\nFONTI\n'
    for (const id of slide.sources) {
      const source = sources[id]
      if (source) output += `${id}: ${source.citation || source.title}\n${source.url || 'Materiale personale AIPP, slide2'}\n${source.claim_locator || ''}\n`
    }
  }
  output += '-->\n'
}
writeFileSync(path.join(root, 'slides.md'), output)
console.log(`Generated ${slides.length} shared slides with event-specific notes`)
