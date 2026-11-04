import { useNav, useSlideContext } from '@slidev/client'
import { computed, onMounted, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue'

/** Shared lifecycle for animation on normal slides and the custom print route. */
export function useSlideMotion(slideNumber?: MaybeRefOrGetter<number>) {
  const nav = useNav()
  const context = nav.currentRoute.value.name === 'print' ? undefined : useSlideContext()
  const visible = ref(typeof document !== 'undefined' && !document.hidden)
  const reduced = ref(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const printing = ref(typeof window !== 'undefined' && window.matchMedia('print').matches)
  const active = computed(() => nav.currentSlideNo.value === (slideNumber === undefined
    ? context?.$page.value
    : toValue(slideNumber)))
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
    const updateVisibility = () => { visible.value = !document.hidden }
    const beforePrint = () => { printing.value = true }
    const afterPrint = () => { printing.value = window.matchMedia('print').matches }
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    cleanup.push(() => {
      document.removeEventListener('visibilitychange', updateVisibility)
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
    })
  })
  onScopeDispose(() => cleanup.forEach(dispose => dispose()))

  return { active, isStatic, reduced, running }
}
