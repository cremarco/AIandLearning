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
  assert.deepEqual(slides.slice(bookIndex + 2, bookIndex + 6).map(slide => slide.id), ['S53SHORTCUTS', 'S53TYPES', 'S53FORMALWEB', 'S53FORMALREADALOUD'], 'Introduce formal and informal shortcuts before the distinction and the separate web-action slides')
  const formalWeb = slides.filter(slide => slide.commandCategory === 'formal-web')
  assert(!slides.some(slide => slide.id === 'S53FORMALAPP'), 'The removed desktop command slide must stay out of the sequence')
  assert(formalWeb.every(slide => slide.commands.length === 1), 'Each formal web action needs its own slide')
  assert.deepEqual(formalWeb.map(slide => slide.commands[0].command), ['Study', 'Read aloud'])
  assert(formalWeb.every(slide => !slide.commands[0].command.startsWith('/')), 'Web menu action labels must not be turned into invented slash codes')
  const formalRecord = read('public/materials/chatgpt-formal/provenance.json')
  for (const row of formalWeb.flatMap(slide => slide.commands)) {
    const recorded = formalRecord.actions.find(action => action.action === row.command)
    assert(recorded && row.result, `${row.command}: a formal result needs its original execution record`)
    assert.equal(row.result.media.src, `materials/chatgpt-formal/${recorded.capture}`)
    const status = recorded.status.startsWith('opened') ? 'opened' : recorded.status === 'executed' ? 'executed' : 'not-executed'
    assert.equal(row.result.status, status, `${row.command}: do not present an unopened or unexecuted action as executed`)
    if (row.result.text) assert.equal(row.result.text.replace(/\s+/g, ' ').trim(), recorded.result.replace(/\s+/g, ' ').trim(), `${row.command}: preserve the actual ChatGPT response`)
  }
  const commandSlides = slides.filter(slide => slide.commandCategory === 'informal')
  assert.equal(commandSlides.length, 4, 'Keep the tested interactive catalogue in four tables')
  const catalogueIndex = slides.findIndex(slide => slide.id === 'S53CMD1')
  const shortcutCloud = slides[catalogueIndex - 1]
  assert.equal(shortcutCloud?.id, 'S53SHORTCUTCLOUD', 'The complete animated overview must immediately precede the tested catalogue')
  assert.deepEqual(slides.slice(catalogueIndex, catalogueIndex + commandSlides.length).map(slide => slide.id), commandSlides.map(slide => slide.id), 'Keep the four tested-shortcut tables together')
  const commands = commandSlides.flatMap(slide => slide.commands.map(row => row.command))
  const widgetReview = read('data/chatgpt-widget-review.json')
  assert.equal(widgetReview.status, 'completed', 'Finish the UI review before curating the catalogue')
  assert.equal(widgetReview.results.length, 79, 'Every original candidate needs an observed outcome')
  assert.deepEqual(shortcutCloud.shortcutLabels, widgetReview.results.map(run => ({ command: run.command, retained: run.status === 'keep' })), 'The overview must preserve all reviewed labels, including static outcomes')
  const shortcutDescriptions = read('data/shortcut-descriptions.json')
  assert.deepEqual(Object.keys(shortcutDescriptions).sort(), widgetReview.results.map(run => run.command).sort(), 'Every shortcut needs a tooltip description')
  assert(Object.values(shortcutDescriptions).every(text => typeof text === 'string' && text.trim().length > 0 && text.length <= 120), 'Keep shortcut descriptions brief and nonempty')
  assert.equal(new Set(widgetReview.results.map(run => run.command)).size, 79, 'Each candidate must have one final review decision')
  assert(widgetReview.results.every(run => run.responseComplete && ['keep', 'remove'].includes(run.status)), 'Do not classify unfinished or untested responses')
  const retained = widgetReview.results.filter(run => run.status === 'keep')
  assert(retained.every(run => run.interaction?.action && run.interaction?.observed), 'Each retained result needs a tested content control')
  assert.deepEqual([...commands].sort(), retained.map(run => run.command).sort(), 'Only verified interactive outputs belong in the catalogue')
  assert.equal(commands.length, widgetReview.summary.kept)
  assert.equal(widgetReview.results.filter(run => run.status === 'remove').length, widgetReview.summary.removed)
  assert.deepEqual(read('public/materials/chatgpt-widgets/provenance.json'), widgetReview, 'The public execution record must match the authored review')
  const shortcutVideos = read('data/chatgpt-videos.json').clips
  assert.deepEqual(shortcutVideos.map(clip => clip.command).sort(), [...commands].sort(), 'Every retained shortcut needs a recorded video')
  const videoProvenance = read('public/materials/chatgpt-widgets/videos/provenance.json')
  for (const clip of shortcutVideos) {
    for (const field of ['src', 'poster', 'captions']) assert(clip[field] && fs.existsSync(path.join(root, 'public', clip[field])), `${clip.command}: missing video ${field}`)
    assert(clip.durationSeconds > 0 && clip.transcript, `${clip.command}: missing duration or transcript`)
    assert(clip.prompt?.toLowerCase().startsWith(clip.command.toLowerCase() + ' '), `${clip.command}: preserve the tested prompt with the video`)
    assert.equal(videoProvenance.clips.find(record => record.command === clip.command)?.sha256, clip.sha256, `${clip.command}: video provenance must match the catalogue`)
    assert(clip.chapters?.some(chapter => chapter.label === 'Prompt') && clip.chapters.some(chapter => chapter.label === 'Generation') && clip.chapters.some(chapter => chapter.label === 'Widget'), `${clip.command}: show the prompt, generation and completed widget`)
    const capture = videoProvenance.clips.find(record => record.command === clip.command)?.capture
    assert(capture?.responseComplete && capture.frames?.length >= 3, `${clip.command}: preserve a complete generation capture`)
  }
  assert.equal(slides.find(slide => slide.id === 'S53WIDGETWORKSHEET')?.media?.type, 'video', 'The worksheet example must show its recorded interaction')
  for (const example of slides.filter(slide => slide.kind === 'shortcut-example')) {
    const label = example.prompt?.match(/^\/\S+/)?.[0]
    assert(commands.includes(label), `${example.id}: remove examples that only produced static output`)
  }
  assert.equal(new Set(commands).size, commands.length, 'Informal shortcuts must not be duplicated')
  const skillResearch = read('data/skills-research.json')
  const skillIds = slides.flatMap(slide => slide.skillIds || [])
  assert.equal(skillIds.length, 4, 'The research skill catalogue must be available in the deck')
  assert.equal(new Set(skillIds).size, skillIds.length, 'Each selected skill must appear once in the catalogue')
  for (const id of skillIds) assert(skillResearch.skills.some(skill => skill.id === id), `${id}: selected skill is missing from the research catalogue`)
  const guide = fs.readFileSync(path.join(root, 'public/materials/skills-guide.html'), 'utf8')
  for (const skill of skillResearch.skills) {
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
  const notebookDemos = read('data/notebook-demos.json')
  const notebookClips = read('public/materials/notebook/provenance.json').clips
  assert.deepEqual(notebookClips.map(clip => clip.key), notebookDemos.map(demo => demo.key), 'Every NotebookLM demonstration needs its recorded clip')
  for (const demo of notebookDemos) {
    const slide = slides.find(item => item.id === demo.slideId)
    const clip = notebookClips.find(item => item.key === demo.key)
    assert(['executed', 'opened'].includes(demo.status), `${demo.key}: finish recording before publishing`)
    assert.equal(clip.status, demo.status, `${demo.key}: preserve the observed execution scope`)
    assert.equal(clip.browser, '@Browser', `${demo.key}: use only the fresh Browser recording`)
    assert.equal(slide?.kind, 'tool-demo', `${demo.key}: provide a dedicated video slide`)
    assert.equal(slide.media?.src, `materials/notebook/${demo.key}.mp4`)
    assert(clip.scenes.length >= 2 && clip.captureFrameCount >= 12 && clip.durationSeconds > 0, `${demo.key}: show recorded actions and their result`)
    for (const field of ['src', 'poster', 'captions']) assert(fs.existsSync(path.join(root, 'public', slide.media[field])), `${demo.key}: missing ${field}`)
    assert.equal(slide.media.transcript, fs.readFileSync(path.join(root, 'public/materials/notebook', `${demo.key}-transcript.txt`), 'utf8'))
  }
  console.log(`Content checks passed: ${slides.length} ordered slides, separate Study and Read aloud actions, ${commands.length} unique informal shortcuts, references and QR, no presenter notes.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkData()
