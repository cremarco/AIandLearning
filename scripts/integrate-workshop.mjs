import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (file, fallback) => {
  const absolutePath = path.join(root, file)
  return fs.existsSync(absolutePath)
    ? JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
    : fallback
}
const write = (file, data) => fs.writeFileSync(
  path.join(root, file), `${JSON.stringify(data, null, 2)}\n`,
)

const intro = read('data/opening-slides.json', [])
const media = read('data/media.json', {})
const overrides = read('data/editorial-overrides.json', {})
const workshop = read('data/workshop-slides.json', []).map(slide => ({
  ...slide,
  type: 'workshop',
  audience: slide.audience || 'both',
  body: slide.body || [],
  sources: slide.sources || [],
  ...(media[slide.id] ? { media: media[slide.id] } : {}),
  ...overrides[slide.id],
}))

const slides = [...intro, ...workshop].map((slide, index) => {
  // The deck has one sequence and no speaker scripts or per-event timing variants.
  const { notes, duration, ...content } = slide
  return {
    ...content,
    number: index + 1,
    links: (slide.links || []).map(link => ({
      ...link,
      url: link.url.replace(/\.\/materials\/demo-genai\/$/, './materials/demo-genai/index.html'),
    })),
  }
})
const sources = {
  ...read('data/opening-sources.json', {}),
  ...read('data/workshop-sources.json', {}),
}
const flows = [{
  id: 'all',
  name: 'Complete',
  event: 'Beyond prompting · Complete presentation',
  focus: 'All slides in one continuous sequence',
  slideIds: slides.map(slide => slide.id),
}]

write('data/slides.json', slides)
write('data/sources.json', sources)
write('data/flows.json', flows)
console.log(`Integrated ${slides.length} slides in one sequence`)
