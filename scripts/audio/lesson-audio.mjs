import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parseArgs } from 'node:util'
import { applyAudioDelivery, stripAudioDelivery, resolveSlideAudioSettings } from './audio-delivery.mjs'

const root = new URL('../../', import.meta.url)
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const hash = value => createHash('sha256').update(value).digest('hex')

export async function generateLessonAudio({ lessonSource, settingsSource, directory }) {
  const lesson = await json(lessonSource)
  const notesSource = lesson.speakerNotesSource
  const manifestPath = directory + 'manifest.json'
  const { values } = parseArgs({ options: {
    slides: { type: 'string' }, generate: { type: 'boolean', default: false },
    delivery: { type: 'string' },
    regenerate: { type: 'boolean', default: false },
  } })
  if (!values.slides || !/^\d+(,\d+)*$/.test(values.slides))
    throw new Error('Indicare esplicitamente --slides 1,2,3; --generate abilita le chiamate a consumo.')

  const [notes, settingsConfiguration] = await Promise.all([json(notesSource), json(settingsSource)])
  const delivery = values.delivery ? await json(values.delivery) : undefined
  if (values.delivery !== undefined && (!delivery || delivery.version !== 1 || delivery.lesson !== lesson.lesson
    || !delivery.slides || typeof delivery.slides !== 'object' || Array.isArray(delivery.slides)))
    throw new Error('Profilo delle indicazioni vocali non compatibile.')
  const selection = [...new Set(values.slides.split(',').map(Number))].sort((a, b) => a - b)
  const jobs = selection.map(number => {
    const slide = lesson.slides.find(slide => slide.lessonSlide === number)
    if (!slide || !/^[a-z0-9-]+$/.test(slide.alias) || !notes[slide.alias]?.trim())
      throw new Error(`Slide ${number}: alias o copione mancante.`)
    if (slide.narrationEnabled === false)
      throw new Error(`Slide ${number}: audio disattivato nel piano della lezione.`)
    const text = notes[slide.alias]
    const plainText = stripAudioDelivery(text)
    const settings = resolveSlideAudioSettings(settingsConfiguration, slide.alias)
    const direction = delivery?.slides[slide.alias]
    if (delivery && !direction) throw new Error(`Slide ${number}: indicazioni vocali mancanti.`)
    const submittedText = delivery ? applyAudioDelivery(plainText, direction) : text
    const fingerprint = hash(JSON.stringify({ text: submittedText, settings }))
    return { slide, text, plainText, submittedText, direction, settings, fingerprint }
  })
  console.log(`Selezione: ${selection.join(', ')}; ${jobs.reduce((sum, job) => sum + job.submittedText.length, 0)} caratteri; ${settingsConfiguration.voiceName}, ${settingsConfiguration.modelId}${delivery ? '; indicazioni vocali separate dal copione' : ''}.`)
  if (!values.generate) return console.log('Solo anteprima: nessun audio richiesto all’API.')
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('Chiave ElevenLabs non caricata nell’ambiente.')

  let manifest
  try { manifest = await json(manifestPath) }
  catch (error) {
    if (error.code !== 'ENOENT') throw error
    manifest = { version: 1, lesson: lesson.lesson, notesSource, settingsSource, clips: [] }
  }
  if (manifest.version !== 1 || manifest.lesson !== lesson.lesson || !Array.isArray(manifest.clips))
    throw new Error('Manifest audio non compatibile.')

  await mkdir(new URL(directory, root), { recursive: true })
  const client = new ElevenLabsClient()
  for (const { slide, text, plainText, submittedText, direction, settings, fingerprint } of jobs) {
    const existing = manifest.clips.find(clip => clip.alias === slide.alias && clip.fingerprint === fingerprint)
    if (existing && !values.regenerate) {
      if (hash(await readFile(new URL(existing.file, root))) !== existing.audioSha256)
        throw new Error(`Slide ${slide.lessonSlide}: il file audio esistente non corrisponde al manifest.`)
      console.log(`Slide ${slide.lessonSlide}: audio già presente; nessuna chiamata API.`)
      continue
    }
    const take = values.regenerate ? `-${Date.now().toString(36)}` : ''
    const file = `${directory}${String(slide.lessonSlide).padStart(2, '0')}-${slide.alias}-${fingerprint.slice(0, 12)}${take}.mp3`
    const target = new URL(file, root)
    // Keep interrupted downloads separate and preserve previous generations.
    const temporary = new URL(`${file}.${Date.now()}.part`, root)
    console.log(`Slide ${slide.lessonSlide}: generazione in corso.`)
    const audio = await client.textToSpeech.convert(settings.voiceId, {
      text: submittedText, modelId: settings.modelId, languageCode: settings.languageCode,
      outputFormat: settings.outputFormat, voiceSettings: settings.voiceSettings,
    }, { maxRetries: 0, timeoutInSeconds: 180 })
    await pipeline(Readable.fromWeb(audio), createWriteStream(temporary, { flags: 'wx' }))
    const bytes = await readFile(temporary)
    if (bytes.length < 1000) throw new Error(`Slide ${slide.lessonSlide}: risposta audio incompleta.`)
    await rename(temporary, target)
    manifest.clips.push({
      slide: slide.lessonSlide, alias: slide.alias, title: slide.title,
      file, generatedAt: new Date().toISOString(), settings,
      text, submittedCharacters: submittedText.length, textSha256: hash(text),
      ...(plainText !== text ? { plainText, plainTextSha256: hash(plainText) } : {}),
      ...(delivery ? {
        deliverySource: values.delivery, delivery: direction,
        submittedText, submittedTextSha256: hash(submittedText),
      } : {}),
      fingerprint, bytes: bytes.length, audioSha256: hash(bytes),
    })
    const manifestTemporary = new URL(manifestPath + '.tmp', root)
    await writeFile(manifestTemporary, JSON.stringify(manifest, null, 2) + '\n')
    await rename(manifestTemporary, new URL(manifestPath, root))
    console.log(`Slide ${slide.lessonSlide}: salvata (${bytes.length} byte).`)
  }
}

export function runLessonAudio(configuration) {
  return generateLessonAudio(configuration).catch(error => {
    // Do not serialize SDK errors: they can contain request or credential details.
    if (error.statusCode) {
      const detail = error.body?.detail
      console.error(`ElevenLabs: HTTP ${error.statusCode}${typeof detail?.status === 'string' ? ` (${detail.status})` : ''}.`)
    } else console.error(error.message || 'Generazione audio non riuscita.')
    process.exitCode = 1
  })
}
