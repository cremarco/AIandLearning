import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { projectRoot as root, readJson as read } from '../lib/project.mjs'
import { checkPublishedRecordings, checkReleasedMedia, checkNativeVideoExport } from './check-recordings.mjs'
export const slides = read('data/generated/slides.json')
export const sources = read('data/generated/sources.json')
export const flows = read('data/generated/flows.json')

export function checkData() {
  const publishedRecordings = checkPublishedRecordings(slides)
  const opening = read('data/content/opening-slides.json')
  const workshop = read('data/content/workshop-slides.json')
  assert.deepEqual(slides.map(slide => slide.id), [...opening, ...workshop].map(slide => slide.id), 'Generated slides must match the authored sequence')
  assert.equal(new Set(slides.map(slide => slide.id)).size, slides.length, 'Slide IDs must be unique')
  const studyPhases = ['plan', 'understand', 'connect', 'recall', 'apply', 'check']
  const phaseOverview = slides.find(slide => slide.id === 'S52PHASES')
  assert.deepEqual(phaseOverview?.steps.map(step => step.title.toLowerCase()), studyPhases, 'Introduce all six study phases in order')
  assert(phaseOverview.number < slides.find(slide => slide.id === 'S53GPT').number, 'Explain the study phases before introducing tools')
  const checkStudyFocus = (focus, label) => {
    assert(focus && [...studyPhases, 'support'].includes(focus.primary), `${label}: provide a valid main study phase`)
    const secondary = focus.secondary || []
    assert(secondary.length <= 1 && secondary.every(phase => studyPhases.includes(phase) && phase !== focus.primary), `${label}: use at most one distinct secondary study phase`)
    assert(focus.primary !== 'support' || secondary.length === 0, `${label}: keep supporting operations distinct from learning phases`)
  }
  for (const slide of slides) {
    const requiresRibbon = slide.tool || ['chatgpt-intro', 'command-classification', 'prompt-commands', 'shortcut-cloud', 'shortcut-detail', 'skill-guide', 'skill-catalogue', 'tool-table', 'tool-divider', 'section-divider'].includes(slide.kind)
    if (requiresRibbon || slide.studyPhases) checkStudyFocus(slide.studyPhases, slide.id)
  }
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
  const closingIndex = slides.findIndex(slide => slide.kind === 'thanks')
  assert(closingIndex >= 0, 'The presentation needs a closing slide')
  assert(slides.slice(closingIndex + 1).every(slide => ['bibliography', 'web-resources'].includes(slide.kind)), 'Only references follow Thank you')
  assert(slides.filter(slide => ['bibliography', 'web-resources'].includes(slide.kind)).every(slide => slide.number > slides[closingIndex].number), 'References belong after Thank you')
  assert(slides.find(slide => slide.id === 'S97ACCESS')?.toolTable.rows.length >= 3, 'Keep accessibility tools in their own table')
  assert(!slides.some(slide => slide.toolTable?.rows.some(row => row.tool === 'Transformers.js + Qwen')), 'Keep the removed runtime row out of the tool tables')
  const postNotebook = slides.slice(slides.findIndex(slide => slide.id === 'S67SHARE') + 1)
  for (const tool of new Set(postNotebook.map(slide => slide.tool).filter(Boolean))) {
    assert(postNotebook.filter(slide => slide.tool === tool).length <= 2, `${tool}: after NotebookLM, keep at most two slides per tool`)
  }
  assert(bookIndex >= 0, 'The assigned chapter must be present')
  assert.equal(slides[bookIndex + 1]?.id, 'S53GPT', 'Introduce ChatGPT possibilities immediately after the book')
  assert(!slides.some(slide => slide.id === 'S53TOOLCHATGPT'), 'Keep the removed ChatGPT title divider out of the sequence')
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
    if (checkReleasedMedia(row.result.media, publishedRecordings)) {
      assert.equal(row.result.status, 'executed', `${row.command}: release only the executed formal action`)
      continue
    }
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
      if (row.command === 'Study') {
        assert.equal(recorded.video.width, 1440, 'Study: match the shortcut video width')
        assert.equal(recorded.video.height, 900, 'Study: preserve the same 16:10 proportions')
        assert.equal(recorded.video.fps, 60, 'Study: keep smooth browser motion')
        assert(recorded.video.capture?.nativeStudySelected && recorded.video.temporaryChat && recorded.video.interfaceLanguage === 'en', 'Study: select the real action in a fresh English temporary chat')
        assert(recorded.video.capture.responseComplete && recorded.video.capture.userMessageCount === 8, 'Study: preserve the PDF setup, study request and six learner replies')
        assert(recorded.video.normalUseSeconds >= 75, 'Study: show several readable exchanges at normal speed')
        assert(recorded.video.capture.phases.filter(phase => /^(read-|answer-)/.test(phase.name)).every(phase => phase.speed === 1), 'Study: only accelerate prompt entry and generation')
      }
      if (row.command === 'Read aloud') {
        assert.deepEqual([recorded.video.width, recorded.video.height, recorded.video.fps], [1440, 900, 60], 'Read aloud: match the other browser videos')
        assert(recorded.video.temporaryChat && recorded.video.interfaceLanguage === 'en', 'Read aloud: use a fresh English temporary chat')
        assert(recorded.video.capture?.nativeReadAloudSelected && recorded.video.capture.manualStopExecuted && recorded.video.capture.feedbackPlaybackStarted, 'Read aloud: demonstrate the native action, stopping, replaying and reading the latest feedback')
        assert(recorded.video.capture.responseComplete && recorded.video.capture.userMessageCount === 3, 'Read aloud: preserve the PDF, prompt and learner explanation')
        assert(recorded.video.normalUseSeconds >= 40, 'Read aloud: leave time to follow the playback and learner actions')
        assert(recorded.video.capture.phases.filter(phase => /^(read-|playback-|answer-)/.test(phase.name)).every(phase => phase.speed === 1), 'Read aloud: keep playback and learner actions at normal speed')
      }
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
  const shortcutDescriptions = read('data/catalogues/shortcut-descriptions.json')
  assert.deepEqual(Object.keys(shortcutDescriptions).sort(), widgetReview.results.map(run => run.command).sort(), 'Every shortcut needs a tooltip description')
  assert(Object.values(shortcutDescriptions).every(text => typeof text === 'string' && text.trim().length > 0 && text.length <= 120), 'Keep shortcut descriptions brief and nonempty')
  assert.equal(new Set(widgetReview.results.map(run => run.command)).size, 79, 'Each candidate must have one final review decision')
  assert(widgetReview.results.every(run => run.responseComplete && ['keep', 'remove'].includes(run.status)), 'Do not classify unfinished or untested responses')
  const recheck = read('data/demos/chatgpt-widget-recheck.json')
  assert.equal(recheck.status, 'completed', 'Finish the new live check before updating the shortcut selection')
  const previouslyStatic = widgetReview.results.filter(run => run.status === 'remove')
  assert.deepEqual(recheck.results.map(run => run.command), previouslyStatic.map(run => run.command), 'Retest every previously static label exactly once')
  assert.equal(recheck.summary.tested, previouslyStatic.length)
  assert.equal(recheck.summary.nowInteractive, recheck.results.filter(run => run.status === 'keep').length)
  assert.equal(recheck.summary.stillStatic, recheck.results.filter(run => run.status === 'remove').length)
  for (const [index, run] of recheck.results.entries()) {
    assert.equal(run.prompt, previouslyStatic[index].prompt, `${run.command}: rerun the exact original request`)
    assert(run.responseComplete && run.temporaryChat && run.userMessageCount === 2, `${run.command}: complete a fresh chat with PDF setup and the original prompt`)
    assert(['keep', 'remove'].includes(run.status) && run.interaction.action && run.interaction.observed, `${run.command}: record the new decision and observed action`)
    assert.match(run.evidence.sha256, /^[a-f0-9]{64}$/, `${run.command}: identify the saved screenshot`)
  }
  const publicRecheck = { ...recheck, results: recheck.results.map(({ evidence, ...run }) => run) }
  assert.deepEqual(read('public/materials/chatgpt-widgets/recheck/provenance.json'), publicRecheck, 'Publish the new prompts and observations without private UI snapshots')
  const byCommand = new Map(recheck.results.map(run => [run.command, run]))
  const currentResults = widgetReview.results.map(run => byCommand.get(run.command) || run)
  const eligible = currentResults.filter(run => run.status === 'keep')
  const selection = read('data/content/shortcut-selection.json')
  const selectedCommands = selection.retained.map(item => item.command)
  const excludedCommands = selection.excluded.map(item => item.command)
  assert.equal(selection.summary.eligible, eligible.length)
  assert.equal(selection.summary.selected, selectedCommands.length)
  assert.equal(selection.summary.excluded, excludedCommands.length)
  assert.equal(new Set([...selectedCommands, ...excludedCommands]).size, eligible.length, 'Editorial decisions must be unique and cover all eligible labels')
  assert.deepEqual([...selectedCommands, ...excludedCommands].sort(), eligible.map(run => run.command).sort(), 'Keep technical verification separate from editorial selection')
  assert(selection.retained.every(item => item.purpose && item.rationale), 'Every selected shortcut needs a distinct learning purpose')
  for (const item of selection.excluded) {
    assert(item.reason && item.coveredBy.length, `${item.command}: explain the editorial exclusion`)
    assert(item.coveredBy.every(command => selectedCommands.includes(command)), `${item.command}: its learning action must be covered by retained examples`)
  }
  const retained = eligible.filter(run => selectedCommands.includes(run.command))
  const recorded = widgetReview.results.filter(run => run.status === 'keep')
  assert.deepEqual(shortcutCloud.shortcutLabels, retained.map(run => ({ command: run.command, retained: true })), 'The overview must show only the editorially selected, verified shortcuts')
  assert(retained.every(run => run.interaction?.action && run.interaction?.observed), 'Each retained result needs a tested content control')
  assert.deepEqual([...commands].sort(), [...selectedCommands].sort(), 'The four tables must cover the editorial selection exactly once')
  for (const group of selection.groups) {
    assert.deepEqual(slides.find(slide => slide.id === group.slideId)?.commands, group.commands, `${group.slideId}: preserve the selected learning-action group`)
  }
  assert.equal(recorded.length, widgetReview.summary.kept, 'Preserve the complete historical video catalogue')
  assert.equal(widgetReview.results.filter(run => run.status === 'remove').length, widgetReview.summary.removed)
  assert.deepEqual(read('public/materials/chatgpt-widgets/provenance.json'), widgetReview, 'The public execution record must match the authored review')
  const shortcutVideos = read('data/demos/chatgpt-videos.json').clips
  assert.equal(new Set(shortcutVideos.map(clip => clip.command)).size, shortcutVideos.length, 'A shortcut has one current recording')
  assert(selectedCommands.every(command => shortcutVideos.some(clip => clip.command === command)), 'Every selected shortcut needs its current recording')
  const shortcutDetails = slides.filter(slide => slide.kind === 'shortcut-detail')
  assert.equal(shortcutDetails.length, retained.length, 'Every retained interactive shortcut needs its own detail slide')
  assert.deepEqual(shortcutDetails.map(slide => slide.title).sort(), retained.map(run => run.command).sort(), 'Show every retained interactive shortcut exactly once')
  assert.deepEqual(shortcutDetails.map(slide => slide.title), commands, 'Present shortcut videos in the same order as the overview tables')
  const detailsIndex = slides.findIndex(slide => slide.id === 'S53CMD4') + 1
  assert.deepEqual(slides.slice(detailsIndex, detailsIndex + shortcutDetails.length).map(slide => slide.id), shortcutDetails.map(slide => slide.id), 'Keep the individual shortcut slides together after the four overview tables')
  for (const detail of shortcutDetails) {
    const run = retained.find(run => run.command === detail.title)
    const video = shortcutVideos.find(clip => clip.command.toLowerCase() === run.command.toLowerCase())
    assert.equal(detail.id, `S53DETAIL${run.command.replace(/[^a-z0-9]/gi, '').toUpperCase()}`)
    const footnoteMarker = detail.body?.some(text => text.startsWith('* ')) ? '*' : ''
    assert.equal(detail.message, `${shortcutDescriptions[run.command]}${footnoteMarker}`, `${run.command}: use the authored purpose, with its footnote marker`)
    assert.equal(detail.prompt?.trim(), (video?.prompt || run.prompt).trim(), `${run.command}: preserve the full prompt that belongs to the recording`)
    if (video) {
      if (checkReleasedMedia(video, publishedRecordings)) {
        assert.equal(detail.media?.src, video.src, `${run.command}: use the current recording`)
        assert.deepEqual(detail.media?.result, video.result, `${run.command}: use its verified result`)
        continue
      }
      if (run.conversationUrl && video.recordingMode !== 'temporary-prompt-and-quiz') assert(detail.links.some(link => link.url === run.conversationUrl), `${run.command}: preserve the recorded conversation link`)
      assert.equal(detail.media?.src, video.src, `${run.command}: show its original recorded video`)
      assert.equal(detail.resultLabel, video.recordingMode === 'temporary-prompt-and-quiz' ? 'Temporary chat → book → prompt → quiz' : 'Recorded interactive output')
      assert.equal(detail.result, video.caption || video.alt)
    } else {
      assert(byCommand.has(run.command), `${run.command}: every restored shortcut needs its fresh live check`)
      assert.equal(detail.resultLabel, 'Verified interaction · 7 Nov 2026', `${run.command}: distinguish a verified action summary from a video`)
      assert.equal(detail.result, run.interaction.observed)
      assert(detail.body.some(text => text.includes(run.interaction.action)), `${run.command}: describe the actual tested control`)
      assert(!detail.media, `${run.command}: do not reuse media from its earlier static result`)
      assert(detail.sources.includes('CHATGPT_WIDGET_RECHECK'))
    }
  }
  for (const run of currentResults.filter(run => run.status === 'remove' || excludedCommands.includes(run.command))) {
    const commandPattern = new RegExp(`(?:^|[\\s"])${run.command}(?![a-z0-9])`, 'i')
    assert(!commandPattern.test(JSON.stringify(slides)), `${run.command}: excluded shortcuts must stay out of all audience slide content`)
  }
  const videoProvenance = read('public/materials/chatgpt-widgets/videos/provenance.json')
  for (const clip of shortcutVideos) {
    if (checkReleasedMedia(clip, publishedRecordings)) continue
    const quizSample = clip.command === '/quiz' && clip.recordingMode === 'temporary-prompt-and-quiz'
    for (const field of ['src', 'poster', 'captions']) assert(clip[field] && fs.existsSync(path.join(root, 'public', clip[field])), `${clip.command}: missing video ${field}`)
    assert(clip.durationSeconds > 0 && clip.transcript, `${clip.command}: missing duration or transcript`)
    assert(clip.prompt?.toLowerCase().startsWith(clip.command.toLowerCase() + ' '), `${clip.command}: preserve the tested prompt with the video`)
    assert.equal(videoProvenance.clips.find(record => record.command === clip.command)?.sha256, clip.sha256, `${clip.command}: video provenance must match the catalogue`)
    assert(clip.chapters?.some(chapter => chapter.label === 'Widget') && (quizSample || clip.chapters.some(chapter => chapter.label === 'Prompt') && clip.chapters.some(chapter => chapter.label === 'Generation')), `${clip.command}: identify the widget and any generation shown`)
    const capture = videoProvenance.clips.find(record => record.command === clip.command)?.capture
    assert(capture?.responseComplete && capture.frames?.length >= 3, `${clip.command}: preserve a complete generation capture`)
    assert.deepEqual(clip.chapters.map(chapter => chapter.label), quizSample ? ['Temporary chat', 'Book', 'Prompt', 'Send', 'Generation', 'Widget', 'Use', 'Score', 'Retry'] : ['PDF', 'Read chapter', 'Prompt', 'Send', 'Generation', 'Widget', 'Use'], `${clip.command}: chapters must describe the scenes actually recorded`)
    assert.equal(clip.width, 1440, `${clip.command}: use the agreed 1440px delivery width`)
    assert.equal(clip.height, 900, `${clip.command}: use the agreed 900px delivery height`)
    assert.equal(clip.fps, 60, `${clip.command}: retain smooth browser transitions`)
    assert(capture.responseId && capture.actions?.length >= 7, `${clip.command}: record several meaningful interactions with the actual response`)
    assert.match(capture.conversationFingerprint, /^[a-f0-9]{64}$/, `${clip.command}: preserve the independent conversation fingerprint`)
    if (quizSample) {
      const sample = videoProvenance.clips.find(record => record.command === clip.command)
      assert(capture.newChat && capture.temporaryChat && clip.temporaryChat, 'Quiz sample: use a new temporary chat')
      assert.equal(capture.initialMessageCount, 0, 'Quiz sample: start with no previous messages')
      assert.equal(capture.userMessageCount, 1, 'Quiz sample: send the book and quiz prompt together')
      assert(capture.conversationUrl.endsWith('?temporary-chat=true'))
      assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, capture.book.path))).digest('hex'), capture.book.sha256, 'Quiz sample: identify the uploaded book')
      assert(sample.sampleEdit.startsInTemporaryChat && sample.sampleEdit.bookUploadShown && sample.sampleEdit.noPreviousConversations, 'Quiz sample: show the empty temporary chat and actual book upload')
      assert(sample.sampleEdit.startsInChatGPT && sample.sampleEdit.promptEntryShown && sample.sampleEdit.generationShown, 'Quiz sample: start in ChatGPT and show prompt entry, Send and generation')
      assert.equal(sample.sampleEdit.clicks.length, capture.actions.length, 'Quiz sample: mark every recorded click')
      assert(capture.actions.every(action => Number.isFinite(action.click?.x) && Number.isFinite(action.click?.y)), 'Quiz sample: use actual captured click coordinates')
      assert(sample.sampleEdit.clicks.every(click => click.seconds >= 0 && click.seconds < clip.durationSeconds && click.x >= 0 && click.x < 1440 && click.y >= 56 && click.y < 900), 'Quiz sample: keep click markers inside the recording and its timeline')
      assert(capture.frames.length >= 100 && capture.actions.length >= 10, 'Quiz sample: preserve the full three-question interaction and retry')
      assert(sample.sampleEdit.maxTrackingError < .08 && sample.sampleEdit.cropMarginPixels >= 24, 'Quiz sample: track the complete card and retain a safe border')
      assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'public', clip.src))).digest('hex'), clip.sha256, 'Quiz sample: the actual video must match its provenance')
      assert(fs.existsSync(path.join(root, 'public', sample.previousDelivery.src)), 'Quiz sample: retain the previous video for comparison')
    } else {
      assert(capture.newChat && capture.temporaryChat && clip.temporaryChat, `${clip.command}: use a fresh temporary chat`)
      assert.equal(capture.initialMessageCount, 0, `${clip.command}: begin with an empty chat`)
      assert.equal(capture.userMessageCount, 2, `${clip.command}: upload the PDF first and send the shortcut second`)
      assert(clip.setupPrompt && clip.transcript.includes(clip.setupPrompt), `${clip.command}: preserve the PDF setup request`)
    }
    assert.equal(capture.interfaceLanguage, 'en', `${clip.command}: record the English interface`)
    assert.equal(clip.interfaceLanguage, 'en', `${clip.command}: identify the interface language`)
    assert.equal(clip.transcript, fs.readFileSync(path.join(root, 'public', clip.transcriptFile), 'utf8'), `${clip.command}: keep the downloadable transcript consistent with the slide`)
    assert(clip.durationSeconds - clip.chapters.find(chapter => chapter.label === 'Use').seconds >= 39.999, `${clip.command}: demonstrate at least forty seconds of normal-speed use`)
    assert(capture.phases?.filter(phase => ['widget', 'usage'].includes(phase.name)).every(phase => phase.speed === 1), `${clip.command}: never accelerate widget use`)
  }
  for (const duplicate of selection.removedDuplicateSlides) {
    assert(!slides.some(slide => slide.id === duplicate.id), `${duplicate.id}: omit the repeated demonstration`)
    assert(slides.some(slide => slide.id === duplicate.replacedBy && slide.media?.type === 'video'), `${duplicate.id}: retain its original recorded example once`)
  }
  for (const example of slides.filter(slide => slide.kind === 'shortcut-example')) {
    const label = example.prompt?.match(/^\/\S+/)?.[0]
    assert(commands.includes(label), `${example.id}: remove examples that only produced static output`)
  }
  assert.equal(new Set(commands).size, commands.length, 'Informal shortcuts must not be duplicated')
  const skillResearch = read('data/catalogues/skills-research.json')
  const skillDemos = read('data/demos/skill-demos.json')
  const skillClips = read('public/materials/skills/provenance.json')
  const skillIds = slides.flatMap(slide => slide.skillIds || [])
  assert.equal(skillIds.length, 4, 'The four selected chapter workflows must be available in the deck')
  assert.equal(new Set(skillIds).size, skillIds.length, 'Each selected skill must appear once in the catalogue')
  for (const id of skillIds) assert(skillResearch.skills.some(skill => skill.id === id), `${id}: selected skill is missing from the research catalogue`)
  for (const id of skillIds) checkStudyFocus(skillResearch.skills.find(skill => skill.id === id).studyPhases, id)
  assert.deepEqual([...skillIds].sort(), skillDemos.map(demo => demo.key).sort(), 'Each selected skill needs its own chapter demonstration')
  assert.deepEqual(skillClips.clips.map(clip => clip.key), skillDemos.map(demo => demo.key))
  assert.equal(skillClips.sourceBook.sha256, createHash('sha256').update(fs.readFileSync(path.join(root, 'public', skillClips.sourceBook.path))).digest('hex'), 'Recordings must identify the exact workshop book')
  for (const demo of skillDemos) {
    const clip = skillClips.clips.find(item => item.key === demo.key)
    const slide = slides.find(item => item.id === demo.slideId)
    if (checkReleasedMedia(slide?.media, publishedRecordings)) {
      assert.equal(slide.kind, 'tool-demo')
      assert(slide.sources.includes('BOOK_CHAPTER'), `${demo.key}: keep the example on the assigned book`)
      continue
    }
    assert(demo.accepted && demo.status === 'executed' && clip?.status === 'executed', `${demo.key}: finish the web test before publication`)
    assert.equal(clip.browser, '@Browser')
    assert.equal(clip.width, 1440, `${demo.key}: use the common video width`)
    assert.equal(clip.height, 900, `${demo.key}: use the common video height`)
    assert.equal(slide?.kind, 'tool-demo')
    assert.equal(slide.prompt, demo.prompt, `${demo.key}: preserve the original request`)
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
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S50LEGEND') + 1]?.id, 'S50CHECKIN')
  assert.equal(slides[slides.findIndex(slide => slide.id === 'S51') - 1]?.id, 'S50CHECKIN')
  const notebookDemos = read('data/demos/notebook-demos.json')
  const notebookClips = read('public/materials/notebook/provenance.json').clips
  assert.deepEqual(notebookClips.map(clip => clip.key), notebookDemos.map(demo => demo.key), 'Every NotebookLM demonstration needs its recorded clip')
  for (const demo of notebookDemos) {
    const slide = slides.find(item => item.id === demo.slideId)
    const clip = notebookClips.find(item => item.key === demo.key)
    if (checkNativeVideoExport(slide?.media)) {
      assert.equal(slide.kind, 'tool-demo')
      continue
    }
    if (checkReleasedMedia(slide?.media, publishedRecordings)) {
      assert.equal(slide.kind, 'tool-demo')
      continue
    }
    assert(['executed', 'opened'].includes(demo.status), `${demo.key}: finish recording before publishing`)
    assert.equal(clip.status, demo.status, `${demo.key}: preserve the observed execution scope`)
    assert.equal(clip.browser, '@Browser', `${demo.key}: use only the fresh Browser recording`)
    assert.equal(slide?.kind, 'tool-demo', `${demo.key}: provide a dedicated video slide`)
    assert.equal(slide.media?.src, `materials/notebook/${demo.key}.mp4`)
    assert(clip.scenes.length >= 2 && clip.captureFrameCount >= 12 && clip.durationSeconds > 0, `${demo.key}: show recorded actions and their result`)
    for (const field of ['src', 'poster', 'captions']) assert(fs.existsSync(path.join(root, 'public', slide.media[field])), `${demo.key}: missing ${field}`)
    assert.equal(slide.media.transcript, fs.readFileSync(path.join(root, 'public/materials/notebook', `${demo.key}-transcript.txt`), 'utf8'))
  }
  const teacherVideos = read('public/materials/teacher-tools/provenance.json')
  const teacherGuide = fs.readFileSync(path.join(root, 'public/materials/teacher-tools.html'), 'utf8')
  assert.equal(teacherVideos.clips.length, 6, 'Keep all six recorded teacher-tool workflows available')
  assert.equal(new Set(teacherVideos.clips.map(clip => clip.key)).size, 6, 'Teacher recordings must be distinct')
  for (const clip of teacherVideos.clips) {
    if (checkReleasedMedia(clip, publishedRecordings)) {
      assert(teacherGuide.includes(`id="${clip.key}"`), `${clip.key}: keep its result in the guide`)
      continue
    }
    assert.equal(clip.browser, '@Browser')
    assert.equal(clip.status, 'executed')
    assert(clip.captureFrameCount >= 12 && clip.durationSeconds > 8, `${clip.key}: preserve actual recorded actions`)
    assert.deepEqual([clip.width, clip.height], [1440, 900])
    for (const field of ['src', 'poster', 'captions', 'transcriptFile']) {
      assert(fs.existsSync(path.join(root, 'public', clip[field])), `${clip.key}: missing ${field}`)
    }
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'public', clip.src))).digest('hex'), clip.videoSha256, `${clip.key}: video must match its recorded provenance`)
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'public', clip.poster))).digest('hex'), clip.posterSha256, `${clip.key}: poster must match its recorded provenance`)
    assert(teacherGuide.includes(`id="${clip.key}"`), `${clip.key}: keep the full recording in the accessible guide`)
    if (clip.slideId) {
      const slide = slides.find(item => item.id === clip.slideId)
      if (slide) {
        assert.equal(slide.media?.src, clip.src, `${clip.key}: attach the correct recording to its slide`)
        assert.equal(slide.media.transcript, fs.readFileSync(path.join(root, 'public', clip.transcriptFile), 'utf8'))
      }
    }
  }
  const selectedVideoCount = retained.filter(run => shortcutVideos.some(clip => clip.command === run.command)).length
  console.log(`Content checks passed: ${slides.length} ordered slides with English presenter notes, separate Study and Read aloud actions, ${retained.length} selected shortcuts (${selectedVideoCount} videos and ${retained.length - selectedVideoCount} fresh interaction checks), references and QR.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkData()
