// Shared controls for the reading guide, materials, activities and assessment.
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
