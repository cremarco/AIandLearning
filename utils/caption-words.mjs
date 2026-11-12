/** Map Whisper words to exact character ranges in the existing, line-broken cues. */
export function buildCaptionWordTrack({ words, cues }) {
  let wordIndex = 0
  const result = cues.map((cue, index) => {
    let offset = 0
    const timings = []
    while (offset < cue.text.length) {
      while (/\s/u.test(cue.text[offset] ?? '') && offset < cue.text.length) offset++
      if (offset === cue.text.length) break
      const word = words[wordIndex++]
      if (!word || !word.word.trim()) throw new Error('Caption word missing from the approved alignment')
      const from = offset
      for (const character of word.word.replace(/\s/gu, '')) {
        while (offset < cue.text.length && /\s/u.test(cue.text[offset])) offset++
        if (!cue.text.startsWith(character, offset)) throw new Error('Caption word differs from the approved text')
        offset += character.length
      }
      timings.push({ from, to: offset, start: word.start, end: word.end })
    }
    return { id: String(index + 1), text: cue.text, words: timings }
  })
  if (wordIndex !== words.length) throw new Error('Caption word alignment has unused words')
  return { version: 1, cues: result }
}

/** Karaoke keeps the words already reached, including during pauses between words. */
export function captionSpokenThrough(words, time) {
  let low = 0, high = words.length - 1, candidate = -1
  while (low <= high) {
    const middle = (low + high) >>> 1
    if (words[middle].start <= time) { candidate = middle; low = middle + 1 }
    else high = middle - 1
  }
  return candidate
}

/** No current word in a silence; exact boundaries belong to the following word. */
export function captionWordAt(words, time) {
  const candidate = captionSpokenThrough(words, time)
  return candidate >= 0 && time < words[candidate].end ? candidate : -1
}
