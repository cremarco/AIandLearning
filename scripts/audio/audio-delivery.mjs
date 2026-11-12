const supportedTags = new Set(['warm, conversational tone', 'calm, matter-of-fact delivery', 'short pause', 'pause', 'long pause'])

/** Apply settings to one slide without changing the shared generation identity. */
export function resolveSlideAudioSettings(configuration, alias) {
  const { slideOverrides = {}, ...defaults } = configuration
  return {
    ...defaults,
    voiceSettings: { ...defaults.voiceSettings, ...slideOverrides[alias]?.voiceSettings },
  }
}

/** Read the spoken words without accepting unknown or incomplete voice markup. */
export function stripAudioDelivery(text) {
  if (typeof text !== 'string') throw new Error('Il copione deve essere testo.')
  const plainText = text.replace(/\[([^\]\r\n]+)\]/g, (tag, name) => {
    if (!supportedTags.has(name)) throw new Error(`Indicazione vocale non supportata: ${tag}`)
    return ''
  })
  if (/[\[\]]/.test(plainText)) throw new Error('Indicazione vocale incompleta.')
  return plainText
}

/** Add voice directions while preserving every original character of the script. */
export function applyAudioDelivery(text, direction) {
  if (typeof text !== 'string' || /[\[\]]/.test(text))
    throw new Error('Il copione deve essere testo senza tag vocali.')
  if (!direction || typeof direction.tone !== 'string' || !direction.tone.trim()
    || /[\[\]\r\n]/.test(direction.tone) || !Array.isArray(direction.pauses))
    throw new Error('Indicazioni vocali non valide.')

  const insertions = direction.pauses.map(({ after, tag }) => {
    if (typeof after !== 'string' || !after || !['short pause', 'pause', 'long pause'].includes(tag))
      throw new Error('Indicazione di pausa non valida.')
    const start = text.indexOf(after)
    if (start < 0 || text.indexOf(after, start + 1) >= 0)
      throw new Error(`Il riferimento della pausa deve comparire una sola volta: ${after}`)
    return { position: start + after.length, tag }
  }).sort((a, b) => b.position - a.position)
  if (new Set(insertions.map(item => item.position)).size !== insertions.length)
    throw new Error('Due pause indicano lo stesso punto del copione.')

  let submittedText = text
  for (const { position, tag } of insertions)
    submittedText = submittedText.slice(0, position) + `[${tag}]` + submittedText.slice(position)
  submittedText = `[${direction.tone}]` + submittedText
  if (stripAudioDelivery(submittedText) !== text)
    throw new Error('Le indicazioni vocali hanno modificato il copione.')
  return submittedText
}
