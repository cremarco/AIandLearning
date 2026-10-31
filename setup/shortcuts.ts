import { defineShortcutsSetup } from '@slidev/types'
import { useDeckFlow } from '../data/flow'

export default defineShortcutsSetup((_nav, base) => {
  const flow = useDeckFlow()
  const forwards = new Set(['next_space', 'next_right', 'next_page_key', 'next_down', 'next_shift'])
  const backwards = new Set(['prev_space', 'prev_left', 'prev_page_key', 'prev_up', 'prev_shift'])
  return base.map(shortcut => {
    if (!forwards.has(shortcut.name || '') && !backwards.has(shortcut.name || '')) return shortcut
    return {
      ...shortcut,
      fn: () => {
        // Space activates a focused control without also moving the deck.
        if (shortcut.name?.includes('space') && document.activeElement?.matches('button, a, input, textarea, select')) return
        return flow.move(forwards.has(shortcut.name || '') ? 1 : -1)
      },
    }
  })
})
