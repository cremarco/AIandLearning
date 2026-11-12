import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { narrationClickAt } from '../utils/narration-reveals.mjs'

const clip = command => ({ command, prompt: 'Recall the chapter.', src: 'clip.mp4', alt: 'Recorded task', width: 1440, height: 900, durationSeconds: 60, sha256: command, transcriptFile: `materials/${command.slice(1)}.txt` })
const clips = [clip('/quiz'), clip('/flashcard')]
const assets = { assetUrl: path => `/deck/${path.replace(/^\//, '')}` }
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

async function evaluate(source, dependencies, globals = {}, env = {}) {
  const context = createContext({ console, AbortController, DOMException, URL, ...globals })
  const module = new SourceTextModule(stripTypeScriptTypes(source, { mode: 'strip' }), { context, initializeImportMeta(meta) { meta.env = env } })
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
    '@slidev/client': { useNav: () => ({ currentSlideNo, isPrintMode, currentRoute: vue.ref({ name: 'print' }) }), useSlideContext: () => undefined },
    vue,
    './useDocumentVisibility': { useDocumentVisibility: () => visible },
    '../utils/presenter-media': { connectPresenterMedia() {}, mediaPlaybackIssue: vue.shallowRef() },
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

const settle = async () => { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }

test('narration controls reveal timing, pause, manual advance and restart only on the active slide', async () => {
  const currentSlideNo = vue.ref(12), clicks = vue.ref(3), enabled = vue.ref(true), playing = vue.ref(false)
  const audio = vue.shallowRef({ currentTime: 0 }), frames = new Map(), calls = []
  let frame = 0
  const api = await evaluate(await read('composables/useNarrationReveals.ts'), {
    vue,
    '@slidev/client': { useNav: () => ({ currentSlideNo, clicks, async go(page, click) { calls.push([page, click]); clicks.value = click } }) },
    '../utils/narration-reveals.mjs': { narrationClickAt },
  }, {
    requestAnimationFrame(callback) { frames.set(++frame, callback); return frame },
    cancelAnimationFrame(id) { frames.delete(id) },
  })
  const scope = vue.effectScope()
  const controller = scope.run(() => api.useNarrationReveals({ audio, enabled, playing, page: vue.ref(12),
    reveals: vue.ref([{ click: 1, time: 8.16 }, { click: 2, time: 13.3 }, { click: 3, time: 18.74 }]),
  }))
  const tick = async time => {
    audio.value.currentTime = time
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback())
    await settle()
  }
  try {
    await controller.syncReveals(true)
    assert.equal(clicks.value, 0, 'Play from the beginning hides previously revealed content')
    playing.value = true
    await tick(8.159); assert.equal(clicks.value, 0)
    await tick(8.16); assert.equal(clicks.value, 1)
    playing.value = false
    await tick(14); assert.equal(clicks.value, 1, 'Pausing cancels the animation clock')
    audio.value.currentTime = 10
    clicks.value = 3
    playing.value = true
    await tick(10); assert.equal(clicks.value, 3, 'Manual advances remain visible')
    await controller.syncReveals(true)
    assert.equal(clicks.value, 1, 'Seeking back restores the corresponding reveal')
    await tick(13.3); assert.equal(clicks.value, 2)
    await tick(18.74); assert.equal(clicks.value, 3)
    audio.value.currentTime = 0
    await controller.syncReveals(true)
    assert.equal(clicks.value, 0)
    const before = calls.length
    currentSlideNo.value = 13
    await tick(30)
    assert.equal(calls.length, before, 'A preloaded or departed slide cannot navigate')
    enabled.value = false
    assert.equal(frames.size, 0)
    currentSlideNo.value = 12
    await controller.syncReveals(true)
    assert.equal(calls.length, before, 'Disabled synchronization leaves manual navigation intact')
    assert(calls.every(([page]) => page === 12))
  } finally { scope.stop() }
  assert.equal(frames.size, 0)
})

class TestMedia extends EventTarget {
  constructor(source = 'https://deck.test/demo.mp4') {
    super()
    Object.assign(this, { src: source, currentTime: 0, paused: true, muted: false, playbackRate: 1, duration: 120, readyState: 4, loads: 0, plays: 0, denyPlay: false })
  }
  querySelector() { return { src: this.src } }
  emit(type) { this.dispatchEvent(new Event(type)) }
  load() { this.loads++ }
  play() {
    this.plays++
    if (this.denyPlay) return Promise.reject(new DOMException('User activation required', 'NotAllowedError'))
    this.paused = false
    this.emit('play')
    return Promise.resolve()
  }
  pause() {
    if (this.paused) return
    this.paused = true
    this.emit('pause')
  }
}

