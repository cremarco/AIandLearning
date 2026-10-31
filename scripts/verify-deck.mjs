import { chromium } from 'playwright-chromium'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const slides = JSON.parse(readFileSync('data/slides.json'))
const flows = JSON.parse(readFileSync('data/flows.json'))
const sources = JSON.parse(readFileSync('data/sources.json'))
assert.equal(slides.length, 43)
assert.equal(new Set(slides.map(s => s.id)).size, 43)
for (const s of slides) {
  assert(s.notes && s.title && s.body)
  for (const id of s.sources) assert(sources[id], `Missing source ${id}`)
}
for (const f of flows) {
  assert.equal(new Set(f.slideIds).size, f.slideIds.length)
  assert.equal(f.slideIds.reduce((n, id) => n + slides.find(s => s.id === id).duration[f.id], 0), f.minutes)
}
mkdirSync('qa/slides', { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const base = process.env.DECK_URL || 'http://localhost:3030'
const errors = [], failed = [], layouts = [], flowResults = []
page.on('pageerror', e => { if (!e.message.includes('Wake Lock permission')) errors.push(e.message) })
page.on('response', r => { if (r.status() >= 400) failed.push({ status: r.status(), url: r.url() }) })
async function visible(id) {
  await page.locator(`.deck-slide[data-slide-id="${id}"]:visible`).waitFor()
}
try {
  await page.goto(`${base}/1`, { waitUntil: 'networkidle' })
  await visible('S01')
  for (const s of slides) {
    if (s.number > 1) await page.keyboard.press('ArrowRight')
    await visible(s.id)
    await page.waitForTimeout(140)
    const main = page.locator(`.deck-slide[data-slide-id="${s.id}"]:visible`)
    await main.evaluate(async el => { await Promise.all([...el.querySelectorAll('img')].map(i => i.decode().catch(() => {}))) })
    const result = await main.evaluate(el => {
      const root = el.getBoundingClientRect(), issues = [], brokenImages = []
      if (Math.abs(root.height - 720) > 2) issues.push(`Canvas height ${root.height}`)
      for (const image of el.querySelectorAll('img')) if (!image.complete || !image.naturalWidth) brokenImages.push(image.src)
      for (const card of el.querySelectorAll('.bento-card, .activity-output')) {
        const rect = card.getBoundingClientRect()
        for (const child of card.querySelectorAll('h2, p, .study-stat, [role="timer"]')) {
          const r = child.getBoundingClientRect()
          if (r.width > 3 && r.height > 3 && r.bottom > rect.bottom - 3) issues.push(`Card overflow: ${child.textContent.trim().slice(0,85)}`)
        }
      }
      for (const child of el.querySelectorAll('h1, h2, p, li, .activity-footer, .resource-row, .return-button')) {
        if (child.closest('.sr-only') || child.classList.contains('sr-only')) continue
        const r = child.getBoundingClientRect()
        if (r.width < 3 || r.height < 3) continue
        if (r.right > root.right + 2 || r.left < root.left - 2 || r.bottom > root.bottom - 12) issues.push(`Canvas overflow: ${child.textContent.trim().slice(0,85)}`)
      }
      return { id: el.dataset.slideId, title: el.querySelector('h1')?.textContent, issues: [...new Set(issues)], brokenImages }
    })
    layouts.push(result)
    await main.screenshot({ path: `qa/slides/${s.id}.png`, animations: 'disabled' })
  }
  writeFileSync('qa/layout-pass.json', JSON.stringify(layouts, null, 2))
  for (const f of flows) {
    await page.goto(`${base}/1`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: `${f.name}, ${f.minutes} minutes`, exact: true }).click()
    await visible('S02')
    for (const id of f.slideIds.slice(2)) {
      await page.keyboard.press('ArrowRight')
      await visible(id)
    }
    await page.keyboard.press('ArrowRight')
    await visible(f.slideIds.at(-1))
    assert(page.url().includes(`flow=${f.id}`), 'Route choice should persist in the URL')
    await page.reload({ waitUntil: 'networkidle' })
    await visible(f.slideIds.at(-1))
    flowResults.push({ id: f.id, slides: f.slideIds.length, minutes: f.minutes, navigation: 'passed', reload: 'passed' })
  }
  await page.goto(`${base}/34?flow=teachers`, { waitUntil: 'networkidle' })
  await visible('S34')
  const timer = page.locator('.deck-slide[data-slide-id="S34"] [aria-label="Activity timer"]')
  const before = await timer.getByRole('timer').innerText()
  await timer.getByRole('button', { name: 'Start', exact: true }).click()
  await page.waitForTimeout(1150)
  const running = await timer.getByRole('timer').innerText()
  assert.notEqual(before, running, 'Timer should count down after Start')
  await timer.getByRole('button', { name: 'Pause', exact: true }).click()
  const paused = await timer.getByRole('timer').innerText()
  await page.waitForTimeout(500)
  assert.equal(paused, await timer.getByRole('timer').innerText())
  await timer.getByRole('button', { name: 'Add one minute', exact: true }).click()
  assert.notEqual(paused, await timer.getByRole('timer').innerText())
  await timer.getByRole('button', { name: 'Reset', exact: true }).click()
  assert.equal(before, await timer.getByRole('timer').innerText())
  const report = { date: '2026-10-31', slides: slides.length, sourceIds: Object.keys(sources).length, flows: flowResults, layouts, timer: 'passed', errors: [...new Set(errors)], failedRequests: failed }
  writeFileSync('qa/verification.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ slides: slides.length, layoutIssues: layouts.filter(r => r.issues.length), brokenImages: layouts.filter(r => r.brokenImages.length), flows: flowResults, timer: 'passed', errors: report.errors, failedRequests: failed }, null, 2))
} finally { await browser.close() }
