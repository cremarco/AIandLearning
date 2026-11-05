<script setup lang="ts">
import { computed, onScopeDispose, ref, useId, watch } from 'vue'
import { useNav } from '@slidev/client'
import { useRouter } from 'vue-router'
import { slides } from '../../utils/deck'
import shortcutDescriptions from '../../data/catalogues/shortcut-descriptions.json'
import { useSlideMotion } from '../../composables/useSlideMotion'

const props = defineProps<{
  items: { command: string; retained: boolean }[]
  slideNumber: number
}>()
const { running, isStatic } = useSlideMotion(() => props.slideNumber)
const nav = useNav()
const router = useRouter()
const detailSlides = new Map(slides.filter(slide => slide.kind === 'shortcut-detail').map(slide => [slide.title, slide.id.toLowerCase()]))
function openShortcut(command: string) {
  const route = detailSlides.get(command)
  if (route) { closeTooltip(); router.push(`/${route}`) }
}
const isPrint = computed(() => nav.isPrintMode.value || nav.currentRoute.value.name === 'print')
const cloud = ref<HTMLElement>()
const tooltipId = useId()
const descriptions: Record<string, string> = shortcutDescriptions
type ShortcutTooltip = { command: string; description: string; left: number; top: number; below: boolean }
const hovered = ref<ShortcutTooltip>()
const focused = ref<ShortcutTooltip>()
const tooltip = computed(() => hovered.value || focused.value)
let closeTimer: ReturnType<typeof setTimeout> | undefined
const cancelClose = () => { clearTimeout(closeTimer) }
const closeTooltip = () => { cancelClose(); hovered.value = undefined; focused.value = undefined }
function showTooltip(event: Event, command: string, source: 'hover' | 'focus') {
  if (isPrint.value || !cloud.value) return
  cancelClose()
  const rect = (event.currentTarget as SVGTextElement).getBoundingClientRect()
  const bounds = cloud.value.getBoundingClientRect()
  const scaleX = bounds.width / cloud.value.clientWidth
  const scaleY = bounds.height / cloud.value.clientHeight
  const top = (rect.top - bounds.top) / scaleY
  const below = top < 140
  const value = { command, description: descriptions[command], below,
    left: Math.max(172, Math.min(cloud.value.clientWidth - 172, (rect.left + rect.width / 2 - bounds.left) / scaleX)),
    top: below ? (rect.bottom - bounds.top) / scaleY : top }
  if (source === 'hover') { hovered.value = value; focused.value = undefined }
  else { focused.value = value; hovered.value = undefined }
}
function leaveShortcut() {
  cancelClose()
  closeTimer = setTimeout(() => { hovered.value = undefined }, 120)
}
watch(running, playing => { if (!playing) closeTooltip() })
onScopeDispose(cancelClose)
const width = 1192
const height = 648
// Large words establish an oblique rhythm; the remaining labels nest around them.
const anchors: Record<string, { x: number; y: number; size: number; angle: number }> = {
  '/flashcard': { x: .53, y: .47, size: 72, angle: -10 },
  '/quiz': { x: .23, y: .25, size: 64, angle: -10 },
  '/mindmap': { x: .74, y: .22, size: 52, angle: -10 },
  '/summary': { x: .25, y: .72, size: 50, angle: -10 },
  '/worksheet': { x: .66, y: .72, size: 43, angle: -10 },
  '/eli5': { x: .88, y: .59, size: 43, angle: 90 },
  '/studyplan': { x: .25, y: .48, size: 36, angle: -90 },
  '/rubric': { x: .49, y: .20, size: 34, angle: -10 },
}
const warm = new Set(['/quiz', '/worksheet', '/pomodoro', '/mistakelog', '/recall'])
const hash = (text: string) => [...text].reduce((seed, character) => (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0, 7)
type WordBox = { x: number; y: number; width: number; height: number; halfWidth: number; halfHeight: number; cos: number; sin: number }
const intersects = (a: WordBox, b: WordBox) => {
  if (Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || Math.abs(a.y - b.y) >= (a.height + b.height) / 2) return false
  return [[a.cos, a.sin], [-a.sin, a.cos], [b.cos, b.sin], [-b.sin, b.cos]].every(([x, y]) => {
    const radius = (box: WordBox) => box.halfWidth * Math.abs(box.cos * x + box.sin * y) + box.halfHeight * Math.abs(-box.sin * x + box.cos * y)
    return Math.abs((a.x - b.x) * x + (a.y - b.y) * y) < radius(a) + radius(b)
  })
}

const words = computed(() => {
  const occupied: WordBox[] = []
  const labels = props.items.map(item => {
    const seed = hash(item.command)
    const anchor = anchors[item.command]
    const size = anchor?.size ?? (item.retained ? 22 + seed % 3 * 2 : 17 + seed % 3)
    const angle = anchor?.angle ?? (seed % 11 === 0 ? -90 : seed % 13 === 0 ? 90 : [0, 0, -10, 10, 0][seed % 5])
    return { ...item, seed, size, angle, anchor }
  }).sort((a, b) => Number(!!b.anchor) - Number(!!a.anchor) || b.size * b.size * b.command.length - a.size * a.size * a.command.length || a.seed - b.seed)

  return labels.map(label => {
    const originX = (label.anchor?.x ?? (.5 + (label.seed % 101 - 50) / 400)) * width
    const originY = (label.anchor?.y ?? (.5 + (label.seed % 73 - 36) / 300)) * height
    const radians = Math.abs(label.angle) * Math.PI / 180
    const cos = Math.cos(label.angle * Math.PI / 180)
    const sin = Math.sin(label.angle * Math.PI / 180)
    let size = label.size
    let x = originX
    let y = originY
    let boxWidth = 0
    let boxHeight = 0
    let halfWidth = 0
    let halfHeight = 0
    let found = false
    // Conservative rotated bounds keep the lettering separate, including in print.
    while (!found && size >= 16) {
      const textWidth = label.command.length * size * .63
      halfWidth = (textWidth + 8) / 2
      halfHeight = (size * 1.2 + 8) / 2
      boxWidth = Math.cos(radians) * halfWidth * 2 + Math.sin(radians) * halfHeight * 2
      boxHeight = Math.sin(radians) * halfWidth * 2 + Math.cos(radians) * halfHeight * 2
      for (let step = 0; step < 5000; step++) {
        const radius = Math.sqrt(step) * 7
        const angle = step * 2.3999632297 + label.seed % 37
        x = originX + Math.cos(angle) * radius * 1.75
        y = originY + Math.sin(angle) * radius
        if (x - boxWidth / 2 < 8 || x + boxWidth / 2 > width - 8 || y - boxHeight / 2 < 8 || y + boxHeight / 2 > height - 8) continue
        if (occupied.some(box => intersects({ x, y, width: boxWidth, height: boxHeight, halfWidth, halfHeight, cos, sin }, box))) continue
        found = true
        break
      }
      if (!found) size--
    }
    occupied.push({ x, y, width: boxWidth, height: boxHeight, halfWidth, halfHeight, cos, sin })
    return { ...label, size, x, y, duration: 6000 + label.seed % 6000,
      phase: -(label.seed % 12000) }
  })
})
</script>

<template>
  <div ref="cloud" class="shortcut-cloud" :class="{ 'is-playing': running, 'has-tooltip': !!tooltip }" :data-motion="isStatic ? 'static' : running ? 'playing' : 'still'" @keydown.esc.stop.prevent="closeTooltip">
    <svg viewBox="0 0 1192 648" preserveAspectRatio="xMidYMid meet" :aria-hidden="isPrint || undefined" role="group" aria-label="Explore shortcut descriptions" @click.self.stop="closeTooltip">
      <g class="shortcut-field">
        <g v-for="word in words" :key="word.command" :transform="`translate(${word.x} ${word.y}) rotate(${word.angle})`">
          <g class="shortcut-float" :style="{ '--float-duration': `${word.duration}ms`, '--float-phase': `${word.phase}ms` }">
            <text :font-size="word.size" :class="{ 'is-retained': word.retained, 'is-prominent': !!word.anchor, 'is-warm': warm.has(word.command) }" text-anchor="middle" dominant-baseline="central"
              :tabindex="isPrint ? -1 : 0" :role="isPrint ? undefined : 'button'" :aria-label="word.command" :aria-describedby="tooltip?.command === word.command ? tooltipId : undefined"
              @pointerenter="showTooltip($event, word.command, 'hover')" @pointerleave="leaveShortcut"
              @focus="showTooltip($event, word.command, 'focus')" @blur="focused = undefined"
              @click.stop="openShortcut(word.command)"
              @keydown.enter.stop.prevent="openShortcut(word.command)" @keydown.space.stop.prevent="openShortcut(word.command)">{{ word.command }}</text>
          </g>
        </g>
      </g>
    </svg>
    <div v-if="tooltip" class="shortcut-tooltip tooltip tooltip-open" :class="tooltip.below ? 'tooltip-bottom' : 'tooltip-top'"
      :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }" @pointerenter="cancelClose" @pointerleave="leaveShortcut">
      <div :id="tooltipId" class="tooltip-content" role="tooltip">
        <strong>{{ tooltip.command }}</strong><span>{{ tooltip.description }}</span><span v-if="detailSlides.has(tooltip.command)" class="shortcut-tooltip-action">Click or press Enter to open the slide.</span>
      </div>
    </div>
    <ul v-if="isPrint" class="sr-only" aria-label="All tested shortcut labels">
      <li v-for="item in items" :key="item.command">{{ item.command }}: {{ descriptions[item.command] }}</li>
    </ul>
  </div>