test('narration and demonstration take turns without resetting playback or affecting other slides', async () => {
  const api = await evaluate(await read('utils/narration-playback.ts'), { vue })
  const narration = new TestMedia(), podcast = new TestMedia(), video = new TestMedia(), otherSlide = new TestMedia()
  const slide = { querySelectorAll: () => [narration, podcast, video] }
  podcast.currentTime = 85
  await podcast.play(); await video.play(); await otherSlide.play(); await narration.play()
  api.pauseCompetingMedia(slide, narration)
  assert.equal(narration.paused, false)
  assert.equal(podcast.paused, true)
  assert.equal(video.paused, true)
  assert.equal(podcast.currentTime, 85, 'Switching to commentary preserves the demonstration position')
  assert.equal(otherSlide.paused, false, 'Only media inside the current slide participates')
  narration.currentTime = 12
  await podcast.play()
  api.pauseCompetingMedia(slide, podcast)
  assert.equal(narration.paused, true)
  assert.equal(narration.currentTime, 12)
  assert.equal(podcast.paused, false)
})

test('a narrated illustration follows the audio clock, freezes on pause and rewinds with audio; English animation stays independent', async () => {
  const frames = new Map(), scopes = []
  let frame = 0
  const api = await evaluate(await read('composables/useNarrationAnimation.ts'), { vue }, {
    requestAnimationFrame(callback) { frames.set(++frame, callback); return frame },
    cancelAnimationFrame(id) { frames.delete(id) },
  })
  async function create(enabled) {
    const media = new TestMedia(); media.duration = 20
    const playback = { enabled: vue.ref(enabled), audio: vue.shallowRef(media), playing: vue.ref(false) }
    const active = vue.ref(true), progress = []
    const animation = { currentTime: 0, pauses: 0, pause() { this.pauses++ } }
    const scope = vue.effectScope(); scopes.push(scope)
    scope.run(() => api.useNarrationAnimation({ playback, active, animations: () => [animation],
      duration: () => 1000, onProgress: value => progress.push(value),
    }))
    await settle()
    return { media, playback, active, animation, progress, scope }
  }
  try {
    const h = await create(true)
    assert.equal(h.animation.currentTime, 0, 'The illustration waits for narrated playback')
    h.playback.playing.value = true
    await settle()
    h.media.currentTime = 10
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback())
    assert.equal(h.animation.currentTime, 500)
    assert.equal(h.progress.at(-1), .5)
    h.playback.playing.value = false
    await settle()
    assert.equal(frames.size, 0)
    assert.equal(h.animation.currentTime, 500)
    h.media.currentTime = 3; h.media.emit('seeked')
    assert.equal(h.animation.currentTime, 150, 'A paused seek updates the illustration immediately')
    h.media.currentTime = 20; h.media.emit('ended')
    assert.equal(h.animation.currentTime, 1000)
    h.media.currentTime = 0; h.media.emit('seeked')
    assert.equal(h.animation.currentTime, 0, 'Restart rewinds the book as well as the narration')
    h.active.value = false
    h.playback.playing.value = true
    await settle()
    assert.equal(frames.size, 0, 'Off-slide illustrations never schedule playback')
    h.scope.stop()
    const count = h.animation.pauses
    h.media.currentTime = 12; h.media.emit('seeked')
    assert.equal(h.animation.pauses, count, 'Leaving releases audio event listeners')
    const english = await create(false)
    english.playback.playing.value = true
    english.media.currentTime = 10; english.media.emit('timeupdate')
    await settle()
    assert.equal(english.animation.pauses, 0)
    assert.equal(english.animation.currentTime, 0)
    assert.equal(frames.size, 0)
  } finally { scopes.forEach(scope => scope.stop()) }
})

