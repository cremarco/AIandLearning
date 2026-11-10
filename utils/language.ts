import { ref } from 'vue'
import ukrainian from '#deck/uk'

export type PresentationLanguage = 'en' | 'uk'
const dictionary = ukrainian as Record<string, string>
export const supportsLanguageSwitch = Object.keys(dictionary).length > 0
const storageKey = 'ai-and-learning:mru:language'

function initialLanguage(): PresentationLanguage {
  if (!supportsLanguageSwitch || typeof window === 'undefined') return 'en'
  const url = new URL(window.location.href)
  const requested = url.searchParams.get('lang') || new URLSearchParams(url.hash.split('?')[1] || '').get('lang')
  if (requested === 'en' || requested === 'uk') return requested
  try { return window.localStorage.getItem(storageKey) === 'uk' ? 'uk' : 'en' }
  catch { return 'en' }
}

export const language = ref<PresentationLanguage>(initialLanguage())
export const t = (text: string) => language.value === 'uk' ? dictionary[text] || text : text
export const slideCountText = (number: number, total: number) => language.value === 'uk'
  ? `Слайд ${number} із ${total}` : `Slide ${number} of ${total}`

export function setPresentationLanguage(next: PresentationLanguage) {
  if (!supportsLanguageSwitch) return
  language.value = next
  try { window.localStorage.setItem(storageKey, next) } catch { /* Storage is optional. */ }
  const url = new URL(window.location.href)
  url.searchParams.set('lang', next)
  window.history.replaceState(window.history.state, '', url)
}

// Keep identifiers, native commands, recorded prompts and quoted outputs intact.
const originalFields = new Set([
  'id', 'type', 'kind', 'section', 'tool', 'audience', 'sources', 'skillIds',
  'command', 'commandCategory', 'videoLayout', 'fit', 'format', 'key',
  'primary', 'secondary', 'lang', 'status', 'executionStatus', 'reviewStatus',
  'url', 'src', 'poster', 'captions', 'transcript', 'transcriptFile', 'sha256',
  'provenance', 'source', 'icon', 'mediaType', 'prompt', 'instruction', 'instructionExcerpt', 'citation',
])

export function localizeContent<T>(value: T, field = ''): T {
  if (language.value !== 'uk' || originalFields.has(field)) return value
  if (typeof value === 'string') return (field === 'result' ? value : t(value)) as T
  if (Array.isArray(value)) return value.map(item => localizeContent(item, field)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key, key === 'text' && 'instruction' in value ? item : localizeContent(item, key),
    ])) as T
  }
  return value
}