</template>

<style scoped>
.shortcut-cloud { position:relative; width:100%; height:100%; min-height:0; }
.shortcut-cloud svg { display:block; width:100%; height:100%; overflow:visible; }
.shortcut-cloud text { font-family:var(--deck-command-font); font-weight:450; letter-spacing:0; fill:var(--deck-muted); }
.shortcut-cloud text.is-retained { fill:var(--deck-cyan); font-weight:600; }
.shortcut-cloud text.is-prominent { font-weight:750; fill:var(--deck-ink); }
.shortcut-cloud text.is-retained.is-prominent { fill:var(--deck-cyan); }
.shortcut-cloud text.is-retained.is-warm { fill:var(--deck-important); font-weight:650; }
.shortcut-cloud text[tabindex="0"] { cursor:help; pointer-events:bounding-box; }
.shortcut-cloud text:focus-visible { outline:1px solid var(--deck-cyan); outline-offset:4px; }
.shortcut-tooltip.tooltip { position:absolute; width:0; height:0; z-index:10; --tt-bg:var(--deck-raised); }
.shortcut-tooltip .tooltip-content { display:flex; flex-direction:column; gap:6px; width:320px; max-width:320px; padding:12px 16px; border:1px solid var(--deck-control-line); text-align:left; color:var(--deck-ink); font-family:var(--deck-font); font-size:18px; line-height:1.35; pointer-events:auto; }
.shortcut-tooltip strong { color:var(--deck-cyan); font-family:var(--deck-command-font); font-size:17px; }
.shortcut-tooltip .shortcut-tooltip-action { color:var(--deck-muted); font-size:15px; margin-top:2px; }
.shortcut-field { transform-origin:50% 50%; animation:shortcuts-current 16s ease-in-out infinite paused; }
/* Each word scales inside its own bounds; shared field motion preserves the gaps. */
.shortcut-float { transform-box:fill-box; transform-origin:center; animation:shortcuts-float var(--float-duration) ease-in-out var(--float-phase) infinite paused; }
.is-playing :is(.shortcut-field,.shortcut-float) { animation-play-state:running; }
.shortcut-cloud.has-tooltip :is(.shortcut-field,.shortcut-float) { animation-play-state:paused; }
@keyframes shortcuts-current {
  0%,100% { transform:translate(-8px,5px) rotate(-.3deg) scale(.985); }
  33% { transform:translate(7px,-5px) rotate(.25deg) scale(1); }
  66% { transform:translate(4px,7px) rotate(.1deg) scale(.99); }
}
@keyframes shortcuts-float {
  0%,100% { transform:scale(.92); opacity:.82; }
  50% { transform:scale(.98); opacity:1; }
}
.shortcut-cloud[data-motion="static"] :is(.shortcut-field,.shortcut-float) { animation:none; transform:none; opacity:1; }
@media (prefers-reduced-motion:reduce), print { .shortcut-field,.shortcut-float { animation:none!important; transform:none!important; opacity:1!important; } }
@media print { .shortcut-tooltip { display:none; } }
</style>
