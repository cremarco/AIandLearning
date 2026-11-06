// Import only from cua_repl. All interaction uses its documented CUA handles.
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { makeRecorder } from './browser-screencast.mjs'

const bookPath = fileURLToPath(new URL('../../public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf', import.meta.url))
const book = { path: 'public/materials/booklet-genai/Fondamenti_GenAI_Cremaschi.pdf', sha256: 'f8131615212f15aeb864847af774fc79184d22b1193bb5e5c5b99147aa7c9981' }
const setupPrompt = 'Use the attached chapter as the only source for the next activity. Please wait for my next request.'

export async function createIsolatedSession(cua, root) {
  const plan = JSON.parse(await fs.readFile(root + '/plan.json', 'utf8'))
  let tab, cdp, rec, key
  const response = id => tab.playwright.locator('[data-chatgpt-selection-message-id="' + id + '"]')
  async function bind(handle, recordingKey) {
    tab = handle
    key = recordingKey
    cdp = await tab.capabilities.get('cdp')
    await cdp.documentation()
    rec = makeRecorder(tab, cdp, root)
  }
  async function latest() {
    return tab.playwright.evaluate(() => {
      const e = Array.from(document.querySelectorAll('[data-chatgpt-selection-message-id]')).at(-1)
      return e ? { id: e.getAttribute('data-chatgpt-selection-message-id'), heading: e.querySelector('h1,h2,h3')?.textContent,
        text: e.innerText.slice(0, 1600), controls: Array.from(e.querySelectorAll('button,input,textarea,select')).map(n => ({
          tag: n.tagName, role: n.getAttribute('role'), label: n.getAttribute('aria-label'), placeholder: n.getAttribute('placeholder'), text: n.textContent })) } : null
    })
  }
  async function position(locator, top = 90) {
    const rect = await locator.evaluate(e => e.getBoundingClientRect().toJSON())
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 1120, y: 320, deltaX: 0, deltaY: rect.top - top })
    await tab.getAXState({ emit: false })
  }
  async function waitForResponses(count, maxMs = 25000) {
    const deadline = Date.now() + maxMs
    while (Date.now() < deadline) {
      if (await tab.playwright.getByRole('button', { name: 'Regenerate response', exact: true }).count() >= count) return
      await rec.pause(500)
    }
  }
  async function start(recordingKey) {
    const clip = plan.clips.find(c => c.key === recordingKey)
    await bind(await cua.createBrowserTab('iab', 'https://chatgpt.com/?temporary-chat=true', { visible: false }), recordingKey)
    await tab.playwright.getByRole('button', { name: 'Add files and more', exact: true }).waitFor({ state: 'visible' })
    await tab.getAXState({ emit: false })
    await rec.begin(key, clip.command, clip.prompt, { firstPhase: 'upload', firstCaption: 'Open a new temporary chat and upload the chapter PDF.' })
    try {
      const count = await tab.playwright.getByRole('heading', { name: 'You said:', exact: true }).count()
      if (count !== 0) throw new Error('Expected a new empty chat')
      await rec.annotate({ newChat: true, temporaryChat: true, interfaceLanguage: 'en', initialMessageCount: count,
        setupPrompt, book, sourceViewport: { width: 1280, height: 720, deviceScaleFactor: 2 }, nativeCrop: { x: 528, y: 96, width: 1664, height: 1040 } })
      await tab.playwright.getByRole('button', { name: 'Add files and more', exact: true }).click()
      await tab.getAXState({ emit: false })
      const pick = tab.playwright.waitForEvent('filechooser', { timeoutMs: 10000 })
      await tab.playwright.getByRole('button', { name: 'Add photos & files Upload from computer', exact: true }).click()
      await (await pick).setFiles([bookPath])
      await tab.getAXState({ emit: false })
      await rec.type(tab.playwright.getByRole('textbox', { name: 'Ask ChatGPT', exact: true }), setupPrompt)
      await tab.getAXState({ emit: false })
      await rec.pause(1000)
      await tab.playwright.getByRole('button', { name: 'Send', exact: true }).click()
      await tab.getAXState({ emit: false })
      await rec.phase('setup-generation', 'ChatGPT reads the uploaded chapter · accelerated.', 8)
      await rec.pause(3000)
      await waitForResponses(1, 18000)
      await rec.annotate({ conversationUrl: await tab.url(), setupResponse: await latest() })
    } finally { await rec.suspend() }
    return { key, tabId: tab.id, setup: await latest() }
  }
  async function attach(tabId, recordingKey) {
    await bind(await cua.getTab(tabId, { browser: 'iab' }), recordingKey)
    return { key, tabId: tab.id, current: await latest() }
  }
  async function request() {
    await rec.resume(key)
    try {
      await waitForResponses(1, 12000)
      await rec.phase('typing', 'Write the shortcut request as the second message.', 1)
      await rec.type(tab.playwright.getByRole('textbox', { name: 'Ask ChatGPT', exact: true }), rec.current().prompt)
      await tab.getAXState({ emit: false })
      await rec.pause(1300)
      await rec.phase('send', 'Send the shortcut as the second message.', 1)
      await tab.playwright.getByRole('button', { name: 'Send', exact: true }).click()
      await tab.getAXState({ emit: false })
      await rec.phase('generation', 'ChatGPT generates the widget · accelerated.', 8)
      await rec.pause(3000)
      await waitForResponses(2, 30000)
      await tab.getAXState({ emit: false })
    } finally { await rec.suspend() }
    return { key, tabId: tab.id, result: await latest() }
  }
  async function use(callback, finish = false) {
    await rec.resume(key)
    try {
      const info = await latest()
      if (!rec.current().phases.some(p => p.name === 'widget')) {
        await rec.phase('widget', 'Inspect the generated widget before using its controls.', 1)
        await position(info.heading ? response(info.id).getByRole('heading', { name: info.heading, exact: true }).first() : response(info.id))
        await rec.pause(3500)
        await rec.phase('usage', 'Use the widget at normal speed.', 1)
      }
      await callback({ tab, cdp, rec, widget: response(info.id), position, info })
      if (finish) {
        const result = await rec.finish({ responseId: info.id, text: await response(info.id).innerText(),
          state: await tab.getAXState({ emit: false }), userMessageCount: await tab.playwright.getByRole('heading', { name: 'You said:', exact: true }).count() })
        return { key, tabId: tab.id, actions: result.actions.length, frames: result.frames }
      }
      await rec.suspend()
      return { key, tabId: tab.id, current: await latest() }
    } catch (error) { await rec.suspend(); throw error }
  }
  return { start, attach, request, use, latest, get tab() { return tab }, get recorder() { return rec } }
}
