import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildCaptionWordTrack, captionWordAt, captionSpokenThrough } from '../utils/caption-words.mjs'

test('word ranges preserve apostrophes, punctuation, repeated words and line breaks', () => {
  const track = buildCaptionWordTrack({
    words: [
      { word: ' Un’', start: 0, end: .2 }, { word: 'interfaccia,', start: .2, end: .8 },
      { word: ' una', start: .8, end: 1 }, { word: ' scelta.', start: 1, end: 1.6 },
      { word: ' Una', start: 2, end: 2.2 }, { word: ' scelta.', start: 2.2, end: 3 },
    ],
    cues: [{ text: 'Un’interfaccia,\nuna scelta.' }, { text: 'Una scelta.' }],
  })
  assert.deepEqual(track.cues.map(cue => cue.words.map(word => cue.text.slice(word.from, word.to))),
    [['Un’', 'interfaccia,', 'una', 'scelta.'], ['Una', 'scelta.']])
  assert.equal(track.cues[1].id, '2')
})

test('audio boundaries, silences and zero-duration alignment words select at most one word', () => {
  const words = [{ start: .2, end: .5 }, { start: .5, end: .5 }, { start: .5, end: 1 }, { start: 1.4, end: 2 }]
  assert.equal(captionWordAt(words, .1), -1)
  assert.equal(captionWordAt(words, .2), 0)
  assert.equal(captionWordAt(words, .5), 2)
  assert.equal(captionWordAt(words, 1.2), -1)
  assert.equal(captionWordAt(words, 1.6), 3)
  assert.equal(captionWordAt(words, 2), -1)
  assert.equal(captionWordAt([], 1), -1)
  assert.equal(captionSpokenThrough(words, .1), -1)
  assert.equal(captionSpokenThrough(words, 1.2), 2, 'spoken words stay colored in a gap')
  assert.equal(captionSpokenThrough(words, 2), 3, 'the completed line stays colored until its cue ends')
  assert.equal(captionSpokenThrough(words, .3), 0, 'seeking back clears future words')
})

test('mismatched or unused alignment text is rejected rather than highlighting a different word', () => {
  assert.throws(() => buildCaptionWordTrack({ words: [{ word: 'altro' }], cues: [{ text: 'testo' }] }), /differs/)
  assert.throws(() => buildCaptionWordTrack({ words: [{ word: 'testo' }], cues: [] }), /unused/)
  assert.throws(() => buildCaptionWordTrack({ words: [], cues: [{ text: 'testo' }] }), /missing/)
})