async function playbackHarnesses() {
  const listeners = new Set(), messages = [], scopes = [], frames = new Map()
  let frameId = 0
  const source = await read('composables/useSlideVideo.ts')
  async function create(role, page = 1, media = new TestMedia()) {
    const currentSlideNo = vue.ref(1), isPrintMode = vue.ref(false), visible = vue.ref(true)
    const issue = vue.shallowRef(), video = vue.shallowRef()
    const api = await evaluate(source, {
      vue,
      '@slidev/client': {
        useNav: () => ({ currentSlideNo, isPrintMode, currentRoute: vue.ref({ name: role === 'presenter' ? 'presenter' : 'play' }) }),
        useSlideContext: () => ({ $page: vue.ref(page), $renderContext: vue.ref(role) }),
      },
      './useDocumentVisibility': { useDocumentVisibility: () => visible },
      '../utils/presenter-media': {
        mediaPlaybackIssue: issue,
        connectPresenterMedia(receive) {
          listeners.add(receive)
          return {
            send(message) {
              messages.push({ role, ...message })
              for (const listener of listeners) if (listener !== receive) queueMicrotask(() => { if (listeners.has(listener)) listener(message) })
            },
            close() { listeners.delete(receive) },
          }
        },
      },
    }, {
      requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId },
      cancelAnimationFrame(id) { frames.delete(id) },
    })
    const scope = vue.effectScope()
    scope.run(() => api.useSlideVideo(video))
    scopes.push(scope)
    video.value = media
    await settle()
    return { media, video, currentSlideNo, isPrintMode, visible, issue, scope }
  }
  return {
    create, messages, listeners, frames,
    async paint() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); await settle() },
    close: () => scopes.forEach(scope => scope.stop()),
  }
}

class FrameMedia extends TestMedia {
  constructor() {
    super()
    Object.assign(this, { tagName: 'VIDEO', seeking: false, played: { length: 1 }, frameRefreshes: 0 })
    let time = 12
    Object.defineProperty(this, 'currentTime', {
      get: () => time,
      set: value => {
        time = value
        this.frameRefreshes++
        queueMicrotask(() => { this.emit('timeupdate'); this.emit('seeked') })
      },
    })
  }
}

test('returning to a tab redraws its paused frame without Play, reload or remote seek commands', async () => {
  const h = await playbackHarnesses()
  try {
    const media = new FrameMedia(), presenter = await h.create('presenter', 1, media)
    await media.play()
    presenter.visible.value = false
    await settle()
    assert.equal(media.paused, true)
    const messages = h.messages.length
    presenter.visible.value = true
    await settle()
    assert.equal(media.frameRefreshes, 0, 'Wait until the visible tab can paint')
    await h.paint()
    assert.equal(media.frameRefreshes, 1)
    assert.equal(media.currentTime, 12)
    assert.equal(media.paused, true)
    assert.equal(media.plays, 1, 'Frame recovery must not call Play')
    assert.equal(media.loads, 0, 'Frame recovery must not reload the source')
    assert.equal(h.messages.length, messages, 'A local repaint must not seek the audience player')
  } finally { h.close() }
})

test('frame recovery leaves unplayed posters alone and cancels when navigating away', async () => {
  const h = await playbackHarnesses()
  try {
    const media = new FrameMedia(), presenter = await h.create('presenter', 1, media)
    media.currentTime = 0
    media.played.length = 0
    await settle()
    const refreshes = media.frameRefreshes
    presenter.visible.value = false
    await settle()
    presenter.visible.value = true
    await settle()
    await h.paint()
    assert.equal(media.frameRefreshes, refreshes)
    media.played.length = 1
    presenter.visible.value = false
    await settle()
    presenter.visible.value = true
    await settle()
    assert.equal(h.frames.size, 1)
    presenter.currentSlideNo.value = 2
    await settle()
    assert.equal(h.frames.size, 0)
    await h.paint()
    assert.equal(media.frameRefreshes, refreshes)
  } finally { h.close() }
})

