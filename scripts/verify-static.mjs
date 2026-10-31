import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-chromium'

// Read-only production smoke check. The coordinator starts the static server.
// Run: node scripts/verify-static.mjs
// Optional: DECK_URL=http://localhost:3031 node scripts/verify-static.mjs
// The report goes to stdout; this script creates no reports or screenshots.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const base = new URL(process.env.DECK_URL || 'http://localhost:3031')
const entry = new URL('./', base.href.endsWith('/') ? base : new URL(base.href + '/'))
const slides = JSON.parse(await readFile(join(project, 'data/slides.json'), 'utf8'))
const flows = JSON.parse(await readFile(join(project, 'data/flows.json'), 'utf8'))
const index = new Map(slides.map((slide, i) => [slide.id, { ...slide, page: i + 1 }]))
const expectedMinutes = { forum: 90, university: 48, teachers: 50 }
const report = {
  status: 'running',
  base: entry.href,
  entryURL: null,
  routing: null,
  data: {},
  flows: [],
  textResources: [],
  imageResources: [],
  visibleImageChecks: [],
  pageErrors: [],
  httpErrors: [],
  failedRequests: [],
  consoleErrors: [],
}

assert.equal(slides.length, 43, 'Expected 43 physical slides')
assert.equal(index.size, 43, 'Slide IDs must be unique')
assert.equal(flows.length, 3, 'Expected three event flows')
for (const flow of flows) {
  assert(Object.hasOwn(expectedMinutes, flow.id), 'Unexpected flow: ' + flow.id)
  assert.equal(new Set(flow.slideIds).size, flow.slideIds.length, 'Repeated flow slide')
  assert(flow.slideIds.every(id => index.has(id)), 'Unknown slide in ' + flow.id)
  assert.deepEqual(flow.slideIds.slice(0, 3), ['S01', 'S02', 'S03'])
  const total = flow.slideIds.reduce((sum, id) => sum + index.get(id).duration[flow.id], 0)
  assert.equal(total, flow.minutes, 'Data total does not match flow minutes')
  assert.equal(total, expectedMinutes[flow.id], 'Unexpected planned duration')
  assert(flow.slideIds.includes('S33'), 'The evidence activity must be in every flow')
}
assert(slides.every(slide => typeof slide.notes === 'string' && slide.notes.trim()), 'Missing facilitator notes')
report.data = {
  physicalSlides: slides.length,
  allNotesPresent: true,
  flows: flows.map(flow => ({
    id: flow.id,
    slides: flow.slideIds.length,
    minutes: flow.minutes,
    activityMinutes: flow.slideIds
      .filter(id => /^S3[1-7]$/.test(id))
      .reduce((sum, id) => sum + index.get(id).duration[flow.id], 0),
  })),
}

function routeParts(address) {
  const url = new URL(address)
  const hashRoute = url.hash.startsWith('#/')
  return {
    url,
    hashRoute,
    route: hashRoute ? new URL(url.hash.slice(1), url.origin) : url,
  }
}
function flowInURL(address) {
  const { url, route } = routeParts(address)
  return route.searchParams.get('flow') || url.searchParams.get('flow')
}
// Derive the route from the actual URL produced by selecting a cover button.
// Never assume a history-mode /1 URL or put flow outside a production hash.
function slideURL(observedProfileURL, id, flowId) {
  const { url, hashRoute, route } = routeParts(observedProfileURL)
  const segments = route.pathname.split('/')
  let numberIndex = -1
  let namedSlide = false
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segments[i])) { numberIndex = i; break }
    if (/^s\d+$/i.test(segments[i])) { numberIndex = i; namedSlide = true; break }
  }
  assert(numberIndex >= 0, 'No slide segment in observed route: ' + observedProfileURL)
  segments[numberIndex] = namedSlide
    ? (segments[numberIndex] === segments[numberIndex].toLowerCase() ? id.toLowerCase() : id)
    : String(index.get(id).page)
  route.pathname = segments.join('/')
  route.searchParams.set('flow', flowId)
  if (hashRoute) {
    url.hash = route.pathname + route.search
    return url.href
  }
  return route.href
}
function distinctivePair(flow) {
  const others = new Set(flows.filter(f => f.id !== flow.id)
    .flatMap(f => f.slideIds.slice(0, -1).map((id, i) => id + '>' + f.slideIds[i + 1])))
  const pairs = flow.slideIds.slice(0, -1).map((id, i) => [id, flow.slideIds[i + 1]])
  return pairs.find(([from, to]) => !others.has(from + '>' + to))
    || pairs.find(([from, to]) => index.get(to).page !== index.get(from).page + 1)
    || pairs.at(-1)
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
page.setDefaultTimeout(12_000)
page.setDefaultNavigationTimeout(20_000)
page.on('pageerror', error => report.pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') report.consoleErrors.push(message.text())
})
page.on('response', response => {
  if (response.status() >= 400) {
    report.httpErrors.push({ status: response.status(), url: response.url() })
  }
})
page.on('requestfailed', request => {
  const error = request.failure()?.errorText || 'Unknown failure'
  // Expected cancellations while explicitly navigating are not missing assets.
  if (!error.includes('ERR_ABORTED')) report.failedRequests.push({ url: request.url(), error })
})

