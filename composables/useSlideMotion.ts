import { useDocumentVisibility } from './useDocumentVisibility'
import { useNav, useSlideContext } from '@slidev/client'
import { computed, onMounted, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue'

/** Shared lifecycle for animation on normal slides and the custom print route. */
export function useSlideMotion(slideNumber?: MaybeRefOrGetter<number>) {
  const nav = useNav()
  const context = nav.currentRoute.value.name === 'print' ? undefined : useSlideContext()
  const visible = useDocumentVisibility()
  const reduced = ref(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const printing = ref(typeof window !== 'undefined' && window.matchMedia('print').matches)
  // Slidev renumbers the visible deck when authored slides are hidden. Use
  // the rendered page's index; authored numbers are only a context-free fallback.
  const active = computed(() => nav.currentSlideNo.value === (context?.$page.value
    ?? (slideNumber === undefined ? undefined : toValue(slideNumber))))
  const isStatic = computed(() => reduced.value || printing.value || nav.isPrintMode.value
    || !['slide', 'presenter'].includes(context?.$renderContext.value || ''))
  const running = computed(() => active.value && visible.value && !isStatic.value)
  const cleanup: (() => void)[] = []

  onMounted(() => {
    for (const [query, state] of [['(prefers-reduced-motion: reduce)', reduced], ['print', printing]] as const) {
      const preference = window.matchMedia(query)
      const update = () => { state.value = preference.matches }
      update()
      preference.addEventListener('change', update)
      cleanup.push(() => preference.removeEventListener('change', update))
    }
    const beforePrint = () => { printing.value = true }
    const afterPrint = () => { printing.value = window.matchMedia('print').matches }
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    cleanup.push(() => {
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
    })
  })
  onScopeDispose(() => cleanup.forEach(dispose => dispose()))

  return { active, isStatic, reduced, running }
}
