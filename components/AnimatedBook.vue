<script setup lang="ts">
import { useNav } from '@slidev/client'
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'

type BookPreview = {
  cover: string
  sheets: { front: string; back: string }[]
  portrait: string
  author: string
  portraitAlt: string
}
const props = defineProps<{ book: BookPreview; slideNumber: number }>()
const nav = useNav()
const isActive = computed(() => nav.currentSlideNo.value === props.slideNumber)
const reduced = ref(false)
const visible = ref(true)
const started = ref(false)
const paused = ref(false)
const finished = ref(false)
const cycle = ref(0)
const asset = (url: string) => `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`
const isStatic = computed(() => reduced.value || nav.isPrintMode.value || nav.currentRoute.value.name === 'print')
const playing = computed(() => started.value && isActive.value && visible.value && !paused.value && !finished.value)
const lastPage = computed(() => props.book.sheets.at(-1)?.back)
const status = computed(() => isStatic.value || finished.value
  ? `The book is open on its final portrait page: ${props.book.portraitAlt}`
  : paused.value ? 'Book preview paused.' : 'The cover opens and two sheets turn to reveal the final portrait page.')

watch([isActive, isStatic], ([active, still]) => {
  if (active && !still) started.value = true
}, { immediate: true })

onMounted(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const updateMotion = () => { reduced.value = preference.matches }
  const updateVisibility = () => { visible.value = !document.hidden }
  updateMotion()
  updateVisibility()
  preference.addEventListener('change', updateMotion)
  document.addEventListener('visibilitychange', updateVisibility)
  onScopeDispose(() => {
    preference.removeEventListener('change', updateMotion)
    document.removeEventListener('visibilitychange', updateVisibility)
  })
})

function replay() {
  cycle.value++
  started.value = true
  paused.value = false
  finished.value = false
}
</script>

<template>
  <div class="book-preview" role="group" aria-label="Opening and browsing the assigned book"
    :data-state="isStatic || finished ? 'open' : !started ? 'closed' : playing ? 'playing' : 'paused'"
    :style="{ '--book-play-state': playing ? 'running' : 'paused' }">
    <div v-if="isStatic" class="book-scene book-static-spread">
      <div class="book-static-page"><img :src="asset(lastPage)" alt="A page from the assigned chapter" /></div>
      <div class="book-static-page book-author-page">
        <img :src="asset(book.portrait)" :alt="book.portraitAlt" />
        <span>{{ book.author }}</span>
      </div>
    </div>
    <div v-else class="book-scene" aria-hidden="true">
      <div :key="cycle" class="book-motion" :class="{ 'is-animated': started }" @animationend.self="finished = true">
        <div class="book-base book-author-page">
          <img :src="asset(book.portrait)" alt="" />
          <span>{{ book.author }}</span>
        </div>
        <div v-for="(sheet, index) in book.sheets" :key="sheet.front" class="book-sheet" :class="`book-sheet-${index + 1}`">
          <div class="book-face book-face-front"><img :src="asset(sheet.front)" alt="" /></div>
          <div class="book-face book-face-back"><img :src="asset(sheet.back)" alt="" /></div>
        </div>
        <div class="book-cover">
          <div class="book-face book-face-front"><img :src="asset(book.cover)" alt="" /></div>
          <div class="book-face book-face-back book-inside-cover" />
        </div>
      </div>
    </div>
    <div v-if="!isStatic" class="book-controls" @click.stop>
      <button class="btn btn-sm text-sm" type="button" :disabled="finished" :aria-pressed="paused" @click="paused = !paused">{{ paused ? 'Resume' : 'Pause' }}</button>
      <button class="btn btn-sm text-sm" type="button" @click="replay">Replay book</button>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<style scoped>
.book-preview { width:100%; --book-duration:4.8s; --book-page:var(--color-stone-100); --book-ink:var(--color-zinc-900); }
.book-scene { position:relative; width:100%; height:284px; perspective:1100px; perspective-origin:50% 46%; }
.book-motion { position:absolute; left:50%; top:14px; width:180px; height:254px; transform:translateX(-90px) rotateX(8deg) rotateY(-12deg); transform-style:preserve-3d; }
.book-base, .book-sheet, .book-cover, .book-face { position:absolute; inset:0; transform-style:preserve-3d; }
.book-base { background:var(--book-page); border-radius:1px 4px 4px 1px; box-shadow:6px 9px 15px rgb(0 0 0 / .22); }
.book-sheet, .book-cover { transform-origin:left center; }
.book-sheet { z-index:3; }
.book-sheet-2 { z-index:2; }
.book-cover { z-index:5; transform:translateZ(2px); }
.book-face { overflow:hidden; backface-visibility:hidden; background:var(--book-page); border-radius:1px 3px 3px 1px; }
.book-face-back { transform:rotateY(180deg); }
.book-scene .book-face img, .book-scene .book-static-page > img { display:block; width:100%; height:100%; max-height:none; object-fit:fill; background:transparent; }
.book-inside-cover { background:var(--color-stone-200); box-shadow:inset 0 0 0 7px var(--color-stone-100); }
.book-author-page { display:flex; flex-direction:column; overflow:hidden; background:var(--book-page); }
.book-scene .book-author-page > img { display:block; flex:1; min-height:0; width:100%; height:calc(100% - 28px); max-height:none; object-fit:cover; object-position:center top; background:var(--color-zinc-950); }
.book-author-page > span { flex:0 0 28px; display:flex; align-items:center; justify-content:center; color:var(--book-ink); font-size:12px; font-weight:650; line-height:1; letter-spacing:0; }
.book-controls { display:flex; justify-content:center; gap:8px; }
.book-static-spread { display:flex; align-items:center; justify-content:center; }
.book-static-page { position:relative; width:180px; height:254px; overflow:hidden; }
.book-static-page + .book-static-page { border-left:1px solid var(--color-stone-300); }
.is-animated { animation:book-position var(--book-duration) linear both; }
.is-animated .book-cover { animation:book-open var(--book-duration) linear both; }
.is-animated .book-sheet-1 { animation:book-turn-first var(--book-duration) linear both; }
.is-animated .book-sheet-2 { animation:book-turn-last var(--book-duration) linear both; }
.is-animated, .is-animated .book-cover, .is-animated .book-sheet { animation-play-state:var(--book-play-state); }
@keyframes book-position {
  0%,8% { transform:translateX(-90px) rotateX(8deg) rotateY(-12deg); animation-timing-function:cubic-bezier(.16,1,.3,1); }
  29%,100% { transform:translateX(0) rotateX(8deg) rotateY(0); }
}
@keyframes book-open {
  0%,8% { transform:translateZ(2px) rotateY(0); z-index:5; animation-timing-function:cubic-bezier(.16,1,.3,1); }
  29%,100% { transform:translateZ(-2px) rotateY(-180deg); z-index:1; }
}
@keyframes book-turn-first {
  0%,39% { transform:rotateY(0); animation-timing-function:cubic-bezier(.16,1,.3,1); }
  59%,100% { transform:translateZ(.4px) rotateY(-180deg); }
}
@keyframes book-turn-last {
  0%,68% { transform:rotateY(0); z-index:2; }
  69% { transform:rotateY(0); z-index:4; animation-timing-function:cubic-bezier(.16,1,.3,1); }
  90%,100% { transform:translateZ(.8px) rotateY(-180deg); z-index:4; }
}
@media (prefers-reduced-motion:reduce) { .book-motion, .book-cover, .book-sheet { animation:none!important; } }
</style>