async function visible(id) {
  const main = page.locator('.deck-slide[data-slide-id="' + id + '"]:visible')
  await main.waitFor({ state: 'visible' })
  assert.equal(await main.count(), 1, 'Expected one visible ' + id)
  return main
}
async function checkVisibleImages(id) {
  const main = await visible(id)
  const result = await main.evaluate(async element => {
    const images = [...element.querySelectorAll('img')]
    await Promise.all(images.map(image => image.decode().catch(() => {})))
    return {
      count: images.length,
      broken: images.filter(image => !image.complete || image.naturalWidth === 0)
        .map(image => image.currentSrc || image.src),
    }
  })
  report.visibleImageChecks.push({ slide: id, ...result })
  assert.deepEqual(result.broken, [], 'Broken image on ' + id)
}
async function navigate(address, id) {
  const response = await page.goto(address, { waitUntil: 'networkidle' })
  if (response) assert.equal(response.status(), 200, 'Document status: ' + address)
  await visible(id)
}

let profileTemplate
try {
  // Root entry is deliberately used; Slidev production establishes its real route.
  await navigate(entry.href, 'S01')
  report.entryURL = page.url()
  await checkVisibleImages('S01')

  for (const flow of flows) {
    await navigate(entry.href, 'S01')
    const cover = await visible('S01')
    await cover.getByRole('button', {
      name: flow.name + ', ' + flow.minutes + ' minutes',
      exact: true,
    }).click()
    await visible('S02')
    const profileURL = page.url()
    profileTemplate ||= profileURL
    report.routing ||= routeParts(profileURL).hashRoute ? 'hash' : 'history'
    assert.equal(flowInURL(profileURL), flow.id, 'Cover choice missing from real URL')
    await checkVisibleImages('S02')

    await page.keyboard.press('ArrowRight')
    await visible(flow.slideIds[2])
    assert.equal(flowInURL(page.url()), flow.id, 'Arrow navigation lost flow')

    const [from, to] = distinctivePair(flow)
    await navigate(slideURL(profileURL, from, flow.id), from)
    await page.keyboard.press('ArrowRight')
    await visible(to)
    assert.equal(flowInURL(page.url()), flow.id, 'Characteristic jump lost flow')
    await checkVisibleImages(to)

    // Reload a route-specific position, then test the next expected route step.
    const beforeReload = page.url()
    await page.reload({ waitUntil: 'networkidle' })
    await visible(to)
    assert.equal(flowInURL(page.url()), flow.id, 'Reload lost flow query')
    const position = flow.slideIds.indexOf(to)
    const afterReload = flow.slideIds[Math.min(position + 1, flow.slideIds.length - 1)]
    await page.keyboard.press('ArrowRight')
    await visible(afterReload)
    assert.equal(flowInURL(page.url()), flow.id, 'Reload retained query but lost route behavior')

    // Explicit evidence-card detour and return in every event flow.
    await navigate(slideURL(profileURL, 'S33', flow.id), 'S33')
    const activity = await visible('S33')
    await activity.getByRole('button', { name: 'School mathematics ↗', exact: true }).click()
    await visible('S41')
    assert.equal(flowInURL(page.url()), flow.id, 'Evidence-card detour lost event flow')
    await checkVisibleImages('S41')
    const card = await visible('S41')
    await card.getByRole('button', { name: '← Return to the activity', exact: true }).click()
    await visible('S33')
    assert.equal(flowInURL(page.url()), flow.id, 'Return to activity lost flow')
    await page.keyboard.press('ArrowRight')
    const nextActivity = flow.slideIds[flow.slideIds.indexOf('S33') + 1]
    await visible(nextActivity)

    report.flows.push({
      id: flow.id,
      slideCount: flow.slideIds.length,
      minutes: flow.minutes,
      profileURL,
      firstArrowTarget: flow.slideIds[2],
      characteristicJump: { from, to },
      reloadURL: beforeReload,
      nextAfterReload: afterReload,
      evidenceCard: 'S33 → S41 → S33',
      nextAfterReturn: nextActivity,
      passed: true,
    })
  }

  // Discover deployed resource paths from rendered anchors rather than assuming
  // whether Vite's base is / or a subdirectory.
  const flow = flows[0]
  await navigate(slideURL(profileTemplate, 'S39', flow.id), 'S39')
  await checkVisibleImages('S39')
  const summary = await visible('S39')
  const links = await summary.locator('a[href]').evaluateAll(elements =>
    elements.map(element => ({ text: element.textContent.trim(), href: element.href })))
  const materialLinks = links.filter(link => new URL(link.href).origin === entry.origin
    && new URL(link.href).pathname.includes('/materials/'))
  assert(materialLinks.length >= 2, 'Expected local classroom packet and prompt-bank links')
  const materialBase = new URL('./', materialLinks[0].href)
  const materialFiles = (await readdir(join(project, 'public/materials')))
    .filter(name => /\.(txt|csv|bib)$/i.test(name)).sort()
  assert(materialFiles.length > 0, 'No expected text resources')
  for (const name of materialFiles) {
    const address = new URL(encodeURIComponent(name), materialBase).href
    const response = await context.request.get(address)
    const body = await response.body()
    const expected = await readFile(join(project, 'public/materials', name))
    const item = {
      file: name,
      url: address,
      status: response.status(),
      bytes: body.length,
      matchesSource: body.equals(expected),
    }
    report.textResources.push(item)
    assert.equal(item.status, 200, 'Text resource missing: ' + address)
    assert(item.bytes > 0 && item.matchesSource,
      'Text resource is stale, empty or an HTML fallback: ' + address)
  }
  for (const link of materialLinks) {
    assert(report.textResources.some(resource => resource.url === link.href),
      'Rendered material link was not checked: ' + link.href)
  }

  // Check every public image, not only the backgrounds reached by this smoke pass.
  await navigate(entry.href, 'S01')
  const cover = await visible('S01')
  const heroURL = await cover.locator('img').first().evaluate(image => image.currentSrc || image.src)
  const imageBase = new URL('./', heroURL)
  const imageFiles = (await readdir(join(project, 'public/images')))
    .filter(name => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name)).sort()
  for (const name of imageFiles) {
    const address = new URL(encodeURIComponent(name), imageBase).href
    const response = await context.request.get(address)
    const body = await response.body()
    const expected = await readFile(join(project, 'public/images', name))
    const item = {
      file: name,
      status: response.status(),
      type: response.headers()['content-type'] || '',
      bytes: body.length,
      matchesSource: body.equals(expected),
    }
    report.imageResources.push(item)
    assert.equal(item.status, 200, 'Image asset missing: ' + address)
    assert(item.type.startsWith('image/'), 'Image URL returned a fallback document: ' + address)
    assert(item.matchesSource, 'Built image differs from the current public asset: ' + address)
  }

  assert.deepEqual([...new Set(report.pageErrors)], [], 'Browser pageerror')
  assert.deepEqual(report.httpErrors, [], 'Browser requests returned HTTP errors')
  assert.deepEqual(report.failedRequests, [], 'Browser asset/network request failed')
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.failure = { message: error.message, stack: error.stack, currentURL: page.url() }
  process.exitCode = 1
} finally {
  report.pageErrors = [...new Set(report.pageErrors)]
  report.consoleErrors = [...new Set(report.consoleErrors)]
  await browser.close()
  console.log(JSON.stringify(report, null, 2))
}

