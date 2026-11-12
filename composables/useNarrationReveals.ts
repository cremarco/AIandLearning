import { onScopeDispose, watch, type Ref } from 'vue'
import { useNav } from '@slidev/client'
import { narrationClickAt } from '../utils/narration-reveals.mjs'
import type { NarrationReveal } from '../utils/deck'

/** Drive native Slidev clicks from the audio clock, independently of CC. */
export function useNarrationReveals({ audio, reveals, enabled, playing, page }: {
  audio: Ref<HTMLAudioElement | undefined>
  reveals: Readonly<Ref<NarrationReveal[] | undefined>>
  enabled: Readonly<Ref<boolean>>
  playing: Ref<boolean>
  page: Readonly<Ref<number>>
}) {
  const nav = useNav()
  let frame: number | undefined
  let pending: { page: number; click: number; promise: Promise<unknown> } | undefined

  function syncReveals(rewind = false) {
    const markers = reveals.value
    if (!enabled.value || !audio.value || !markers?.length || page.value !== nav.currentSlideNo.value) return
    const click = narrationClickAt(markers, audio.value.currentTime)
    // Manual advances remain available. Only a restart or explicit seek rewinds.
    if (rewind ? click === nav.clicks.value : click <= nav.clicks.value) return
    if (pending?.page === page.value && pending.click === click) return pending.promise
    const job = { page: page.value, click, promise: Promise.resolve(nav.go(page.value, click)) }
    pending = job
    void job.promise.finally(() => { if (pending === job) pending = undefined })
    return job.promise
  }

  function stop() {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }
  function tick() {
    void syncReveals()
    frame = requestAnimationFrame(tick)
  }
  watch([enabled, playing, reveals], () => {
    stop()
    if (enabled.value && playing.value && reveals.value?.length) {
      void syncReveals()
      frame = requestAnimationFrame(tick)
    }
  }, { flush: 'sync' })
  onScopeDispose(stop)
  return { syncReveals }
}
