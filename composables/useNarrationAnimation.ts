import { onScopeDispose, watch, type Ref } from 'vue'
import type { NarrationPlayback } from '../utils/narration-playback'

/** Scrub a continuous illustration with the audio clock, without a second timer. */
export function useNarrationAnimation({ playback, active, animations, duration, onProgress }: {
  playback: NarrationPlayback | undefined
  active: Readonly<Ref<boolean>>
  animations: () => Animation[]
  duration: () => number
  onProgress: (progress: number) => void
}) {
  if (!playback) return
  let frame: number | undefined
  function stop() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }
  function sync() {
    if (!playback?.enabled.value) return
    const audio = playback.audio.value
    const progress = audio && Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.max(0, Math.min(1, audio.currentTime / audio.duration)) : 0
    for (const animation of animations()) {
      animation.pause()
      animation.currentTime = progress * duration()
    }
    onProgress(progress)
  }
  function tick() {
    sync()
    frame = requestAnimationFrame(tick)
  }
  function refresh() {
    stop()
    sync()
    if (playback?.enabled.value && active.value && playback.playing.value)
      frame = requestAnimationFrame(tick)
  }
  watch([playback.enabled, playback.audio, playback.playing, active], refresh, { immediate: true, flush: 'post' })
  watch(playback.audio, (audio, _, cleanup) => {
    if (!audio) return
    for (const event of ['loadedmetadata', 'timeupdate', 'seeked', 'ended']) audio.addEventListener(event, refresh)
    cleanup(() => {
      for (const event of ['loadedmetadata', 'timeupdate', 'seeked', 'ended']) audio.removeEventListener(event, refresh)
    })
  }, { immediate: true })
  onScopeDispose(stop)
}
