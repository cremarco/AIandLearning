import slideData from '#deck/slides'
import { computed } from 'vue'
import { language, localizeContent } from './language'

export type Audience = 'student' | 'teacher' | 'both'
export type StudyPhase = 'plan' | 'understand' | 'connect' | 'recall' | 'apply' | 'check'
export type StudyFocus = { primary: StudyPhase | 'support'; secondary?: StudyPhase[] }
export type SlideCard = { title: string; body?: string; backgroundImage?: string }
export type CommandResult = {
  label: string
  instruction: string
  instructionExcerpt?: string
  text?: string
  media: SlideMedia
  status: 'executed' | 'opened' | 'not-executed'
  inputCapture?: string
}
export type PromptCommand = { command: string; description: string; result?: CommandResult }
export type CommandCategory = 'formal-web' | 'formal-desktop' | 'informal'
export type BookPreview = {
  cover: string
  sheets: { front: string; back: string }[]
  portrait: string
  author: string
  portraitAlt: string
}
export type Character = { happy: string; worried: string; happyAlt: string; worriedAlt: string }
export type ResultDownload = {
  kind: 'file'
  url: string
  label: string
  mediaType: string
  download: true
  sha256: string
  bytes: number
}
export type VideoResult = {
  kind: 'chatgpt-share' | 'native' | 'file'
  url: string
  label: string
  interactiveVerified: boolean
  recipientVerified: boolean
  ownerIndependent: boolean
  qualification?: string
  mediaType?: string
  download?: boolean
  supplemental?: ResultDownload[]
}
export type SlideMedia = {
  src: string
  alt: string
  type?: 'image' | 'video'
  poster?: string
  captions?: string
  captionsDefault?: boolean
  browserFrame?: boolean
  darkFrame?: boolean
  fit?: 'contain' | 'cover'
  caption?: string
  source?: string
  transcript?: string
  transcriptFile?: string
  provenance?: string
  durationSeconds?: number
  sha256?: string
  result?: VideoResult
}
export type Reference = { label: string; citation: string; url?: string; display?: string; group?: string; shortTitle?: string }
export type ToolTable = {
  headers: [string, string, string]
  rows: { tool: string; purpose: string; access: string; url: string }[]
}
export type ScreenshotResult = {
  label: string
  src: string
  width?: number
  height?: number
  alt: string
  caption: string
  format: string
  prompt: string
}
export type Slide = {
  id: string
  number: number
  type: 'cover' | 'profile' | 'company' | 'brief' | 'workshop'
  kind: string
  clicks?: number
  title: string
  message: string
  body: string[]
  sources: string[]
  audience: Audience
  lang?: string
  tool?: string
  todo?: string
  takeaway?: string
  cardBackground?: string
  cards?: SlideCard[]
  media?: SlideMedia
  screenshots?: ScreenshotResult[]
  book?: BookPreview
  character?: Character
  commands?: PromptCommand[]
  shortcutLabels?: { command: string; retained: boolean }[]
  commandCategory?: CommandCategory
  skillIds?: string[]
  studyPhases?: StudyFocus
  toolTable?: ToolTable
  references?: Reference[]
  prompt?: string
  promptLabel?: string
  promptStyle?: 'terminal' | 'chat'
  videoLayout?: 'focus' | 'prompt'
  comparison?: { label: string; text: string; audience?: Audience; icon?: string }[]
  steps?: { title: string; text: string }[]
  activityTimer?: { minutes: number; id: string }
  result?: string
  resultLabel?: string
  decision?: string
  links?: { label: string; url: string; download?: boolean }[]
}

// Shared by interactive and print renderers; resolve a slide without rescanning
// the catalogue every time a component updates.
export const slides = slideData as Slide[]
const thanksIndex = slides.findIndex(slide => slide.kind === 'thanks')
export const presentationSlideCount = thanksIndex < 0 ? slides.length : thanksIndex + 1
const slidesById = computed(() => new Map(slides.map(slide => [slide.id,
  language.value === 'uk' ? { ...localizeContent(slide), lang: 'uk' } : slide,
])))
export const getSlide = (id: string) => slidesById.value.get(id)
