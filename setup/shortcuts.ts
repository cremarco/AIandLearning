import { defineShortcutsSetup } from '@slidev/types'
import { useNav } from '@slidev/client'

function hasFocusedControl() {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  return active instanceof HTMLElement && (active.matches('button, a, input, textarea, select, audio, video') || active.isContentEditable)
}

export default defineShortcutsSetup((_nav, base) => {
  const nav = useNav()
  // Native media controls own their keyboard shortcuts while focused.
  // Space on other controls must not also advance the presentation.
  const shortcuts = base.map(shortcut => {
    return {
      ...shortcut,
      fn: () => {
        if (typeof document !== 'undefined' && document.activeElement?.matches('audio, video')) return
        if ((shortcut.name === 'next_space' || shortcut.name === 'prev_space') && hasFocusedControl()) return
        return shortcut.fn?.()
      },
    }
  })
  return [...shortcuts, {
    name: 'toggle_presenter',
    key: 'p',
    fn: () => {
      if (hasFocusedControl()) return
      if (nav.isPresenter.value) nav.exitPresenter()
      else nav.enterPresenter()
    },
  }]
})
