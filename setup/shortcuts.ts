import { defineShortcutsSetup } from '@slidev/types'
import { useNav } from '@slidev/client'

function hasFocusedControl() {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  return active instanceof HTMLElement && (active.matches('button, a, input, textarea, select') || active.isContentEditable)
}

export default defineShortcutsSetup((_nav, base) => {
  const nav = useNav()
  // The shared bridge owns navigation. Only guard Space so activating a
  // focused control cannot also advance or rewind the presentation.
  const shortcuts = base.map(shortcut => {
    if (shortcut.name !== 'next_space' && shortcut.name !== 'prev_space') return shortcut
    return {
      ...shortcut,
      fn: () => {
        if (hasFocusedControl()) return
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
