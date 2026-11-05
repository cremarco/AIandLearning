import { slides } from './deck'

const commands = new Set(slides.flatMap(slide => [
  ...(slide.commands || []).map(row => row.command),
  ...(slide.shortcutLabels || []).map(row => row.command),
]).map(command => command.toLowerCase()).filter(command => command.startsWith('/')))

export type CommandTextPart = { text: string; command: boolean }

/** Recognise catalogue commands, preserving punctuation, URLs and ordinary paths. */
export function splitCommandText(text: string): CommandTextPart[] {
  const parts: CommandTextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(/\/[a-z][a-z0-9_-]*/gi)) {
    const start = match.index
    const end = start + match[0].length
    if (!commands.has(match[0].toLowerCase())
      || /[\p{L}\p{N}_/.:]/u.test(text[start - 1] || '')
      || /[\p{L}\p{N}_/-]/u.test(text[end] || '')) continue
    if (start > cursor) parts.push({ text: text.slice(cursor, start), command: false })
    parts.push({ text: match[0], command: true })
    cursor = end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), command: false })
  return parts
}
