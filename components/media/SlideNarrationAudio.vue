<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import { useDocumentVisibility } from '../../composables/useDocumentVisibility'
import { useCaptionPreference } from '../../composables/useCaptionPreference'
import { useSpokenCaption } from '../../composables/useSpokenCaption'
import { useNarrationReveals } from '../../composables/useNarrationReveals'
import { useSlideLanguage } from '../../utils/slide-language'
import { assetUrl } from '../../utils/assets'
import type { NarrationReveal } from '../../utils/deck'
import { useNarrationPlayback } from '../../utils/narration-playback'

const props = defineProps<{ src: string; captions?: string; reveals?: NarrationReveal[] }>()
const { t, language } = useSlideLanguage()
const { captionsEnabled, toggleCaptions } = useCaptionPreference()
const playback = useNarrationPlayback()
const nav = useNav()
const context = nav.currentRoute.value.name === 'print' ? undefined : useSlideContext()
const visible = useDocumentVisibility()
const available = computed(() => !nav.isPrintMode.value
  && ['slide', 'presenter'].includes(context?.$renderContext.value || '')
  && context?.$page.value === nav.currentSlideNo.value)
const canPlay = computed(() => available.value && visible.value)
const source = computed(() => assetUrl(props.src))
const captionSource = computed(() => props.captions ? assetUrl(props.captions) : undefined)
const audio = playback?.audio ?? ref<HTMLAudioElement>()
const track = ref<HTMLTrackElement>()
const caption = ref('')
const captionCueId = ref('')
const captionError = ref(false)
const hasStarted = ref(false)
const playing = playback?.playing ?? ref(false)
const starting = ref(false)
const error = ref(false)
const id = useId()
const captionId = useId()
const { syncReveals } = useNarrationReveals({
  audio, reveals: computed(() => props.reveals),
  enabled: computed(() => canPlay.value && hasStarted.value && language.value === 'lt'),
  playing, page: computed(() => context?.$page.value || 0),
})
const highlightEnabled = computed(() => canPlay.value && hasStarted.value && captionsEnabled.value && !captionError.value)
const { captionParts, currentWord, spokenThrough, syncWord } = useSpokenCaption({
  audio, source: captionSource, text: caption, cueId: captionCueId, enabled: highlightEnabled, playing,
})
let request = 0
let wantsPlayback = false

function pause() {
  request++
  wantsPlayback = false
  starting.value = false
  audio.value?.pause()
  playing.value = false
}

async function play(fromBeginning = false) {
  const player = audio.value
  if (!player || !canPlay.value) return
  const currentRequest = ++request
  wantsPlayback = true
  starting.value = true
  hasStarted.value = true
  if (error.value) player.load()
  error.value = false
  const restart = fromBeginning || player.ended || player.currentTime === 0
  if (restart) player.currentTime = 0
  try {
    await syncReveals(restart)
    if (!canPlay.value || currentRequest !== request) return
    await player.play()
    if (!canPlay.value || !wantsPlayback) player.pause()
    else updateCaption()
  } catch (cause) {
    if (canPlay.value && currentRequest === request && (cause as Error).name !== 'AbortError') error.value = true
  } finally {
    if (currentRequest === request) starting.value = false
  }
}

function updateCaption() {
  const cues = Array.from(track.value?.track.activeCues ?? [])
  caption.value = cues.map(cue => (cue as VTTCue).getCueAsHTML().textContent ?? '').join('\n')
  captionCueId.value = cues[0]?.id ?? ''
  syncWord()
}
function ended() { void syncReveals(); playing.value = false; hasStarted.value = false; caption.value = '' }
function failed() { pause(); hasStarted.value = false; caption.value = ''; error.value = true }
watch(track, element => { if (element) element.track.mode = 'hidden' }, { flush: 'post' })
watch(captionSource, () => { caption.value = ''; captionError.value = false })
watch(canPlay, value => {
  if (!value) { pause(); hasStarted.value = false; caption.value = '' }
}, { flush: 'sync' })
watch(source, () => { pause(); error.value = false; hasStarted.value = false; caption.value = '' })
onBeforeUnmount(pause)
</script>

