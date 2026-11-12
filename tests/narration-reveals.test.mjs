import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildNarrationReveals, narrationClickAt } from '../utils/narration-reveals.mjs'

test('click markers follow exact spoken-word offsets, including repeated phrases and Markdown', () => {
  const notes = '**Andrea** legge.\n\n[click] Poi Andrea spiega.\n\n[click] Poi Andrea controlla.'
  const words = [' Andrea', ' legge.', ' Poi', ' Andrea', ' spiega.', ' Poi', ' Andrea', ' controlla.']
    .map((word, index) => ({ word, start: [0.1, 0.7, 2, 2.2, 2.6, 4, 4.3, 4.7][index] }))
  assert.deepEqual(buildNarrationReveals(notes, words, 2), [{ click: 1, time: 2 }, { click: 2, time: 4 }])
  assert.deepEqual(buildNarrationReveals('[click] Andrea.', [{ word: ' Andrea.', start: 0.12 }], 1), [{ click: 1, time: 0.12 }])
})

test('missing markers, stale transcripts and markers inside words cannot drive animations', () => {
  assert.throws(() => buildNarrationReveals('Andrea.', [{ word: 'Andrea.', start: 0 }], 1), /marker/)
  assert.throws(() => buildNarrationReveals('[click] Andrea.', [{ word: 'Marco.', start: 0 }], 1), /exact narrated text/)
  assert.throws(() => buildNarrationReveals('An[click]drea.', [{ word: 'Andrea.', start: 0 }], 1), /precede an aligned/)
})

test('each reveal starts at its aligned word and the final reveal never advances the slide', () => {
  const reveals = [{ click: 1, time: 8.16 }, { click: 2, time: 13.3 }, { click: 3, time: 18.74 }]
  assert.equal(narrationClickAt(reveals, 0), 0)
  assert.equal(narrationClickAt(reveals, 8.159), 0)
  assert.equal(narrationClickAt(reveals, 8.16), 1)
  assert.equal(narrationClickAt(reveals, 13.3), 2)
  assert.equal(narrationClickAt(reveals, 18.74), 3)
  assert.equal(narrationClickAt(reveals, 1000), 3)
})
