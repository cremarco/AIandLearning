import brandData from '../data/catalogues/tool-brands.json'
import type { Slide } from './deck'

export const toolBrands = brandData
export type ToolBrandId = keyof typeof toolBrands

/** Product names in resource comparisons can refer to more than one tool. */
export function brandsForLabel(label: string): ToolBrandId[] {
  const matches: [ToolBrandId, RegExp][] = [
    ['chatgpt', /\bChatGPT\b/i],
    ['goblin', /\bGoblin(?:\.tools)?\b/i],
    ['notebook', /\bNotebook\b/i],
    ['napkin', /\bNapkin\b/i],
    ['claude', /\bClaude\b/i],
    ['magicschool', /\bMagicSchool\b/i],
    ['formative', /\bFormative\b/i],
    ['edge', /\bEdge\b/i],
    ['apple', /\bmacOS\b|\bMac dictation\b/i],
    ['windows', /\bWindows\b/i],
    ['desmos', /\bDesmos\b/i],
    ['wolfram', /\bWolfram\b/i],
    ['mindmeister', /\bMindMeister\b/i],
    ['remnote', /\bRemNote\b/i],
    ['readwrite', /\bRead&Write\b/i],
    ['forms', /\bGoogle Forms\b/i],
    ['wayground', /\bWayground\b/i],
    ['huggingface', /\bTransformers\.js\b/i],
    ['qwen', /\bQwen\b/i],
  ]
  return matches.filter(([, pattern]) => pattern.test(label)).map(([id]) => id)
}

export function brandsForSlide(slide: Slide): ToolBrandId[] {
  // The introduction already presents the original ChatGPT logo at full size.
  if (slide.kind === 'chatgpt-intro') return []
  if (slide.tool === 'dictation') return ['apple', 'windows']
  if (slide.tool && slide.tool in toolBrands) return [slide.tool as ToolBrandId]
  if (slide.commands?.length || slide.kind === 'shortcut-example' || slide.id === 'S53TYPES') return ['chatgpt']
  return []
}
