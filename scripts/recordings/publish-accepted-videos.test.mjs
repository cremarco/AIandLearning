/** Descriptor fixtures only: no native capture, export or recipient evidence is fabricated. */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicResult } from './publish-accepted-videos.mjs'
import { collectInventory } from './video-refresh.mjs'

const options = { key: 'notebook-quiz', prefix: 'materials/video-refresh/2026-11-07' }
const file = {
  kind: 'file',
  url: 'http://127.0.0.1:8897/exports/notebook-quiz/quiz.pdf',
  recipientVerified: true,
  ownerIndependent: true,
  file: {
    path: 'exports/quiz.pdf',
    sha256: 'a'.repeat(64),
    bytes: 123,
    mediaType: 'application/pdf'
  },
  sourceExport: { method: 'observed-ui-derived-pdf' }
}

test('local review URLs become canonical public exports with an honest static label', () => {
  const result = publicResult(file, options)
  assert.equal(result.url, '/materials/video-refresh/2026-11-07/notebook-quiz/exports/quiz.pdf')
  assert.equal(result.label, 'Quiz and solutions (PDF, static)')
  assert.equal(result.interactiveVerified, false)
  assert.match(result.qualification, /not a native PDF download/)
  assert(!JSON.stringify(result).includes('127.0.0.1'))
})
test('unverified and owner-dependent results cannot be released', () => {
  assert.throws(
    () => publicResult({ ...file, recipientVerified: false }, options),
    /independent-recipient/
  )
  assert.throws(
    () => publicResult({ ...file, ownerIndependent: false }, options),
    /independent-recipient/
  )
})
test('export traversal and arbitrary evidence files are rejected', () => {
  for (const path of ['../private.png', 'exports/../../private.txt', 'export-evidence/account.png'])
    assert.throws(
      () => publicResult({ ...file, file: { ...file.file, path } }, options),
      /registered export/
    )
})
test('a chat share cannot expose the local reviewer as its recipient result', () => {
  for (const url of [
    'http://127.0.0.1:8897/',
    'https://127.0.0.1/result',
    'https://localhost/result'
  ])
    assert.throws(
      () =>
        publicResult(
          { kind: 'chatgpt-share', url, recipientVerified: true, ownerIndependent: true },
          options
        ),
      /local-review/
    )
})
test('Learning keeps its public-readable primary share distinct from its file supplement', () => {
  const supplemental = [{ kind: 'file', url: '/materials/example.html', download: true }]
  const result = publicResult(
    {
      kind: 'chatgpt-share',
      url: 'https://chatgpt.com/share/example',
      recipientVerified: true,
      ownerIndependent: true
    },
    { ...options, key: 'skills-the-learning-skill', supplemental }
  )
  assert.equal(result.url, 'https://chatgpt.com/share/example')
  assert.deepEqual(result.supplemental, supplemental)
  assert.equal(result.interactiveVerified, false)
  assert.match(result.qualification, /were not verified/)
})
test('a native screenshot cannot acquire an interactive or Download claim', () => {
  const result = publicResult(
    {
      ...file,
      file: { ...file.file, path: 'exports/map.png' },
      sourceExport: { method: 'observed-ui-native-screenshot' }
    },
    { ...options, key: 'notebook-mind-map' }
  )
  assert.match(result.label, /static/)
  assert.match(result.qualification, /not an interactive map/)
  assert.equal(result.sourceMethod, 'observed-ui-native-screenshot')
})

test('versioned public filenames preserve inventory identities from the current release registry', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const pointer = JSON.parse(fs.readFileSync(path.join(root, 'data/demos/video-release.json')))
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', pointer.manifest)))
  const inventory = collectInventory()
  assert.equal(new Set(inventory.items.map(item => item.key)).size, inventory.items.length)
  assert(!inventory.items.some(item => item.key.startsWith('video-refresh-')))
  for (const clip of manifest.clips) {
    const item = inventory.items.find(entry => entry.key === clip.key)
    assert(item, `Missing stable recording identity: ${clip.key}`)
    assert.equal(item.family, clip.family)
    assert.equal(item.source.src, clip.media.src)
  }
})
