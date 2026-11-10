import { useNav } from '@slidev/client'
import { onScopeDispose, watch, type Ref } from 'vue'
import { useDocumentVisibility } from './useDocumentVisibility'

/** Audio and video stop when their slide or browser tab is left. */
export function useSlideVideo<T extends HTMLMediaElement>(video: Ref<T | undefined>, onLeave?: () => void) {
  const nav = useNav()
  const visible = useDocumentVisibility()
  const pause = () => {
    video.value?.pause()
    onLeave?.()
  }

  watch([nav.currentSlideNo, nav.isPrintMode], pause)
  watch(visible, shown => { if (!shown) pause() })
  onScopeDispose(pause)
  return pause
}
