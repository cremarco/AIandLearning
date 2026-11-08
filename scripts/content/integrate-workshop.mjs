
import { readJson as read, writeJson as write } from '../lib/project.mjs'
const intro = read('data/content/opening-slides.json', [])
const media = read('data/content/media.json', {})
const overrides = read('data/content/editorial-overrides.json', {})
const shortcutRecheck = new Map(read('data/demos/chatgpt-widget-recheck.json', { results: [] }).results.map(run => [run.command, run]))
const selectedShortcuts = new Set(read('data/content/shortcut-selection.json').retained.map(item => item.command))
const shortcutLabels = read('data/demos/chatgpt-widget-review.json', { results: [] }).results
  .map(run => shortcutRecheck.get(run.command) || run)
  .filter(run => run.status === 'keep' && selectedShortcuts.has(run.command))
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
// Reader materials retain complete transcripts. The presentation only needs
// playback metadata; load a transcript from its file when explicitly requested.
const runtimeMedia = media => {
  if (!media) return media
  const { transcript, ...metadata } = media
  return metadata
}
write('data/generated/slides-runtime.json', slides.map(slide => ({
  ...slide,
  ...(slide.media ? { media: runtimeMedia(slide.media) } : {}),
  ...(slide.commands ? { commands: slide.commands.map(command => ({
    ...command,
    ...(command.result ? { result: { ...command.result, media: runtimeMedia(command.result.media) } } : {}),
  })) } : {}),
})))
write('data/generated/shortcut-videos.json', read('data/demos/chatgpt-videos.json').clips
  .filter(clip => selectedShortcuts.has(clip.command)).map(runtimeMedia))
write('data/generated/sources.json', sources)
write('data/generated/flows.json', flows)
console.log(`Integrated ${slides.length} slides in one sequence`)
