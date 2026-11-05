import { nextTick, onScopeDispose, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useSlideMotion } from './useSlideMotion'

/** A selected panel updates immediately; its brief motion can be interrupted. */
export function useSelectionMotion(element: Ref<HTMLElement | undefined>, selection: MaybeRefOrGetter<unknown>) {
  const { running } = useSlideMotion()
  let revision = 0
  let animation: Animation | undefined
  const stop = () => {
    revision++
    animation?.cancel()
    animation = undefined
  }

  watch(() => toValue(selection), async (_selected, previous) => {
    stop()
    const version = revision
    if (previous === undefined || !running.value) return
    await nextTick()
    const target = element.value
    if (!target?.animate || version !== revision || !running.value) return
    const style = getComputedStyle(target)
    const effect = target.animate([
      { transform: 'translateX(8px)', opacity: .92 },
      { transform: 'translateX(0)', opacity: 1 },
    ], {
      duration: parseFloat(style.getPropertyValue('--deck-motion-change')) || 220,
      easing: style.getPropertyValue('--deck-motion-ease').trim() || 'ease-out',
    })
    animation = effect
    effect.onfinish = () => { if (animation === effect) animation = undefined }
  })
  watch(running, allowed => { if (!allowed) stop() })
  onScopeDispose(stop)
}
