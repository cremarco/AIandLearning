// Used from cua_repl with its documented tab/CDP handles. No separate browser driver.
import fs from 'node:fs/promises'
import path from 'node:path'

export function makeRecorder(tab, cdp, root) {
  let capture, active, pump, pumpError
  let saving = Promise.resolve()
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  async function save() {
    const directory = path.join(root, capture.key)
    const content = JSON.stringify(capture, null, 2) + '\n'
    saving = saving.then(async () => {
      await fs.writeFile(path.join(directory, '.capture.tmp'), content)
      await fs.rename(path.join(directory, '.capture.tmp'), path.join(directory, 'capture.json'))
    })
    await saving
  }
  async function startPump() {
    const key = capture.key
    let cursor = (await cdp.readEvents({ methods: ['Page.screencastFrame'] })).cursor
    active = true
    pumpError = undefined
    await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
    pump = (async () => {
      while (active) {
        let batch
        try {
          batch = await cdp.readEvents({ methods: ['Page.screencastFrame'], afterSequence: cursor, limit: 100, timeoutMs: 250 })
        } catch (error) {
          if (/paused document response/i.test(error.message)) {
            await pause(150)
            continue
          }
          throw error
        }
        cursor = batch.cursor
        if (batch.truncated) capture.truncated = true
        for (const event of batch.events) {
          const file = String(capture.frames.length).padStart(6, '0') + '.png'
          await fs.writeFile(path.join(root, key, file), Buffer.from(event.params.data, 'base64'))
          capture.frames.push({ file, at: Math.round((event.params.metadata.timestamp * 1000) - capture.started), timestamp: event.params.metadata.timestamp, metadata: event.params.metadata })
          while (active) {
            try {
              await cdp.send('Page.screencastFrameAck', { sessionId: event.params.sessionId })
              break
            } catch (error) {
              if (!/paused document response/i.test(error.message)) throw error
              await pause(150)
            }
          }
        }
        if (batch.events.length) await save()
      }
    })().catch(error => { pumpError = error; active = false })
  }
  async function begin(key, command, prompt, options = {}) {
    await fs.mkdir(path.join(root, key), { recursive: true })
    capture = { key, command, prompt, conversationUrl: await tab.url(), startedAt: new Date().toISOString(), started: Date.now(), frames: [], phases: [], actions: [], complete: false }
    await startPump()
    await phase(options.firstPhase || 'typing', options.firstCaption || 'Write the prompt in ChatGPT.', 1)
  }
  async function annotate(values) {
    Object.assign(capture, values)
    await save()
    if (pumpError) throw pumpError
  }
  async function resume(key) {
    capture = JSON.parse(await fs.readFile(path.join(root, key, 'capture.json'), 'utf8'))
    await startPump()
  }
  async function suspend() {
    // Await this (or finish) before returning from a cua_repl cell. Detached
    // browser tool calls cannot safely outlive their active tool invocation.
    active = false
    await pump
    await cdp.send('Page.stopScreencast')
    await save()
    if (pumpError) throw pumpError
  }
  async function phase(name, caption, speed = 1) {
    capture.phases.push({ name, caption, speed, at: Date.now() - capture.started })
    await save()
  }
  async function step(label, fn, hold = 1800) {
    const at = Date.now() - capture.started
    await fn()
    const state = await tab.getAXState({ emit: false })
    capture.actions.push({ at, label, state })
    await save()
    await pause(hold)
  }
  async function type(locator, text) {
    await locator.fill('')
    await locator.click()
    for (let i = 0; i < text.length; i += 4) {
      await cdp.send('Input.insertText', { text: text.slice(i, i + 4) })
      await pause(35)
    }
  }
  async function finish(evidence) {
    await pause(1800)
    await suspend()
    capture.durationMs = Date.now() - capture.started
    capture.evidence = evidence
    capture.complete = true
    await save()
    return { key: capture.key, frames: capture.frames.length, durationMs: capture.durationMs, phases: capture.phases, actions: capture.actions.map(a => a.label) }
  }
  return { begin, resume, suspend, annotate, phase, step, type, finish, pause, current: () => capture }
}
