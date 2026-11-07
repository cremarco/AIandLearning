import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { projectRoot as root, readJson as read } from '../lib/project.mjs'
export const slides = read('data/generated/slides.json')
export const sources = read('data/generated/sources.json')
export const flows = read('data/generated/flows.json')

export function checkData() {
  const opening = read('data/content/opening-slides.json')
  const workshop = read('data/content/workshop-slides.json')
  assert.deepEqual(slides.map(slide => slide.id), [...opening, ...workshop].map(slide => slide.id), 'Generated slides must match the authored sequence')
  assert.equal(new Set(slides.map(slide => slide.id)).size, slides.length, 'Slide IDs must be unique')
  const markdown = fs.readFileSync(path.join(root, 'slides.md'), 'utf8')
  const speakerNotes = read('data/content/speaker-notes.json')
  assert.deepEqual(Object.keys(speakerNotes).sort(), slides.map(slide => slide.id).sort(), 'Every slide must have its own speaker notes, without orphan entries')
  const renderedNotes = [...markdown.matchAll(/<DeckSlide id="([^"]+)" \/>\s*<!--\n([\s\S]*?)\n-->/g)]
  assert.equal(renderedNotes.length, slides.length, 'Include speaker notes after every Slidev slide')
  assert.equal([...markdown.matchAll(/<DeckSlide id="([^"]+)"/g)].length, slides.length)
  for (const [index, slide] of slides.entries()) {
    assert.equal(slide.number, index + 1, `${slide.id}: incorrect slide number`)
    assert(!Object.hasOwn(slide, 'notes'), `${slide.id}: keep speaker notes separate from audience content`)
    const notes = speakerNotes[slide.id]
    assert(typeof notes === 'string' && notes.trim(), `${slide.id}: missing speaker notes`)
    assert(notes.split(/\s+/).length <= 60, `${slide.id}: keep the speaker notes short enough to read during the talk`)
    assert(/\*\*[^*\n]+\*\*/.test(notes) && notes.match(/\*\*/g).length % 2 === 0, `${slide.id}: emphasise key words with balanced Markdown bold`)
    assert(!/<!--|-->/.test(notes), `${slide.id}: notes must not contain nested HTML comments`)
    assert.equal(renderedNotes[index][1], slide.id, `${slide.id}: notes must remain attached to the right slide after reordering`)
    assert.equal(renderedNotes[index][2], notes, `${slide.id}: preserve the authored speaker notes`)
    for (const id of slide.sources) assert(sources[id], `${slide.id}: missing source ${id}`)
  }
  assert.equal(flows.length, 1, 'Only one complete presentation path is supported')
  assert.equal(flows[0].id, 'all')
  assert.deepEqual(flows[0].slideIds, slides.map(slide => slide.id))
  const bibliographyText = fs.readFileSync(path.join(root, 'data/references/bibliography.bib'), 'utf8')
  const bibliographyAudit = read('data/references/bibliography-audit.json')
  const bibliographyCount = [...bibliographyText.matchAll(/^@\w+\{/gm)].length
  assert.equal(bibliographyAudit.bibtex_sha256, createHash('sha256').update(bibliographyText).digest('hex'), 'The bibliography audit must match the delivered BibTeX')
  assert.equal(bibliographyAudit.records.length, bibliographyCount, 'Audit every delivered bibliography entry')
  assert.equal(bibliographyAudit.validation.total_entries, bibliographyCount, 'Keep bibliography validation counts current')
  const bookIndex = slides.findIndex(slide => slide.id === 'S53')
  assert(bookIndex >= 0, 'The assigned chapter must be present')
  assert.deepEqual(slides.slice(bookIndex + 1, bookIndex + 3).map(slide => slide.id), ['S53TOOLCHATGPT', 'S53GPT'], 'Introduce ChatGPT with its title and logo immediately after the book')
  assert.deepEqual(slides.slice(bookIndex + 3, bookIndex + 7).map(slide => slide.id), ['S53SHORTCUTS', 'S53TYPES', 'S53FORMALWEB', 'S53FORMALREADALOUD'], 'Introduce formal and informal shortcuts before the distinction and the separate web-action slides')
  const formalWeb = slides.filter(slide => slide.commandCategory === 'formal-web')
  assert(!slides.some(slide => slide.id === 'S53FORMALAPP'), 'The removed desktop command slide must stay out of the sequence')
  assert(formalWeb.every(slide => slide.commands.length === 1), 'Each formal web action needs its own slide')
  assert.deepEqual(formalWeb.map(slide => slide.commands[0].command), ['Study', 'Read aloud'])
  assert(formalWeb.every(slide => !slide.commands[0].command.startsWith('/')), 'Web menu action labels must not be turned into invented slash codes')
  const formalRecord = read('public/materials/chatgpt-formal/provenance.json')
  for (const row of formalWeb.flatMap(slide => slide.commands)) {
    const recorded = formalRecord.actions.find(action => action.action === row.command)
    assert(recorded && row.result, `${row.command}: a formal result needs its original execution record`)
    assert.equal(row.result.media.src, recorded.video?.src || `materials/chatgpt-formal/${recorded.capture}`)
    if (recorded.video) {
      assert.equal(row.result.media.type, 'video', `${row.command}: keep the recorded video playable`)
      for (const field of ['src', 'poster', 'captions']) {
        assert.equal(row.result.media[field], recorded.video[field], `${row.command}: preserve the recorded ${field}`)
        assert(fs.existsSync(path.join(root, 'public', row.result.media[field])), `${row.command}: missing video ${field}`)
      }
      const clip = fs.readFileSync(path.join(root, 'public', recorded.video.src))
      assert.equal(createHash('sha256').update(clip).digest('hex'), recorded.video.sha256, `${row.command}: video must match its provenance`)
      assert.equal(row.result.media.transcript, fs.readFileSync(path.join(root, 'public', recorded.video.transcriptFile), 'utf8'))
    }
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
  const widgetReview = read('data/demos/chatgpt-widget-review.json')
  assert.equal(widgetReview.status, 'completed', 'Finish the UI review before curating the catalogue')
  assert.equal(widgetReview.results.length, 79, 'Every original candidate needs an observed outcome')
  assert.deepEqual(shortcutCloud.shortcutLabels, widgetReview.results.map(run => ({ command: run.command, retained: run.status === 'keep' })), 'The overview must preserve all reviewed labels, including static outcomes')
  const shortcutDescriptions = read('data/catalogues/shortcut-descriptions.json')
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
  const shortcutVideos = read('data/demos/chatgpt-videos.json').clips
  assert.deepEqual(shortcutVideos.map(clip => clip.command).sort(), [...commands].sort(), 'Every retained shortcut needs a recorded video')
  const shortcutDetails = slides.filter(slide => slide.kind === 'shortcut-detail')
  assert.equal(shortcutDetails.length, widgetReview.results.length, 'Every reviewed shortcut needs its own detail slide')
  assert.deepEqual(shortcutDetails.map(slide => slide.title), widgetReview.results.map(run => run.command), 'Show every shortcut exactly once, in reviewed order')
  const detailsIndex = slides.findIndex(slide => slide.id === 'S53CMD4') + 1
  assert.deepEqual(slides.slice(detailsIndex, detailsIndex + shortcutDetails.length).map(slide => slide.id), shortcutDetails.map(slide => slide.id), 'Keep the individual shortcut slides together after the four overview tables')
  for (const [index, detail] of shortcutDetails.entries()) {
    const run = widgetReview.results[index]
    const video = shortcutVideos.find(clip => clip.command.toLowerCase() === run.command.toLowerCase())
    assert.equal(detail.id, `S53DETAIL${run.command.replace(/[^a-z0-9]/gi, '').toUpperCase()}`)
    assert.equal(detail.message, shortcutDescriptions[run.command], `${run.command}: use the authored purpose`)
    assert.equal(detail.prompt, video?.prompt || run.prompt, `${run.command}: preserve the full prompt that belongs to the recording`)
    if (run.conversationUrl) assert(detail.links.some(link => link.url === run.conversationUrl), `${run.command}: preserve the recorded conversation link`)
    if (video) {
      assert.equal(detail.media?.src, video.src, `${run.command}: show its original recorded video`)
      assert.equal(detail.resultLabel, 'Recorded interactive output')
      assert.equal(detail.result, video.caption || video.alt)
    } else if (run.outputType === 'static-image') {
      assert.equal(detail.resultLabel, 'Recorded observation · static image')
      assert.equal(detail.result, run.interaction.observed, `${run.command}: show the recorded observation, not an invented image`)
      assert(!detail.media, `${run.command}: the review did not preserve an image asset`)
    } else {
      const marker = /(?:ChatGPT ha detto:|ChatGPT said:|ChatGPT ha risposto:)/i.exec(run.uiText)
      assert(marker, `${run.command}: locate the recorded assistant response`)
      const response = run.uiText.slice(marker.index + marker[0].length).trim()
      assert(response.startsWith(detail.result.replace(/…$/, '')), `${run.command}: keep a verbatim response excerpt`)
      assert(detail.result.length > 0 && detail.result.length <= 651, `${run.command}: keep the visible excerpt concise`)
      if (response.length > 650) assert(detail.result.endsWith('…') && detail.resultLabel.includes('excerpt'), `${run.command}: identify truncated excerpts`)
      assert(!detail.media, `${run.command}: a static response must not be relabelled as an interactive recording`)
    }
  }
  const videoProvenance = read('public/materials/chatgpt-widgets/videos/provenance.json')
  assert.equal(new Set(videoProvenance.clips.map(record => record.capture?.conversationFingerprint)).size, 30, 'Every shortcut video must use an independent temporary chat')
  for (const clip of shortcutVideos) {
    for (const field of ['src', 'poster', 'captions']) assert(clip[field] && fs.existsSync(path.join(root, 'public', clip[field])), `${clip.command}: missing video ${field}`)
    assert(clip.durationSeconds > 0 && clip.transcript, `${clip.command}: missing duration or transcript`)
    assert(clip.prompt?.toLowerCase().startsWith(clip.command.toLowerCase() + ' '), `${clip.command}: preserve the tested prompt with the video`)
    assert.equal(videoProvenance.clips.find(record => record.command === clip.command)?.sha256, clip.sha256, `${clip.command}: video provenance must match the catalogue`)
    assert(clip.chapters?.some(chapter => chapter.label === 'Prompt') && clip.chapters.some(chapter => chapter.label === 'Generation') && clip.chapters.some(chapter => chapter.label === 'Widget'), `${clip.command}: show the prompt, generation and completed widget`)
    const capture = videoProvenance.clips.find(record => record.command === clip.command)?.capture
    assert(capture?.responseComplete && capture.frames?.length >= 3, `${clip.command}: preserve a complete generation capture`)
    assert.deepEqual(clip.chapters.map(chapter => chapter.label), ['PDF', 'Read chapter', 'Prompt', 'Send', 'Generation', 'Widget', 'Use'], `${clip.command}: show PDF upload before the second-message shortcut and widget use`)
    assert.equal(clip.width, 1440, `${clip.command}: use the agreed 1440px delivery width`)
    assert.equal(clip.height, 900, `${clip.command}: use the agreed 900px delivery height`)
    assert.equal(clip.fps, 60, `${clip.command}: retain smooth browser transitions`)
    assert(capture.responseId && capture.actions?.length >= 7, `${clip.command}: record several meaningful interactions with the actual response`)
    assert(capture.newChat && capture.temporaryChat && clip.temporaryChat, `${clip.command}: use a fresh temporary chat`)
    assert.match(capture.conversationFingerprint, /^[a-f0-9]{64}$/, `${clip.command}: preserve the independent conversation fingerprint`)
    assert.equal(capture.initialMessageCount, 0, `${clip.command}: begin with an empty chat`)
    assert.equal(capture.userMessageCount, 2, `${clip.command}: upload the PDF first and send the shortcut second`)
    assert.equal(capture.interfaceLanguage, 'en', `${clip.command}: record the English interface`)
    assert.equal(clip.interfaceLanguage, 'en', `${clip.command}: identify the interface language`)
    assert(clip.setupPrompt && clip.transcript.includes(clip.setupPrompt), `${clip.command}: preserve the PDF setup request`)
    assert.equal(clip.transcript, fs.readFileSync(path.join(root, 'public', clip.transcriptFile), 'utf8'), `${clip.command}: keep the downloadable transcript consistent with the slide`)
    assert(clip.durationSeconds - clip.chapters.at(-1).seconds >= 39.999, `${clip.command}: demonstrate at least forty seconds of normal-speed use`)
    assert(capture.phases?.filter(phase => ['widget', 'usage'].includes(phase.name)).every(phase => phase.speed === 1), `${clip.command}: never accelerate widget use`)
  }
  assert.equal(slides.find(slide => slide.id === 'S53WIDGETWORKSHEET')?.media?.type, 'video', 'The worksheet example must show its recorded interaction')
  for (const example of slides.filter(slide => slide.kind === 'shortcut-example')) {
    const label = example.prompt?.match(/^\/\S+/)?.[0]
    assert(commands.includes(label), `${example.id}: remove examples that only produced static output`)
  }
  assert.equal(new Set(commands).size, commands.length, 'Informal shortcuts must not be duplicated')
  const skillResearch = read('data/catalogues/skills-research.json')
  const skillDemos = read('data/demos/skill-demos.json')
  const skillClips = read('public/materials/skills/provenance.json')
  const skillIds = slides.flatMap(slide => slide.skillIds || [])
  assert.equal(skillIds.length, 6, 'The six tested chapter workflows must be available in the deck')
  assert.equal(new Set(skillIds).size, skillIds.length, 'Each selected skill must appear once in the catalogue')
  for (const id of skillIds) assert(skillResearch.skills.some(skill => skill.id === id), `${id}: selected skill is missing from the research catalogue`)
  assert.deepEqual([...skillIds].sort(), skillDemos.map(demo => demo.key).sort(), 'Each selected skill needs its own chapter demonstration')
  assert.deepEqual(skillClips.clips.map(clip => clip.key), skillDemos.map(demo => demo.key))
  assert.equal(skillClips.sourceBook.sha256, createHash('sha256').update(fs.readFileSync(path.join(root, 'public', skillClips.sourceBook.path))).digest('hex'), 'Recordings must identify the exact workshop book')
  for (const demo of skillDemos) {
    const clip = skillClips.clips.find(item => item.key === demo.key)
    const slide = slides.find(item => item.id === demo.slideId)
    assert(demo.accepted && demo.status === 'executed' && clip?.status === 'executed', `${demo.key}: finish the web test before publication`)
    assert.equal(clip.browser, '@Browser')
    assert.equal(clip.width, 1440, `${demo.key}: use the common video width`)
    assert.equal(clip.height, 900, `${demo.key}: use the common video height`)
    assert.equal(slide?.kind, 'tool-demo')
    assert.equal(slide.prompt, demo.prompt, `${demo.key}: preserve the original request`)
    assert(slide.prompt.includes(slide.promptExcerpt), `${demo.key}: the displayed excerpt must come from the tested request`)
    assert(slide.sources.includes('BOOK_CHAPTER'), `${demo.key}: keep the example on the assigned book`)
    assert(clip.scenes.length >= 2 && clip.captureFrameCount >= 6 && clip.durationSeconds > 0)
    assert(clip.scenes.every(scene => demo.allowedTabIds.includes(scene.browserTabId)), `${demo.key}: reject recordings of another tab`)
    assert.equal(clip.packageSource.commit, demo.packageSource.commit)
    assert(/^[a-f0-9]{40}$/.test(clip.packageSource.commit), `${demo.key}: pin the tested publisher package`)
    assert.equal(slide.media?.src, `materials/skills/${demo.key}.mp4`)
    for (const field of ['src', 'poster', 'captions']) assert(fs.existsSync(path.join(root, 'public', slide.media[field])), `${demo.key}: missing ${field}`)
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'public', slide.media.src))).digest('hex'), clip.videoSha256)
    assert.equal(slide.media.transcript, fs.readFileSync(path.join(root, 'public/materials/skills', `${demo.key}-transcript.txt`), 'utf8'))
    for (const file of demo.artifacts || []) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'public', file.url))).digest('hex'), file.sha256, `${demo.key}: generated output differs from its recorded version`)
  }
  const guide = fs.readFileSync(path.join(root, 'public/materials/skills-guide.html'), 'utf8')
  for (const skill of skillResearch.skills) {
    assert.equal(sources[skill.sourceId]?.url, skill.sourceUrl, `${skill.name}: cite its publisher’s reviewed instructions`)
    assert.equal(skill.reviewStatus, 'source-reviewed')
    assert.equal(skill.executionStatus, skillIds.includes(skill.id) ? 'executed' : 'not-executed', `${skill.name}: preserve the actual execution scope`)
    assert(skill.requirements && skill.license && skill.installCommand && skill.caveat, `${skill.name}: preserve requirements and limits`)
    assert(guide.includes(`id="${skill.id}"`), `${skill.name}: accessible guide entry missing`)
  }
  const qr = read('public/images/qr/eduforum-github-pages.json')
  assert.equal(qr.decodedPayload, 'https://cremarco.github.io/EduForum/')
  assert.equal(slides.find(slide => slide.id === 'S50QR').links[0].url, qr.decodedPayload)
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S50QR') + 1]?.id, 'S50LEGEND')
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S51') - 1]?.id, 'S50LEGEND')
  const notebookDemos = read('data/demos/notebook-demos.json')
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
  console.log(`Content checks passed: ${slides.length} ordered slides with concise presenter notes, separate Study and Read aloud actions, ${commands.length} unique informal shortcuts, references and QR.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkData()