test('presenter Play, Pause, seeking and speed reach the audience with audio only there', async () => {
  const h = await playbackHarnesses()
  try {
    const presenter = await h.create('presenter'), audience = await h.create('slide')
    const next = await h.create('previewNext'), preloaded = await h.create('slide', 2)
    assert.equal(presenter.media.muted, true)
    assert.equal(audience.media.muted, false)
    presenter.media.currentTime = 12
    presenter.media.playbackRate = 1.5
    await presenter.media.play()
    await settle()
    assert.equal(audience.media.paused, false)
    assert.ok(Math.abs(audience.media.currentTime - 12) < 0.1)
    assert.equal(audience.media.playbackRate, 1.5)
    assert.equal(next.media.paused, true)
    assert.equal(preloaded.media.paused, true)
    presenter.media.currentTime = 42
    presenter.media.emit('seeked')
    await settle()
    assert.ok(Math.abs(audience.media.currentTime - 42) < 0.1)
    presenter.media.pause()
    await settle()
    assert.equal(audience.media.paused, true)
    assert.equal(h.messages.filter(m => m.role === 'slide' && m.type === 'playback').length, 0, 'Audience changes cannot echo back into the presenter')
    presenter.media.muted = false
    presenter.media.emit('volumechange')
    assert.equal(presenter.media.muted, true)
    await next.media.play()
    assert.equal(next.media.paused, true, 'Preview playback is disabled')
  } finally { h.close() }
  assert.equal(h.listeners.size, 0)
})

test('a late audience catches up and pending commands wait for metadata without restarting loads', async () => {
  const h = await playbackHarnesses()
  try {
    const presenter = await h.create('presenter')
    presenter.media.currentTime = 25
    await presenter.media.play()
    const media = new TestMedia()
    media.readyState = 0
    const audience = await h.create('slide', 1, media)
    assert.equal(media.loads, 1)
    presenter.media.emit('seeked')
    await settle()
    assert.equal(media.loads, 1)
    media.readyState = 4
    media.emit('loadedmetadata')
    await settle()
    assert.equal(media.paused, false)
    assert.ok(Math.abs(media.currentTime - 25) < 0.1)
    audience.currentSlideNo.value = 2
    await settle()
    presenter.media.currentTime = 60
    presenter.media.emit('seeked')
    await settle()
    assert.equal(media.paused, true)
    assert.ok(media.currentTime < 26, 'Media on a departed slide ignores late commands')
  } finally { h.close() }
})

test('browser playback rejection is visible in both windows and can be retried', async () => {
  const h = await playbackHarnesses()
  try {
    const presenter = await h.create('presenter'), audience = await h.create('slide')
    audience.media.denyPlay = true
    await presenter.media.play()
    await settle()
    assert.ok(audience.issue.value?.retry)
    assert.ok(presenter.issue.value)
    audience.media.denyPlay = false
    audience.issue.value.retry()
    await settle()
    assert.equal(audience.media.paused, false)
    assert.equal(audience.issue.value, undefined)
    assert.equal(presenter.issue.value, undefined)
    presenter.currentSlideNo.value = audience.currentSlideNo.value = 2
    await settle()
    assert.equal(presenter.media.paused, true)
    assert.equal(audience.media.paused, true)
  } finally { h.close() }
})

test('native media keyboard controls do not navigate slides or leave presenter mode', async () => {
  let focused = 'video', advances = 0, presenterChanges = 0
  class Element { matches(selector) { return selector.split(/,\s*/).includes(focused) } }
  const api = await evaluate(await read('setup/shortcuts.ts'), {
    '@slidev/types': { defineShortcutsSetup: setup => setup },
    '@slidev/client': { useNav: () => ({ isPresenter: vue.ref(true), exitPresenter() { presenterChanges++ } }) },
  }, { document: { activeElement: new Element() }, HTMLElement: Element })
  const base = ['next_space', 'prev_space', 'next', 'prev'].map(name => ({ name, key: name, fn() { advances++ } }))
  const shortcuts = api.default(undefined, base)
  for (const shortcut of shortcuts) shortcut.fn()
  assert.equal(advances, 0)
  assert.equal(presenterChanges, 0)
  focused = 'button'
  shortcuts[0].fn()
  assert.equal(advances, 0)
  focused = 'body'
  shortcuts[0].fn()
  assert.equal(advances, 1)
})

