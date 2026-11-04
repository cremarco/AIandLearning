import slideData from '../data/slides.json'

export type Audience = 'student' | 'teacher' | 'both'
export type SlideCard = { title: string; body?: string; backgroundImage?: string }
export type PromptCommand = { command: string; description: string }
export type BookPreview = {
  cover: string
  sheets: { front: string; back: string }[]
  portrait: string
  author: string
  portraitAlt: string
}
export type Character = { happy: string; worried: string; happyAlt: string; worriedAlt: string }
export type SlideMedia = {
  src: string
  alt: string
  type?: 'image' | 'video'
  poster?: string
  captions?: string
  fit?: 'contain' | 'cover'
  caption?: string
  source?: string
}
export type Reference = { label: string; citation: string; url?: string; display?: string }
export type Slide = {
  id: string
  number: number
  type: 'cover' | 'profile' | 'company' | 'brief' | 'workshop'
  kind: string
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
  book?: BookPreview
  character?: Character
  commands?: PromptCommand[]
  references?: Reference[]
  formula?: boolean
  diagram?: string
  prompt?: string
  promptLabel?: string
  comparison?: { label: string; text: string; audience?: Audience }[]
  steps?: { title: string; text: string }[]
  result?: string
  resultLabel?: string
  decision?: string
  links?: { label: string; url: string; download?: boolean }[]
}

// Shared by interactive and print renderers; resolve a slide without rescanning
// the catalogue every time a component updates.
export const slides = slideData as Slide[]
const slidesById = new Map(slides.map(slide => [slide.id, slide]))
export const getSlide = (id: string) => slidesById.get(id)
