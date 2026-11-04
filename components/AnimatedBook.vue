<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { assetUrl as asset } from '../utils/assets'
import type { BookPreview } from '../utils/deck'
import { useSlideMotion } from '../utils/slide-motion'

const props = defineProps<{ book: BookPreview; slideNumber: number }>()
const { reduced, isStatic, running: motionAllowed } = useSlideMotion(() => props.slideNumber)
const ready = ref(false)
const paused = ref(false)
const finished = ref(false)
const motionElement = ref<HTMLElement>()
const playing = computed(() => ready.value && motionAllowed.value && !paused.value && !finished.value)
// Repeat the supplied chapter spreads only as fast-turning preview leaves.
const previewSheets = computed(() => props.book.sheets.length ? [
  ...props.book.sheets,
  ...Array.from({ length: 28 }, (_, index) => props.book.sheets[index % props.book.sheets.length]),
] : [])
const frontDepth = (index: number) => 3 + 3 * (previewSheets.value.length - index) / previewSheets.value.length
const backDepth = (index: number) => 4 + 3 * index / Math.max(1, previewSheets.value.length - 1)
const status = computed(() => isStatic.value || finished.value
  ? `Fictional book. The book is closed, showing the author portrait on its back cover: ${props.book.portraitAlt}`
  : paused.value ? 'Book preview paused.' : 'The cover opens, pages turn slowly at first, then accelerate into a rapid flutter before the book closes to show the author portrait on its back cover.')

let animations: Animation[] = []
let generation = 0

function cancelAnimations() {
  for (const animation of animations) {
    animation.onfinish = null
    animation.cancel()
  }
  animations = []
}

function syncPlayback() {
  for (const animation of animations) {
    if (playing.value) animation.play()
    else animation.pause()
  }
}
watch(playing, syncPlayback, { flush: 'sync' })

watch(motionElement, async (element) => {
  const version = ++generation
  ready.value = false
  cancelAnimations()
  if (!element) return
  // Never turn to a blank page while its image is still being decoded.
  await Promise.all([...element.querySelectorAll('img')].map(image => image.decode().catch(() => {})))
  if (version !== generation) return
  if (typeof element.animate !== 'function') {
    reduced.value = true
    return
  }

  const coverStart = 1100
  const coverEnd = 2600
  let nextPageStart = 4000
  const pageTurns = previewSheets.value.map((_, index) => {
    const interval = index === 0 ? 2700 : index === 1 ? 2000 : Math.max(85, 610 * .84 ** (index - 2))
    const turnDuration = index === 0 ? 1850 : index === 1 ? 1400 : Math.max(300, Math.min(1050, interval * 2))
    const start = nextPageStart
    nextPageStart += interval
    return { start, end: start + turnDuration }
  })
  const lastTurn = pageTurns.at(-1)?.end ?? coverEnd
  const closeStart = lastTurn + 650
  const closeEnd = closeStart + 1500
  const duration = closeEnd + 900
  const at = (milliseconds: number) => milliseconds / duration
  const animate = (target: Element, keyframes: Keyframe[]) => {
    const animation = target.animate(keyframes, { duration, fill: 'both', easing: 'linear' })
    animation.pause()
    animation.currentTime = 0
    animations.push(animation)
    return animation
  }

  const closed = 'translateX(-50%) rotateX(8deg) rotateY(-18deg) rotateZ(-2deg)'
  const open = 'translateX(0) rotateX(6deg) rotateY(-3deg) rotateZ(0deg)'
  const timeline = animate(element, [
    { offset: 0, transform: closed },
    { offset: at(coverStart), transform: closed, easing: 'cubic-bezier(.22,.7,.2,1)' },
    { offset: at(coverEnd), transform: open },
    { offset: at(closeStart), transform: open, easing: 'cubic-bezier(.16,1,.3,1)' },
    { offset: at(closeEnd), transform: 'translateX(50%) rotateX(0deg) rotateY(0deg) rotateZ(0deg)' },
    { offset: 1, transform: 'translateX(50%) rotateX(0deg) rotateY(0deg) rotateZ(0deg)' },
  ])

  function turn(leaf: Element, start: number, end: number, frontDepth: number, backDepth: number, cover = false) {
    const closed = `translateZ(${frontDepth}px) rotateY(0deg) skewY(0deg)`
    const open = `translateZ(${backDepth}px) rotateY(-180deg) skewY(0deg)`
    animate(leaf, [
      { offset: 0, transform: closed },
      { offset: at(start), transform: closed, easing: 'cubic-bezier(.42,0,.55,1)' },
      { offset: at(start + (end - start) * .48), transform: `translateZ(12px) rotateY(-88deg) skewY(${cover ? 0 : -2}deg)`, easing: 'cubic-bezier(.16,1,.3,1)' },
      { offset: at(end), transform: open },
      { offset: 1, transform: open },
    ])
    for (const shade of leaf.querySelectorAll('.book-turn-shade')) {
      animate(shade, [
        { offset: 0, opacity: 0 },
        { offset: at(start), opacity: 0 },
        { offset: at(start + (end - start) * .48), opacity: .4 },
        { offset: at(end), opacity: 0 },
        { offset: 1, opacity: 0 },
      ])
    }
  }
  const cover = element.querySelector('.book-cover')
  if (cover) turn(cover, coverStart, coverEnd, 8, 1, true)
  for (const [index, sheet] of [...element.querySelectorAll('.book-sheet')].entries()) {
    // Front-to-back stack before turning; reverse stack on the left afterward.
    const { start, end } = pageTurns[index]
    turn(sheet, start, end, frontDepth(index), backDepth(index))
  }
  const backCover = element.querySelector('.book-back-cover')
  if (backCover) turn(backCover, closeStart, closeEnd, 0, 10, true)
  const pageBlock = element.querySelector('.book-page-block')
  if (pageBlock) animate(pageBlock, [
    { offset: 0, opacity: 1 },
    { offset: at(lastTurn), opacity: 1 },
    { offset: at(closeStart), opacity: 0 },
    { offset: 1, opacity: 0 },
  ])
  timeline.onfinish = () => {
    if (timeline.currentTime !== null && Number(timeline.currentTime) >= duration) finished.value = true
  }
  finished.value = false
  paused.value = false
  ready.value = true
  syncPlayback()
}, { flush: 'post' })

