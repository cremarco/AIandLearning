import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as vue from 'vue'

const read = filename => readFile(new URL(`../${filename}`, import.meta.url), 'utf8')
const uk = JSON.parse(await read('data/mru/uk.json'))
const mru = JSON.parse(await read('data/mru/slides.json'))

async function languageModule({ dictionary = uk, url = 'https://example.test/mru/#/1', stored } = {}) {
  let saved = stored
  let replaced
  const context = createContext({ URL, URLSearchParams, window: {
    location: { href: url },
    localStorage: { getItem: () => saved, setItem: (_key, value) => { saved = value } },
    history: { state: { position: 1 }, replaceState: (_state, _title, value) => { replaced = String(value) } },
  } })
  const module = new SourceTextModule(stripTypeScriptTypes(await read('utils/language.ts')), { context })
  await module.link(specifier => {
    const values = specifier === 'vue' ? vue : { default: dictionary }
    return new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return { api: module.namespace, stored: () => saved, url: () => replaced }
}

test('language selection translates MRU, persists and preserves the current slide URL', async () => {
  const { api, stored, url } = await languageModule()
  assert.equal(api.language.value, 'en')
  assert.equal(api.t('Beyond prompting'), 'Beyond prompting')
  api.setPresentationLanguage('uk')
  assert.equal(api.t('Beyond prompting'), 'Більше, ніж промпти')
  assert.equal(stored(), 'uk')
  assert.equal(url(), 'https://example.test/mru/?lang=uk#/1')
  api.setPresentationLanguage('en')
  assert.equal(api.t('Beyond prompting'), 'Beyond prompting')
})

test('an explicit language link overrides saved preference; EduForum stays English', async () => {
  assert.equal((await languageModule({ url: 'https://example.test/mru/?lang=en#/s02', stored: 'uk' })).api.language.value, 'en')
  assert.equal((await languageModule({ url: 'https://example.test/mru/#/s02?lang=uk', stored: 'en' })).api.language.value, 'uk')
  const { api } = await languageModule({ dictionary: {}, stored: 'uk' })
  api.setPresentationLanguage('uk')
  assert.equal(api.supportsLanguageSwitch, false)
  assert.equal(api.language.value, 'en')
})

test('Ukrainian translates explanation text while preserving native prompts and identifiers', async () => {
  const { api } = await languageModule({ stored: 'uk' })
  const example = {
    id: 'S53QUIZ', kind: 'shortcut-detail', title: '/quiz', audience: 'student',
    message: 'Answer questions, review feedback and move through a quiz.',
    prompt: '/quiz Answer in English.',
    studyPhases: { primary: 'check' },
    links: [{ url: 'materials/result.html', label: 'Open result' }],
    commands: [{ command: 'Study', result: { instruction: 'Answer in English.', text: 'Source wording.', media: { src: 'clip.mp4' } } }],
    comparison: [{ text: 'What should I be able to explain or do?' }],
  }
  const localized = JSON.parse(JSON.stringify(api.localizeContent(example)))
  assert.notEqual(localized.message, example.message)
  assert.notEqual(localized.comparison[0].text, example.comparison[0].text)
  assert.notEqual(localized.links[0].label, example.links[0].label)
  for (const field of ['id', 'kind', 'title', 'audience', 'prompt']) assert.equal(localized[field], example[field])
  assert.deepEqual(localized.studyPhases, example.studyPhases)
  assert.deepEqual(localized.commands, example.commands)
  assert.equal(localized.links[0].url, example.links[0].url)
})

test('MRU has no hidden slides, timed exercises or speaker notes and keeps stable routes', async () => {
  assert.equal(mru.length, 84)
  assert(mru.every((slide, index) => !slide.hide && !slide.activityTimer && slide.number === index + 1))
  const markdown = await read('mru.md')
  assert(!markdown.includes('<!--'))
  assert(!markdown.includes('hide: true'))
  assert.deepEqual([...markdown.matchAll(/<DeckSlide id="([^"]+)"/g)].map(match => match[1]), mru.map(slide => slide.id))
  const original = JSON.parse(await read('data/generated/slides-runtime.json'))
  assert.equal(original.length, 89)
  assert.equal(original.filter(slide => slide.hide).length, 2)
  assert.equal(original.filter(slide => slide.activityTimer).length, 3)
  const { api } = await languageModule({ stored: 'uk' })
  for (const slide of mru) {
    const localized = api.localizeContent(slide)
    assert.equal(localized.id, slide.id)
    if (!slide.title.startsWith('/') && !['Marco Cremaschi', 'Whattadata', 'ChatGPT', 'Gemini', 'Claude', 'NotebookLM', 'Goblin.tools'].includes(slide.title)) {
      assert.notEqual(localized.title, slide.title, `${slide.id}: title needs a Ukrainian translation`)
    }
  }
})
