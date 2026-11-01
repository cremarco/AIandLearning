import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-chromium'

const slides = JSON.parse(await readFile(new URL('../data/slides.json', import.meta.url), 'utf8'))
const flows = JSON.parse(await readFile(new URL('../data/flows.json', import.meta.url), 'utf8'))
const base = new URL(process.env.DECK_URL || 'http://localhost:3033/')
const hash = process.env.DECK_ROUTER_MODE !== 'history'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const byId = new Map(slides.map(slide => [slide.id, slide]))
function url(id, flow, presenter = false) {
  const prefix = presenter ? 'presenter/' : ''
  const route = `${prefix}${byId.get(id).number}?flow=${flow}`
  return hash ? `${base.href}#/${route}` : new URL(route, base).href
}
async function main(id, presenter = false) {
  const selector = presenter ? '.grid-section.main ' : '#slide-container '
  const target = page.locator(`${selector}.deck-slide[data-slide-id="${id}"]:visible`)
  await target.waitFor()
  return target
}
async function checkProgress(element, value, max, scope) {
  const bar = element.locator('.slide-progress')
  assert.equal(await bar.getAttribute('value'), String(value))
  assert.equal(await bar.getAttribute('max'), String(max))
  assert.equal(await bar.getAttribute('aria-label'), scope)
}
const report = { status: 'running', pageNumbers: [], flows: [], errors }
try {
  for (const slide of slides) {
    await page.goto(url(slide.id, 'all'), { waitUntil: 'networkidle' })
    const slideElement = await main(slide.id)
    assert.equal(await slideElement.locator('.slide-page').innerText(), `${slide.number} / ${slides.length}`)
    await checkProgress(slideElement, slide.number, slides.length, 'All slides progress')
    const overlap = await slideElement.evaluate(element => {
      const number = element.querySelector('.slide-page').getBoundingClientRect()
      const sources = element.querySelector('.source-line')?.getBoundingClientRect()
      return !!sources && sources.right > number.left && sources.left < number.right && sources.bottom > number.top && sources.top < number.bottom
    })
    assert(!overlap, `${slide.id}: page number overlaps sources`)
    report.pageNumbers.push(slide.id)
  }
  for (const flow of flows) {
    // S08 is followed by a different slide in each event.
    const position = flow.slideIds.indexOf('S08')
    const next = flow.slideIds[position + 1]
    await page.goto(url('S08', flow.id), { waitUntil: 'networkidle' })
    await checkProgress(await main('S08'), position + 1, flow.slideIds.length, `${flow.name} route progress`)
    await page.keyboard.press('p')
    await page.locator('.slidev-presenter').waitFor()
    await main('S08', true)
    assert(page.url().includes(`flow=${flow.id}`), 'P must preserve the selected event')
    await page.locator(`.grid-section.next .slide-${next}`).waitFor()
    await checkProgress(page.locator(`.grid-section.next .slide-${next}`), position + 2, flow.slideIds.length, `${flow.name} route progress`)
    await page.getByTitle('Go to next slide', { exact: true }).click()
    await checkProgress(await main(next, true), position + 2, flow.slideIds.length, `${flow.name} route progress`)
    await page.getByTitle('Go to previous slide', { exact: true }).click()
    await main('S08', true)
    await page.keyboard.press('p')
    await main('S08')
    assert.equal(await page.locator('.slidev-presenter').count(), 0)
    assert(page.url().includes(`flow=${flow.id}`))

    await page.goto(url('S40', flow.id, true), { waitUntil: 'networkidle' })
    await checkProgress(await main('S40', true), flow.slideIds.length, flow.slideIds.length, `${flow.name} route progress`)
    // Slidev's IconButton represents its disabled prop with a CSS class.
    assert.match(await page.getByTitle('Go to next slide', { exact: true }).getAttribute('class'), /\bdisabled\b/, 'Native controls must stop at the route end')
    await page.keyboard.press('ArrowRight')
    await main('S40', true)
    assert.equal(await page.locator('.grid-section.next .deck-slide').count(), 0, 'Route end must not preview an optional card')

    await page.goto(url('S43', flow.id, true), { waitUntil: 'networkidle' })
    await checkProgress(await main('S43', true), flow.slideIds.indexOf('S33') + 1, flow.slideIds.length, `${flow.name} route progress`)
    await page.getByTitle('Go to previous slide', { exact: true }).click()
    await main('S33', true)
    report.flows.push({ id: flow.id, nextAfterS08: next, presenterShortcut: 'passed', nativeControls: 'passed', nextPreview: 'passed', routeEnd: 'passed', referenceReturn: 'passed' })
  }
  if (hash) {
    // Two real tabs share Slidev's native BroadcastChannel in the static build.
    const syncContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const audience = await syncContext.newPage()
    const presenter = await syncContext.newPage()
    for (const tab of [audience, presenter]) tab.on('pageerror', error => errors.push(error.message))
    const projected = id => audience.locator(`#slide-container .slide-${id}:visible`)
    const presented = id => presenter.locator(`.grid-section.main .slide-${id}:visible`)
    await audience.goto(url('S01', 'all'), { waitUntil: 'networkidle' })
    await presenter.goto(url('S08', 'university', true), { waitUntil: 'networkidle' })
    await presented('S08').waitFor()
    await presenter.getByTitle('Go to next slide', { exact: true }).click()
    await presented('S12').waitFor()
    await projected('S12').waitFor()
    assert(audience.url().includes('flow=university'), 'Audience must receive the selected event')
    await presenter.getByRole('combobox', { name: 'Choose event route' }).selectOption('teachers')
    await presented('S02').waitFor()
    await projected('S02').waitFor()
    await presenter.getByTitle('Go to next slide', { exact: true }).click()
    await projected('S44').waitFor()
    assert(audience.url().includes('flow=teachers'), 'Audience must follow an event change')

    await presenter.goto(url('S34', 'teachers', true), { waitUntil: 'networkidle' })
    await presented('S34').waitFor()
    await projected('S34').waitFor()
    const controlTimer = presented('S34').getByRole('group', { name: 'Activity timer' })
    const audienceTimer = projected('S34').getByRole('group', { name: 'Activity timer' })
    const initial = await controlTimer.getByRole('timer').innerText()
    await controlTimer.getByRole('button', { name: 'Start', exact: true }).click()
    await audienceTimer.getByText('Running', { exact: true }).waitFor()
    await presenter.waitForTimeout(1200)
    assert.notEqual(await audienceTimer.getByRole('timer').innerText(), initial, 'Projected timer must count down')
    await controlTimer.getByRole('button', { name: 'Pause', exact: true }).click()
    await audienceTimer.getByText('Paused — select Start to continue', { exact: true }).waitFor()
    await presenter.waitForTimeout(150)
    assert.equal(await controlTimer.getByRole('timer').innerText(), await audienceTimer.getByRole('timer').innerText())
    await controlTimer.getByRole('button', { name: 'Add one minute', exact: true }).click()
    await presenter.waitForTimeout(150)
    assert.equal(await controlTimer.getByRole('timer').innerText(), await audienceTimer.getByRole('timer').innerText())
    await controlTimer.getByRole('button', { name: 'Reset', exact: true }).click()
    await presenter.waitForTimeout(150)
    assert.equal(await audienceTimer.getByRole('timer').innerText(), initial)
    await controlTimer.getByRole('button', { name: 'Start', exact: true }).click()
    await presenter.getByTitle('Go to next slide', { exact: true }).click()
    await projected('S35').waitFor()
    await presenter.getByTitle('Go to previous slide', { exact: true }).click()
    await projected('S34').waitFor()
    await audienceTimer.getByText('Paused — select Start to continue', { exact: true }).waitFor()
    report.twoWindows = { eventSync: 'passed', timerActions: 'passed', pauseOnLeave: 'passed' }
    await syncContext.close()
  }
  assert.deepEqual(errors, [])
  report.status = 'passed'
  await mkdir('qa', { recursive: true })
  await writeFile('qa/slidev-integration-verification.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, pageNumbers: report.pageNumbers.length }, null, 2))
} catch (error) {
  report.status = 'failed'
  report.failure = { message: error.message, url: page.url(), visibleSlides: await page.locator('.deck-slide:visible').evaluateAll(elements => elements.map(element => element.dataset.slideId)) }
  await mkdir('qa', { recursive: true })
  await writeFile('qa/slidev-integration-verification.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.failure, null, 2))
  throw error
} finally {
  await browser.close()
}