test('media transport shares one channel per deck and isolates EduForum from MRU', async () => {
  const channels = new Set()
  class Channel {
    constructor(name) { this.name = name; channels.add(this) }
    postMessage(data) { for (const peer of channels) if (peer !== this && peer.name === this.name) peer.onmessage?.({ data }) }
    close() { channels.delete(this) }
  }
  const source = await read('utils/presenter-media.ts')
  const create = (base, href) => evaluate(source, { vue }, { BroadcastChannel: Channel, window: { location: { href } } }, { BASE_URL: base })
  const presenter = await create('./', 'https://deck.test/eduforum/#/presenter/1')
  const audience = await create('./', 'https://deck.test/eduforum/#/1')
  const mru = await create('./', 'https://deck.test/mru/#/1')
  const received = [], wrongDeck = []
  const a = presenter.connectPresenterMedia(() => {})
  const b = audience.connectPresenterMedia(message => received.push(message))
  const c = audience.connectPresenterMedia(() => {})
  const d = mru.connectPresenterMedia(message => wrongDeck.push(message))
  assert.equal(channels.size, 3, 'A deck shares its channel across mounted players')
  a.send({ type: 'ready', page: 1, source: 'demo.mp4' })
  assert.equal(received.length, 1)
  assert.equal(wrongDeck.length, 0)
  b.close()
  assert.equal(channels.size, 3)
  c.close()
  assert.equal(channels.size, 2)
  a.close(); d.close()
  assert.equal(channels.size, 0)
})

async function dialogHarness(loader, role = 'print') {
  const { descriptor } = parse(await read('components/media/PromptVideoDialog.vue'))
  const compiled = compileScript(descriptor, { id: 'video-dialog-test' })
  let leave, receive
  const messages = []
  const api = await evaluate(compiled.content, {
    vue: { ...vue, useId: () => 'test-dialog' },
    '@slidev/client': {
      useNav: () => ({ currentSlideNo: vue.ref(1), isPrintMode: vue.ref(false), currentRoute: vue.ref({ name: role }) }),
      useSlideContext: () => ({ $page: vue.ref(1), $renderContext: vue.ref(role) }),
    },
    '../../composables/useSlideVideo': { useSlideVideo: (_video, close) => { leave = close } },
    '../../utils/assets': assets,
    '../../utils/slide-language': { useSlideLanguage: () => ({ t: text => text }) },
    '../../utils/shortcut-videos': { getShortcutVideo: command => clips.find(c => c.command === command), loadShortcutTranscript: loader },
    '../../utils/presenter-media': { connectPresenterMedia(callback) { receive = callback; return { send: message => messages.push(message), close() {} } } },
    '../shared/CommandTag.vue': { default: {} },
    '../shared/PromptBlock.vue': { default: {} },
    '../shared/RecordingResultLinks.vue': { default: {} },
    './MediaPlaybackStatus.vue': { default: {} },
  })
  const scope = vue.effectScope()
  const state = scope.run(() => api.default.setup({}, { expose() {} }))
  let plays = 0, pauses = 0
  state.video.value = { pause() { pauses++ }, play() { plays++; return Promise.resolve() } }
  state.dialog.value = { open: false, showModal() { this.open = true }, close() { this.open = false } }
  return { state, scope, leave: () => leave(), plays: () => plays, pauses: () => pauses, messages, receive: message => receive?.(message) }
}

test('shortcut dialogs open and close in the audience without independently autoplaying or fetching transcripts', async () => {
  const presenter = await dialogHarness(async () => assert.fail('Transcript should remain lazy'), 'presenter')
  const audience = await dialogHarness(async () => assert.fail('Transcript should remain lazy'), 'slide')
  try {
    await presenter.state.open('/quiz')
    assert.equal(presenter.messages.length, 1)
    audience.receive(presenter.messages[0])
    await settle()
    assert.equal(audience.state.dialog.value.open, true)
    assert.equal(audience.state.selected.value.command, '/quiz')
    assert.equal(audience.plays(), 0, 'Playback follows the presenter media command after the dialog is rendered')
    audience.receive({ ...presenter.messages[0], page: 2, command: '/flashcard' })
    assert.equal(audience.state.selected.value.command, '/quiz')
    presenter.state.close()
    audience.receive(presenter.messages.at(-1))
    assert.equal(audience.state.dialog.value.open, false)
    assert.equal(audience.state.selected.value, undefined)
    assert.equal(audience.messages.length, 0, 'Remote dialog actions do not echo back')
  } finally { presenter.scope.stop(); audience.scope.stop() }
})

test('the Next preview cannot open a shortcut dialog', async () => {
  const preview = await dialogHarness(async () => '', 'previewNext')
  await preview.state.open('/quiz')
  assert.equal(preview.state.dialog.value.open, false)
  assert.equal(preview.plays(), 0)
  preview.scope.stop()
})

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
