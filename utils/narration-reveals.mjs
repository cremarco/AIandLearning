import { plainSpeakerNotes } from './narration-text.mjs'

const compact = text => text.replace(/\s+/gu, '')

/** Match each note marker to its next spoken word, including repeated phrases. */
export function buildNarrationReveals(notes, words, expectedClicks) {
  const parts = notes.split('[click]')
  if (parts.length - 1 !== expectedClicks) throw new Error('Every narration reveal needs a [click] marker')
  const clean = part => compact(part.replace(/\*\*/g, '').replace(/\\(?=\r?\n)/g, ''))
  const spoken = compact(plainSpeakerNotes(notes))
  if (compact(words.map(word => word.word).join('')) !== spoken)
    throw new Error('Reveal timing must use the exact narrated text')
  let offset = 0
  const ranges = words.map(word => {
    const start = offset
    offset += compact(word.word).length
    return { start, end: offset, time: word.start }
  })
  let position = 0
  return parts.slice(0, -1).map((part, index) => {
    position += clean(part).length
    const word = ranges.find(word => word.end > position)
    if (!word || word.start !== position || !Number.isFinite(word.time) || word.time < 0)
      throw new Error('A narration reveal must precede an aligned spoken word')
    return { click: index + 1, time: word.time }
  })
}

/** Return a click count on this slide; never advance to the next slide. */
export function narrationClickAt(reveals, time) {
  let click = 0
  for (const reveal of reveals) {
    if (reveal.time > time) break
    click = reveal.click
  }
  return click
}
