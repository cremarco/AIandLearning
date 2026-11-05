import { useNav } from '@slidev/client'
import { onScopeDispose, watch, type Ref } from 'vue'
import { useDocumentVisibility } from './useDocumentVisibility'

/** Recordings stop when their slide or browser tab is left. */
export function useSlideVideo(video: Ref<HTMLVideoElement | undefined>) {
  const nav = useNav()
  const visible = useDocumentVisibility()
  const pause = () => video.value?.pause()

  watch([nav.currentSlideNo, nav.isPrintMode], pause)
  watch(visible, shown => { if (!shown) pause() })
  onScopeDispose(pause)
  return pause
}