onScopeDispose(() => {
  generation++
  cancelAnimations()
})

function replay() {
  if (!ready.value) return
  for (const animation of animations) animation.currentTime = 0
  finished.value = false
  paused.value = false
  syncPlayback()
}
</script>

<template>
  <div class="book-preview relative" role="group" aria-label="Opening, browsing and closing the assigned book"
    :data-state="isStatic || finished ? 'closed-back' : !ready ? 'closed' : playing ? 'playing' : 'paused'">
    <div v-if="isStatic" class="book-scene book-static-back">
      <div class="book-static-page book-author-page">
        <img :src="asset(book.portrait)" :alt="book.portraitAlt" />
        <span>{{ book.author }}</span>
      </div>
    </div>
    <div v-else class="book-scene" aria-hidden="true">
      <div ref="motionElement" class="book-motion">
        <div class="book-page-block" />
        <div class="book-base book-back-cover">
          <div class="book-face book-face-front book-inside-cover"><span class="book-turn-shade" /></div>
          <div class="book-face book-face-back book-author-page">
            <img :src="asset(book.portrait)" alt="" />
            <span>{{ book.author }}</span>
            <span class="book-turn-shade" />
          </div>
        </div>
        <div v-for="(sheet, index) in previewSheets" :key="`${index}-${sheet.front}`" class="book-sheet"
          :style="{ transform: `translateZ(${frontDepth(index)}px)` }">
          <div class="book-face book-face-front"><img :src="asset(sheet.front)" alt="" /><span class="book-turn-shade" /></div>
          <div class="book-face book-face-back"><img :src="asset(sheet.back)" alt="" /><span class="book-turn-shade" /></div>
        </div>
        <div class="book-cover">
          <div class="book-face book-face-front"><img :src="asset(book.cover)" alt="" /><span class="book-turn-shade" /></div>
          <div class="book-face book-face-back book-inside-cover"><span class="book-turn-shade" /></div>
        </div>
        <div class="book-binding" />
      </div>
    </div>
    <span v-if="isStatic || finished" class="badge badge-outline book-fiction-stamp absolute top-10 inset-x-0 z-10 mx-auto h-auto rounded-sm px-4 py-2 font-mono text-2xl font-black uppercase tracking-widest">Fictional book</span>
    <div v-if="!isStatic" class="book-controls" @click.stop>
      <button class="btn btn-sm text-sm" type="button" :disabled="!ready || finished" :aria-pressed="paused" @click="paused = !paused">{{ paused ? 'Resume' : 'Pause' }}</button>
      <button class="btn btn-sm text-sm" type="button" :disabled="!ready" @click="replay">Replay book</button>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<style scoped>
