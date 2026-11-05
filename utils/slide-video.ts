import { useNav } from '@slidev/client'
import { onMounted, onScopeDispose, watch, type Ref } from 'vue'

/** User-controlled recordings stop when their slide or browser tab is left. */
export function useSlideVideo(video: Ref<HTMLVideoElement | undefined>) {
  const nav = useNav()
  const pause = () => video.value?.pause()
  const pauseWhenHidden = () => { if (document.hidden) pause() }

  watch([nav.currentSlideNo, nav.isPrintMode], pause)
  onMounted(() => document.addEventListener('visibilitychange', pauseWhenHidden))
  onScopeDispose(() => {
    pause()
    document.removeEventListener('visibilitychange', pauseWhenHidden)
  })
  return pause
}
