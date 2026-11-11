/** Copy the original text, including line breaks, without slide labels or formatting. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Older browsers and embedded viewers may not expose the Clipboard API.
  }

  const focused = document.activeElement
  const field = document.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.tabIndex = -1
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
  // A modal makes elements outside it inert, so keep the fallback inside it.
  const root = document.querySelector('dialog[open]') || document.body
  root.append(field)
  try {
    field.select()
    if (!document.execCommand('copy')) throw new Error('Copy was unavailable')
  } finally {
    field.remove()
    focused?.focus({ preventScroll: true })
  }
}
