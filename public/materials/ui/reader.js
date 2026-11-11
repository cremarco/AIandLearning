// Shared controls for materials, activities and assessment.
import { copyText } from './copy-text.js'

const MIN_TEXT_SIZE = 16
const MAX_TEXT_SIZE = 36
const TEXT_SIZE_STEP = 2
let textSize = 20

function changeTextSize(step) {
  textSize = Math.max(MIN_TEXT_SIZE, Math.min(MAX_TEXT_SIZE, textSize + step))
  document.documentElement.style.setProperty('--size', `${textSize}px`)
}

document.querySelector('#smaller')?.addEventListener('click', () => changeTextSize(-TEXT_SIZE_STEP))
document.querySelector('#larger')?.addEventListener('click', () => changeTextSize(TEXT_SIZE_STEP))

for (const [id, className] of [['spacing', 'spaced'], ['theme', 'dark']]) {
  document.querySelector(`#${id}`)?.addEventListener('click', event => {
    const pressed = document.body.classList.toggle(className)
    event.currentTarget.setAttribute('aria-pressed', String(pressed))
  })
}

for (const button of document.querySelectorAll('[data-copy-prompt]')) {
  let resetTimer
  button.addEventListener('click', async () => {
    clearTimeout(resetTimer)
    const block = button.closest('.prompt-block')
    const content = block.querySelector('.chat-bubble, .prompt-terminal code')
    const feedback = block.querySelector('[data-copy-feedback]')
    feedback.hidden = true
    button.disabled = true
    try {
      await copyText(content.textContent)
      button.textContent = 'Copied!'
      resetTimer = setTimeout(() => { button.textContent = 'Copy prompt' }, 2000)
    } catch {
      button.textContent = 'Copy prompt'
      feedback.hidden = false
    } finally {
      button.disabled = false
    }
  })
}
