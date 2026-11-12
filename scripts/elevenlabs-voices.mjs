import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

// This script runs in Node only. The package command loads .env.local;
// the SDK reads ELEVENLABS_API_KEY without exposing it to Slidev.
async function listVoices() {
  if (!process.env.ELEVENLABS_API_KEY)
    throw new Error('Configura ElevenLabs con il comando ufficiale onboard init.')

  const client = new ElevenLabsClient()
  const voices = new Map(), tokens = new Set()
  let nextPageToken
  while (true) {
    const page = await client.voices.search({ pageSize: 100, nextPageToken })
    for (const voice of page.voices) {
      voices.set(voice.voiceId, {
        id: voice.voiceId,
        name: voice.name,
        category: voice.category,
        description: voice.description,
        labels: voice.labels,
        previewUrl: voice.previewUrl,
        verifiedLanguages: (voice.verifiedLanguages ?? []).map(language => ({
          language: language.language,
          model: language.modelId,
          accent: language.accent,
          locale: language.locale,
          previewUrl: language.previewUrl,
        })),
      })
    }
    if (!page.hasMore) break
    if (!page.nextPageToken || tokens.has(page.nextPageToken))
      throw new Error('Elenco incompleto: token di paginazione mancante o ripetuto.')
    nextPageToken = page.nextPageToken
    tokens.add(nextPageToken)
  }
  const result = [...voices.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'))
  console.log(JSON.stringify({ total: result.length, voices: result }, null, 2))
}

listVoices().catch(error => {
  // API error objects may include request details; print no credentials.
  console.error(error.statusCode
    ? `Lettura voci ElevenLabs non riuscita (HTTP ${error.statusCode}).`
    : error.message === 'Configura ElevenLabs con il comando ufficiale onboard init.'
      || error.message.startsWith('Elenco incompleto:')
      ? error.message : 'Impossibile leggere le voci ElevenLabs.')
  process.exitCode = 1
})
