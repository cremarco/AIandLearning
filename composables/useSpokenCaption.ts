import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { captionSpokenThrough } from '../utils/caption-words.mjs'

interface CaptionWord { from: number; to: number; start: number; end: number }
interface WordCue { id: string; text: string; words: CaptionWord[] }

/** Read the same audio clock as the native VTT track; update Vue only on word changes. */
export function useSpokenCaption({ audio, source, text, cueId, enabled, playing }: {
  audio: Ref<HTMLAudioElement | undefined>; source: Readonly<Ref<string | undefined>>
  text: Ref<string>; cueId: Ref<string>; enabled: Readonly<Ref<boolean>>; playing: Ref<boolean>
}) {
  const cues = shallowRef<WordCue[]>([])
  const currentWord = ref(-1)
  const spokenThrough = ref(-1)
  const cue = computed(() => cues.value.find(cue => cue.id === cueId.value && cue.text === text.value))
  const parts = computed(() => {
    if (!cue.value) return [{ text: text.value, index: -1 }]
    const parts: { text: string; index: number }[] = []
    let offset = 0
    for (const [index, word] of cue.value.words.entries()) {
      if (word.from > offset) parts.push({ text: text.value.slice(offset, word.from), index: -1 })
      parts.push({ text: text.value.slice(word.from, word.to), index })
      offset = word.to
    }
    if (offset < text.value.length) parts.push({ text: text.value.slice(offset), index: -1 })
    return parts
  })
  let frame: number | undefined
  let controller: AbortController | undefined
  let loadedSource: string | undefined

  function syncWord() {
    const time = audio.value?.currentTime ?? 0
    spokenThrough.value = enabled.value && cue.value ? captionSpokenThrough(cue.value.words, time) : -1
    currentWord.value = cue.value && spokenThrough.value >= 0 && time < cue.value.words[spokenThrough.value].end
      ? spokenThrough.value : -1
  }
  function stopFrame() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }
  function tick() {
    syncWord()
    frame = requestAnimationFrame(tick)
  }
  watch([enabled, playing, cue], () => {
    stopFrame()
    syncWord()
    if (enabled.value && playing.value && cue.value) frame = requestAnimationFrame(tick)
  }, { flush: 'post' })

  watch([source, enabled], async ([url, active], _, onCleanup) => {
    if (!url || !active || loadedSource === url) return
    loadedSource = undefined
    cues.value = []
    controller = new AbortController()
    const signal = controller.signal
    onCleanup(() => controller?.abort())
    try {
      const response = await fetch(url.replace(/\.vtt(?=$|[?#])/u, '.words.json'), { signal })
      if (!response.ok) return
      const data = await response.json()
      if (signal.aborted || data.version !== 1 || !Array.isArray(data.cues)) return
      // Ignore malformed or stale companion data; ordinary VTT captions remain usable.
      if (!data.cues.every((cue: WordCue) => typeof cue.id === 'string' && typeof cue.text === 'string'
        && Array.isArray(cue.words) && cue.words.every(word => [word.from, word.to, word.start, word.end].every(Number.isFinite)
          && word.from >= 0 && word.to > word.from && word.to <= cue.text.length && word.end >= word.start))) return
      cues.value = data.cues
      loadedSource = url
    } catch { /* A missing word track must never interrupt the captions or narration. */ }
  }, { immediate: true })

  onBeforeUnmount(() => { stopFrame(); controller?.abort() })
  return { captionParts: parts, currentWord, spokenThrough, syncWord }
}
