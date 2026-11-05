import type { ComputedRef, InjectionKey } from 'vue'

export const EMPHASIS_TERMS_KEY: InjectionKey<ComputedRef<readonly EmphasisTerm[]>> = Symbol('eduforum.emphasisTerms')

export type EmphasisTone = 'important' | 'critical'
export type EmphasisTerm = string | { text: string; tone: EmphasisTone }
export type TextPart = { text: string; emphasized: boolean; tone?: EmphasisTone }

// Keep the original text intact and emphasize only the first whole-word match
// of each editorial phrase. The slide's editorial list contains at most two ideas.
export function splitEmphasis(text: string, terms: readonly EmphasisTerm[], limit = 2): TextPart[] {
  const lower = text.toLowerCase()
  const isWord = (character = '') => /[\p{L}\p{N}_]/u.test(character)
  const matches = terms.filter(Boolean).flatMap(term => {
    const needle = (typeof term === 'string' ? term : term.text).toLowerCase()
    if (!needle) return []
    const tone = typeof term === 'string' ? undefined : term.tone
    let start = lower.indexOf(needle)
    while (start >= 0) {
      const end = start + needle.length
      if (!isWord(text[start - 1]) && !isWord(text[end])) return [{ start, end, tone }]
      start = lower.indexOf(needle, start + 1)
    }
    return []
  }).sort((a, b) => a.start - b.start || b.end - a.end)
  const parts: TextPart[] = []
  let cursor = 0
  let count = 0
  for (const match of matches) {
    if (match.start < cursor) continue
    if (count >= limit) break
    if (match.start > cursor) parts.push({ text: text.slice(cursor, match.start), emphasized: false })
    parts.push({ text: text.slice(match.start, match.end), emphasized: true, tone: match.tone })
    cursor = match.end
    count++
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), emphasized: false })
  return parts
}
