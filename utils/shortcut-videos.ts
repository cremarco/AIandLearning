import catalogue from '../data/demos/chatgpt-videos.json'
import type { SlideMedia } from './deck'

export type ShortcutVideo = SlideMedia & {
  command: string
  prompt: string
  transcript: string
  durationSeconds: number
  width: number
  height: number
}

export const shortcutVideos = catalogue.clips as ShortcutVideo[]
const byCommand = new Map(shortcutVideos.map(clip => [clip.command.toLowerCase(), clip]))
export const getShortcutVideo = (command: string) => byCommand.get(command.toLowerCase())
