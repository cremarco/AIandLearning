import catalogue from '../data/generated/shortcut-videos.json'
import type { SlideMedia } from './deck'
import { assetUrl } from './assets'

export type ShortcutVideo = SlideMedia & {
  command: string
  prompt: string
  transcriptFile?: string
  durationSeconds: number
  width: number
  height: number
  sha256: string
}

export const shortcutVideos = catalogue as ShortcutVideo[]
const byCommand = new Map(shortcutVideos.map(clip => [clip.command.toLowerCase(), clip]))
export const getShortcutVideo = (command: string) => byCommand.get(command.toLowerCase())

const transcripts = new Map<string, string>()

/** Transcript text is requested only when the learner expands its details. */
export async function loadShortcutTranscript(clip: ShortcutVideo, signal?: AbortSignal) {
  if (clip.transcript) return clip.transcript
  if (!clip.transcriptFile) throw new Error('This recording has no transcript file.')
  const url = assetUrl(clip.transcriptFile)
  const key = `${clip.sha256}:${url}`
  const cached = transcripts.get(key)
  if (cached !== undefined) return cached
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Transcript request failed (${response.status}).`)
  const text = await response.text()
  signal?.throwIfAborted()
  transcripts.set(key, text)
  return text
}