<template>
  <section v-if="available" class="slide-narration-audio" :aria-label="t('Slide audio')"
    @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
    <audio :id="id" ref="audio" :src="source" preload="none"
      @playing="playing = true" @pause="playing = false" @ended="ended" @error="failed"
      @timeupdate="syncReveals()" @seeked="updateCaption(); syncReveals(true)" @emptied="caption = ''">
      <track v-if="captionSource" :key="captionSource" ref="track" kind="captions" :src="captionSource"
        :srclang="language" :label="t('Lithuanian')" @cuechange="updateCaption" @load="updateCaption" @error="captionError = true" />
    </audio>
    <span v-if="error" class="slide-narration-error rounded-box bg-base-100 p-3 text-base-content" role="status">{{ t('Audio unavailable. Press Play to retry.') }}</span>
    <span v-else-if="captionError" class="slide-narration-error rounded-box bg-base-100 p-3 text-base-content" role="status">{{ t('Captions unavailable.') }}</span>
    <div class="join join-vertical" role="group" :aria-label="t('Audio controls')">
      <button type="button" class="btn btn-sm btn-square join-item" :aria-label="t('Play audio')" :title="t('Play audio')"
        :aria-controls="id" :disabled="!canPlay || playing || starting" @click="play()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" /></svg>
      </button>
      <button type="button" class="btn btn-sm btn-square join-item" :aria-label="t('Pause audio')" :title="t('Pause audio')"
        :aria-controls="id" :disabled="!playing && !starting" @click="pause">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
      </button>
      <button type="button" class="btn btn-sm btn-square join-item" :aria-label="t('Restart audio')" :title="t('Restart audio')"
        :aria-controls="id" :disabled="!canPlay || starting" @click="play(true)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 5.25v13.5m13.5-13.5L8.25 12l10.5 6.75V5.25Z" /></svg>
      </button>
      <button v-if="captionSource" type="button" class="btn btn-sm btn-square join-item" :aria-label="t('Captions')"
        :title="t(captionsEnabled ? 'Disable captions' : 'Enable captions')" :aria-pressed="captionsEnabled"
        :aria-controls="captionId" :disabled="captionError" @click="toggleCaptions">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M10 9.5a2.5 2.5 0 1 0 0 5m8-5a2.5 2.5 0 1 0 0 5" />
        </svg>
      </button>
    </div>
  </section>
  <div v-if="available && captionSource" :id="captionId" class="slide-narration-captions" role="region" :aria-label="t('Narration captions')"
    :hidden="!canPlay || !hasStarted || !captionsEnabled || !caption || captionError"><span v-for="(part, index) in captionParts" :key="`${captionCueId}-${index}`"
      :class="{ 'slide-caption-word': part.index >= 0, 'is-spoken': part.index >= 0 && part.index <= spokenThrough, 'is-current': part.index >= 0 && part.index === currentWord }">{{ part.text }}</span></div>
</template>

<style scoped>
.slide-narration-audio { position:absolute; z-index:40; top:50%; right:24px; width:max-content; transform:translateY(-50%); }
.slide-narration-audio svg { width:18px; height:18px; }
.slide-narration-audio .btn[aria-pressed="true"] { outline:2px solid var(--deck-cyan); outline-offset:-3px; }
.slide-narration-error { position:absolute; right:0; bottom:calc(100% + 12px); width:280px; font-size:18px; line-height:1.4; }
.slide-narration-captions { --caption-spoken:color-mix(in srgb, var(--deck-cyan) 60%, #fff); position:absolute; z-index:40; bottom:64px; left:var(--narration-caption-left,190px); right:var(--narration-caption-right,190px); padding:4px 16px; border-radius:8px; background:#000; color:#fff; font-size:22px; font-weight:500; line-height:24px; text-align:center; white-space:pre-line; pointer-events:none; }
.slide-narration-captions[hidden] { display:none; }
.slide-caption-word { color:inherit; transition:color 100ms cubic-bezier(.16, 1, .3, 1); }
.slide-caption-word.is-spoken { color:var(--caption-spoken); }
@media (prefers-reduced-motion:reduce) { .slide-caption-word { transition:none!important; } }
@media print { .slide-narration-audio, .slide-narration-captions { display:none; } }
</style>
