import assert from 'node:assert/strict'
import { launchBrowser } from '../lib/browser.mjs'
import { slides } from './check-data.mjs'

const base = process.env.DECK_URL || 'http://localhost:3047/'
const browser = await launchBrowser({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto(new URL('1', base).href, { waitUntil: 'networkidle' })
  await page.locator('.cover-background[data-motion="playing"]').waitFor()
  assert.equal(await page.locator('.cover-email').getAttribute('href'), 'mailto:marco.cremaschi@unimib.it')
  const motion = await page.locator('.cover-background canvas').evaluate(canvas => new Promise(resolve => {
    const ctx = canvas.getContext('2d')
    const start = performance.now()
    let previous, changed = 0
    function sample(now) {
      const pixels = ctx.getImageData(780, 220, 420, 300).data
      let hash = 2166136261
      for (let i = 0; i < pixels.length; i += 32) hash = Math.imul(hash ^ pixels[i] ^ pixels[i + 1], 16777619)
      if (previous !== undefined && hash !== previous) changed++
      previous = hash
      if (now - start < 2000) requestAnimationFrame(sample)
      else resolve({ changedFrames: changed, fps: changed * 1000 / (now - start) })
    }
    requestAnimationFrame(sample)
  }))
  assert(motion.fps >= 24 && motion.fps <= 35, `Wave must render fluidly at ~30 fps: ${motion.fps}`)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('.cover-background[data-motion="still"]').waitFor()
  const frame = await page.locator('.cover-background canvas').evaluate(canvas => canvas.toDataURL())
  await page.waitForTimeout(100)
  assert.equal(await page.locator('.cover-background canvas').evaluate(canvas => canvas.toDataURL()), frame)
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  const company = slides.find(slide => slide.type === 'company')
  await page.goto(new URL(String(company.number), base).href, { waitUntil: 'networkidle' })
  await page.locator('.company-motion.is-running').waitFor()
  const book = slides.find(slide => slide.book)
  await page.goto(new URL(String(book.number), base).href, { waitUntil: 'networkidle' })
  await page.locator('.book-preview[data-state="playing"]').waitFor()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.locator('.book-preview[data-state="paused"]').waitFor()
  await page.waitForFunction(() => {
    const animation = document.querySelector('.book-motion').getAnimations()[0]
    return animation.playState === 'paused' && !animation.pending
  })
  const pausedTime = await page.locator('.book-motion').evaluate(element => element.getAnimations()[0].currentTime)
  await page.waitForTimeout(100)
  assert.equal(await page.locator('.book-motion').evaluate(element => element.getAnimations()[0].currentTime), pausedTime)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.locator('.book-preview[data-state="playing"]').waitFor()
  await page.getByRole('button', { name: 'Replay book', exact: true }).click()
  assert(await page.locator('.book-motion').evaluate(element => element.getAnimations()[0].currentTime) < 1000)

  const intro = slides.find(slide => slide.id === 'S53GPT')
  await page.goto(new URL(String(intro.number), base).href, { waitUntil: 'networkidle' })
  await page.locator('.chatgpt-intro.is-active').waitFor()

  const closing = slides.at(-1)
  assert.equal(closing.kind, 'thanks', 'The presentation must finish with the thank-you slide')
  await page.goto(new URL(String(closing.number), base).href, { waitUntil: 'networkidle' })
  const closingSlide = page.locator(`#slide-container .slide-${closing.id}:visible`)
  const closingWave = closingSlide.locator('.cover-background')
  await closingWave.locator('canvas').waitFor()
  assert.equal(await closingWave.getAttribute('data-motion'), 'playing')
  assert.equal(await closingSlide.locator('h1').innerText(), closing.title)
  assert.equal(await closingSlide.locator('.slide-audience').count(), 0)
  const closingCanvas = closingWave.locator('canvas')
  const closingFrame = await closingCanvas.evaluate(canvas => canvas.toDataURL())
  await page.waitForTimeout(150)
  assert(await closingCanvas.evaluate((canvas, previous) => canvas.toDataURL() !== previous, closingFrame), 'The closing wave must animate while its slide is active')
  await closingSlide.screenshot({ path: 'output/review/thank-you-slide.png' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await closingSlide.locator('.cover-background[data-motion="still"]').waitFor()
  await page.goto(new URL('print?print=true', base).href, { waitUntil: 'networkidle' })
  await page.locator('.book-preview[data-state="closed-back"]').waitFor()
  assert.deepEqual(await page.locator('.cover-background').evaluateAll(elements => elements.map(element => element.dataset.motion)), ['still', 'still'], 'The opening and thank-you waves must remain static in print')
  assert.equal(await page.locator('.company-motion.is-running, .chatgpt-intro.is-active').count(), 0)
  assert.deepEqual(errors, [])
  console.log(`Motion checks passed: wave ${motion.fps.toFixed(1)} fps, reduced motion, animated cubes/intro, book pause/resume/replay, animated thank-you slide, two static print waves, cover email.`)
} finally {
  await browser.close()
}
