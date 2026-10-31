import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-chromium'
import { loadSpeakerNotes } from './speaker-notes.mjs'

const slides = JSON.parse(await readFile(new URL('../data/slides.json', import.meta.url), 'utf8'))
const scripts = loadSpeakerNotes(slides)
const entry = new URL(process.env.DECK_URL || 'http://localhost:3031/')
if (!entry.pathname.endsWith('/')) entry.pathname += '/'
const normalize = text => text.replace(/\s+/g, ' ').trim()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
try {
  // Check actual rendered Slidev notes, rather than only the input JSON.
  for (const slide of slides) {
    await page.goto(`${entry.href}#/presenter/${slide.number}`, { waitUntil: 'networkidle' })
    const panel = page.locator('.slidev-note')
    await panel.waitFor()
    const content = normalize(await panel.innerText())
    const script = scripts[slide.id]
    for (const language of ['it', 'en']) {
      assert(content.includes(normalize(script[language])), `${slide.id}: missing rendered ${language} words`)
      for (const cue of script.cues[language]) assert(content.includes(normalize(cue)), `${slide.id}: missing ${language} action`)
      if (script.forum_extra) assert(content.includes(normalize(script.forum_extra[language])), `${slide.id}: missing ${language} Forum addition`)
    }
    assert(content.includes(normalize(slide.notes)), `${slide.id}: lost preparation reference`)
  }
  // A real presenter page must expose both scripts and scroll to the end.
  await page.goto(`${entry.href}#/presenter/3?flow=forum`, { waitUntil: 'networkidle' })
  const panel = page.locator('.slidev-note')
  await panel.waitFor()
  const text = normalize(await panel.innerText())
  assert(text.includes(normalize(scripts.S44.it)))
  assert(text.includes(normalize(scripts.S44.en)))
  await panel.evaluate(element => { element.scrollTop = element.scrollHeight })
  assert(await panel.evaluate(element => element.scrollTop > 0), 'Long bilingual notes need a working scroll area')
  for (const language of ['IT', 'EN']) {
    const response = await page.request.get(new URL(`materials/Presenter_Notes_${language}.txt`, entry).href)
    assert.equal(response.status(), 200)
    const body = await response.text()
    assert.equal((body.match(/^SLIDE S\d{2} —/gm) || []).length, slides.length)
    for (const slide of slides) assert(body.includes(scripts[slide.id][language.toLowerCase()]), `${slide.id}: missing downloadable ${language} words`)
  }
  assert.deepEqual(errors, [])
  const report = { status: 'passed', url: entry.href, slides: slides.length, scripts: slides.length * 2, nativeNotes: 'passed', presenter: 'passed', downloadableScripts: ['IT', 'EN'], errors }
  await mkdir('qa', { recursive: true })
  await writeFile('qa/speaker-notes-verification.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
