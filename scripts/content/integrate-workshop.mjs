
import { readJson as read, writeJson as write } from '../lib/project.mjs'
const intro = read('data/content/opening-slides.json', [])
const media = read('data/content/media.json', {})
const overrides = read('data/content/editorial-overrides.json', {})
const shortcutLabels = read('data/demos/chatgpt-widget-review.json', { results: [] }).results
  .map(run => ({ command: run.command, retained: run.status === 'keep' }))
const workshop = read('data/content/workshop-slides.json', []).map(slide => ({
  ...slide,
  type: 'workshop',
  audience: slide.audience || 'both',
  body: slide.body || [],
  sources: slide.sources || [],
  ...(media[slide.id] ? { media: media[slide.id] } : {}),
  ...overrides[slide.id],
}))

const slides = [...intro, ...workshop].map((slide, index) => {
  // Audience content has one sequence; speaker notes are authored separately by ID.
  const { notes, duration, ...content } = slide
  return {
    ...content,
    ...(slide.kind === 'shortcut-cloud' ? { shortcutLabels } : {}),
    number: index + 1,
    links: (slide.links || []).map(link => ({
      ...link,
      url: link.url.replace(/\.\/materials\/demo-genai\/$/, './materials/demo-genai/index.html'),
    })),
  }
})
const sources = {
  ...read('data/references/opening-sources.json', {}),
  ...read('data/references/workshop-sources.json', {}),
}
const flows = [{
  id: 'all',
  name: 'Complete',
  event: 'Beyond prompting · Complete presentation',
  focus: 'All slides in one continuous sequence',
  slideIds: slides.map(slide => slide.id),
}]

write('data/generated/slides.json', slides)
write('data/generated/sources.json', sources)
write('data/generated/flows.json', flows)
console.log(`Integrated ${slides.length} slides in one sequence`)