.book-preview { width:100%; --book-page:var(--color-stone-100); --book-ink:var(--color-zinc-900); }
.book-scene { position:relative; width:100%; height:calc(var(--book-page-height, 254px) + 38px); perspective:calc(var(--book-page-width, 180px) * 20 / 3); perspective-origin:50% 42%; }
.book-motion { position:absolute; left:50%; top:14px; width:var(--book-page-width, 180px); height:var(--book-page-height, 254px); transform:translateX(-50%) rotateX(8deg) rotateY(-18deg) rotateZ(-2deg); transform-style:preserve-3d; }
.book-base, .book-sheet, .book-cover, .book-face { position:absolute; inset:0; transform-style:preserve-3d; }
.book-base { background:var(--book-page); border-radius:1px 3px 3px 1px; box-shadow:5px 10px 18px rgb(0 0 0 / .28); }
.book-page-block { position:absolute; inset:3px -4px -7px 0; transform:translateZ(-3px); border-right:2px solid var(--color-stone-300); border-radius:1px 3px 3px 1px; background:repeating-linear-gradient(0deg,var(--color-stone-200) 0 1px,var(--book-page) 1px 3px); box-shadow:3px 9px 16px rgb(0 0 0 / .2); }
.book-sheet, .book-cover, .book-back-cover { transform-origin:left center; }
.book-cover { inset:-2px -2px -2px 0; transform:translateZ(8px); }
.book-face { overflow:hidden; backface-visibility:hidden; background:var(--book-page); border-radius:1px 3px 3px 1px; }
.book-face-back { transform:rotateY(180deg); }
.book-face::after { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg,rgb(0 0 0 / .17),transparent 9%,transparent 94%,rgb(0 0 0 / .05)); }
.book-face-back::after { background:linear-gradient(270deg,rgb(0 0 0 / .17),transparent 9%,transparent 94%,rgb(0 0 0 / .05)); }
.book-scene .book-face img, .book-scene .book-static-page > img { display:block; width:100%; height:100%; max-height:none; object-fit:fill; background:transparent; }
.book-turn-shade { position:absolute; inset:0; opacity:0; pointer-events:none; background:linear-gradient(90deg,rgb(0 0 0 / .75),rgb(0 0 0 / .12) 65%,transparent); }
.book-inside-cover { background:var(--color-stone-200); box-shadow:inset 0 0 0 5px var(--color-stone-300); }
.book-binding { position:absolute; left:-3px; top:0; bottom:0; width:6px; transform:translateZ(7px); background:linear-gradient(90deg,rgb(0 0 0 / .3),rgb(255 255 255 / .08),rgb(0 0 0 / .18)); pointer-events:none; }
.book-author-page { display:flex; flex-direction:column; overflow:hidden; background:var(--book-page); }
.book-scene .book-author-page > img { display:block; flex:1; min-height:0; width:100%; height:calc(100% - var(--book-caption-height, 28px)); max-height:none; object-fit:cover; object-position:center top; background:var(--color-zinc-950); }
.book-author-page > span:not(.book-turn-shade) { flex:0 0 var(--book-caption-height, 28px); display:flex; align-items:center; justify-content:center; color:var(--book-ink); font-size:var(--book-caption-size, 12px); font-weight:650; line-height:1; letter-spacing:0; }
.book-fiction-stamp { --badge-color:var(--color-red-500); border:6px double currentColor; transform:rotate(-10deg); line-height:1.1; }
.book-controls { display:flex; justify-content:center; gap:8px; }
.book-static-back { display:flex; align-items:center; justify-content:center; }
.book-static-page { position:relative; width:var(--book-page-width, 180px); height:var(--book-page-height, 254px); overflow:hidden; }
</style>
