import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const clip = command => ({ command, prompt: 'Recall the chapter.', src: 'clip.mp4', alt: 'Recorded task', width: 1440, height: 900, durationSeconds: 60, sha256: command, transcriptFile: `materials/${command.slice(1)}.txt` })
const clips = [clip('/quiz'), clip('/flashcard')]
const assets = { assetUrl: path => `/deck/${path.replace(/^\//, '')}` }
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

async function evaluate(source, dependencies, globals = {}) {
  const context = createContext({ console, AbortController, DOMException, ...globals })
  const module = new SourceTextModule(stripTypeScriptTypes(source, { mode: 'strip' }), { context })
  await module.link(specifier => {
    const values = dependencies[specifier]
    assert.ok(values, `Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return module.namespace
}

const transcriptModule = fetch => read('utils/shortcut-videos.ts').then(source => evaluate(source, {
  '../data/generated/shortcut-videos.json': { default: clips },
  './assets': assets,
}, { fetch }))

test('clip metadata requires no transcript request; successful transcripts are cached', async () => {
  let requests = 0
  const api = await transcriptModule(async url => {
    requests++
    assert.equal(url, '/deck/materials/quiz.txt')
    return { ok: true, text: async () => 'Actual transcript' }
  })
  const selected = api.getShortcutVideo('/QUIZ')
  assert.equal(requests, 0)
  assert.equal(await api.loadShortcutTranscript(selected), 'Actual transcript')
  assert.equal(await api.loadShortcutTranscript(selected), 'Actual transcript')
  assert.equal(requests, 1)
})

test('failed transcript requests can be retried', async () => {
  let requests = 0
  const api = await transcriptModule(async () => ++requests === 1
    ? { ok: false, status: 503 }
    : { ok: true, text: async () => 'Recovered transcript' })
  await assert.rejects(api.loadShortcutTranscript(clips[0]), /503/)
  assert.equal(await api.loadShortcutTranscript(clips[0]), 'Recovered transcript')
  assert.equal(requests, 2)
})

test('aborted responses never populate the transcript cache', async () => {
  let requests = 0
  const controller = new AbortController()
  const api = await transcriptModule(async () => ({ ok: true, text: async () => {
    requests++
    if (requests === 1) controller.abort()
    return 'Actual transcript'
  } }))
  await assert.rejects(api.loadShortcutTranscript(clips[0], controller.signal), { name: 'AbortError' })
  assert.equal(await api.loadShortcutTranscript(clips[0]), 'Actual transcript')
  assert.equal(requests, 2)
})

test('the playback lifecycle pauses on navigation, hidden pages and disposal', async () => {
  const currentSlideNo = vue.ref(1), isPrintMode = vue.ref(false), visible = vue.ref(true)
  let pauses = 0, departures = 0
  const api = await evaluate(await read('composables/useSlideVideo.ts'), {
    '@slidev/client': { useNav: () => ({ currentSlideNo, isPrintMode }) },
    vue,
    './useDocumentVisibility': { useDocumentVisibility: () => visible },
  })
  const scope = vue.effectScope()
  scope.run(() => api.useSlideVideo(vue.ref({ pause: () => pauses++ }), () => departures++))
  currentSlideNo.value = 2
  await vue.nextTick()
  visible.value = false
  await vue.nextTick()
  visible.value = true
  await vue.nextTick()
  assert.equal(pauses, 2)
  isPrintMode.value = true
  await vue.nextTick()
  scope.stop()
  assert.equal(pauses, 4)
  assert.equal(departures, 4)
})

async function dialogHarness(loader) {
  const { descriptor } = parse(await read('components/media/PromptVideoDialog.vue'))
  const compiled = compileScript(descriptor, { id: 'video-dialog-test' })
  let leave
  const api = await evaluate(compiled.content, {
    vue: { ...vue, useId: () => 'test-dialog' },
    '../../composables/useSlideVideo': { useSlideVideo: (_video, close) => { leave = close } },
    '../../utils/assets': assets,
    '../../utils/shortcut-videos': { getShortcutVideo: command => clips.find(c => c.command === command), loadShortcutTranscript: loader },
    '../shared/CommandTag.vue': { default: {} },
    '../shared/PromptBlock.vue': { default: {} },
    '../shared/RecordingResultLinks.vue': { default: {} },
  })
  const scope = vue.effectScope()
  const state = scope.run(() => api.default.setup({}, { expose() {} }))
  let plays = 0, pauses = 0
  state.video.value = { pause() { pauses++ }, play() { plays++; return Promise.resolve() } }
  state.dialog.value = { open: false, showModal() { this.open = true }, close() { this.open = false } }
  return { state, scope, leave: () => leave(), plays: () => plays, pauses: () => pauses }
}

test('opening a dialog plays the selected clip, but fetch waits for transcript expansion', async () => {
  let requests = 0
  const harness = await dialogHarness(async () => { requests++; return 'Transcript' })
  const { state, scope } = harness
  await state.open('/quiz')
  assert.equal(state.dialog.value.open, true)
  assert.equal(harness.plays(), 1)
  assert.equal(requests, 0)
  state.onTranscriptToggle({ currentTarget: { open: false } })
  assert.equal(requests, 0)
  state.onTranscriptToggle({ currentTarget: { open: true } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(state.transcriptText.value, 'Transcript')
  assert.equal(requests, 1)
  scope.stop()
})

test('closing a dialog aborts its transcript and ignores a late response', async () => {
  let resolve, signal
  const harness = await dialogHarness((_clip, requestSignal) => {
    signal = requestSignal
    return new Promise(done => { resolve = done })
  })
  await harness.state.open('/quiz')
  const pending = harness.state.loadTranscript()
  harness.leave()
  assert.equal(signal.aborted, true)
  assert.equal(harness.state.dialog.value.open, false)
  resolve('Stale transcript')
  await pending
  assert.equal(harness.state.selected.value, undefined)
  assert.equal(harness.state.transcriptText.value, '')
  harness.scope.stop()
})

test('switching recordings pauses the old video and ignores its pending transcript', async () => {
  const requests = []
  const harness = await dialogHarness((clip, signal) => new Promise(resolve => requests.push({ clip, signal, resolve })))
  await harness.state.open('/quiz')
  const oldRequest = harness.state.loadTranscript()
  const pauses = harness.pauses()
  await harness.state.open('/flashcard')
  assert.equal(harness.pauses(), pauses + 1)
  assert.equal(requests[0].signal.aborted, true)
  const nextRequest = harness.state.loadTranscript()
  requests[0].resolve('Old clip transcript')
  await oldRequest
  assert.equal(harness.state.transcriptText.value, '')
  requests[1].resolve('New clip transcript')
  await nextRequest
  assert.equal(harness.state.transcriptText.value, 'New clip transcript')
  harness.scope.stop()
})

test('the dialog exposes a recoverable transcript error and clears it on retry', async () => {
  let requests = 0
  const harness = await dialogHarness(async () => {
    if (++requests === 1) throw new Error('Offline')
    return 'Recovered transcript'
  })
  await harness.state.open('/quiz')
  await harness.state.loadTranscript()
  assert.equal(harness.state.transcriptError.value, true)
  await harness.state.loadTranscript()
  assert.equal(harness.state.transcriptError.value, false)
  assert.equal(harness.state.transcriptText.value, 'Recovered transcript')
  harness.scope.stop()
})
