import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadSpeakerNotes, bilingualScript } from './speaker-notes.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const slides = JSON.parse(readFileSync(path.join(root, 'data/slides.json'), 'utf8'))
const sources = JSON.parse(readFileSync(path.join(root, 'data/sources.json'), 'utf8'))
const speakerNotes = loadSpeakerNotes(slides)
const yaml = value => JSON.stringify(value)
let output = `---\ntheme: apple-basic\nlayout: default\ntitle: ${yaml(slides[0].title)}\nauthor: Marco Cremaschi\ninfo: ${yaml(slides[0].message)}\ncanvasWidth: 1280\naspectRatio: 16/9\ncolorSchema: dark\nwakeLock: false\nfonts:\n  sans: SF Pro Display, SF Pro Text, Helvetica Neue, sans-serif\n  provider: none\ntransition: fade\ndrawings:\n  persist: false\nmdc: true\npreload: false\n---\n\n`
for (const [index, slide] of slides.entries()) {
  if (index) output += `\n---\nlayout: default\nrouteAlias: ${slide.id.toLowerCase()}\ntitle: ${yaml(slide.title)}\n${slide.clicks ? `clicks: ${slide.clicks}\n` : ''}---\n\n`
  output += `<DeckSlide id="${slide.id}" />\n\n<!--\n${bilingualScript(speakerNotes[slide.id])}\n\n## Riferimenti di preparazione — non leggere ad alta voce\n\n${slide.notes}\n\n`
  output += `Percorso unico: slide ${index + 1} di ${slides.length}, senza selezione per evento.\n`
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
console.log(`Generated ${slides.length} shared slides with Italian reference notes and one complete path`)
