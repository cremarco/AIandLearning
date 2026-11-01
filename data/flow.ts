import { computed } from 'vue'
import { useNav } from '@slidev/client'
import flows from './flows.json'
import slides from './slides.json'

type DeckNav = ReturnType<typeof useNav>
type NativeNavigation = Pick<DeckNav,
  'next' | 'prev' | 'nextSlide' | 'prevSlide' | 'goFirst' | 'goLast'
  | 'nextRoute' | 'prevRoute' | 'hasNext' | 'hasPrev'>

// Keep the original closures even if the root setup is installed again by HMR.
const nativeKey = Symbol.for('eduforum.native-navigation')
function originalNavigation(nav: DeckNav): NativeNavigation {
  const cached = Reflect.get(nav, nativeKey) as NativeNavigation | undefined
  if (cached) return cached
  const native: NativeNavigation = {
    next: nav.next,
    prev: nav.prev,
    nextSlide: nav.nextSlide,
    prevSlide: nav.prevSlide,
    goFirst: nav.goFirst,
    goLast: nav.goLast,
    nextRoute: nav.nextRoute,
    prevRoute: nav.prevRoute,
    hasNext: nav.hasNext,
    hasPrev: nav.hasPrev,
  }
  Object.defineProperty(nav, nativeKey, { value: native })
  return native
}

export const flowOptions = flows

export function useDeckFlow() {
  const nav = useNav()
  const native = originalNavigation(nav)
  const router = nav.router
  const flowId = computed(() => String(router.currentRoute.value.query.flow || 'all'))
  const selected = computed(() => flows.find(f => f.id === flowId.value))
  const followsFlow = computed(() => !!selected.value && !nav.isPrintMode.value)
  const path = computed(() => selected.value
    ? selected.value.slideIds.map(id => slides.findIndex(s => s.id === id) + 1).filter(n => n > 0)
    : slides.map((_, i) => i + 1))
  const position = computed(() => path.value.indexOf(nav.currentPage.value))
  const progress = computed(() => position.value < 0 ? 'Extra slide' : `${position.value + 1} / ${path.value.length}`)
  const currentSlide = computed(() => slides[nav.currentPage.value - 1])
  const minutes = computed(() => currentSlide.value?.duration?.[selected.value?.id || 'forum'] || 0)

  async function go(page: number, lastClicks = false) {
    // Public go() clamps this value to the destination's final click step.
    await nav.go(page, lastClicks ? Number.MAX_SAFE_INTEGER : 0)
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
  }

  async function choose(id: string, restart = true) {
    await router.replace({ query: { ...router.currentRoute.value.query, flow: id === 'all' ? undefined : id } })
    if (restart) await goId('S02')
  }

  async function goId(id: string) {
    const index = slides.findIndex(slide => slide.id === id)
    if (index >= 0) await go(index + 1)
  }

  function adjacentPage(direction: number): number | undefined {
    const index = position.value
    if (index >= 0) return path.value[index + direction]
    // Optional study cards are a detour from the evidence activity, not a
    // new event sequence. Both directions resume the stable activity ID.
    if (currentSlide.value?.type === 'evidence_card') {
      const activity = slides.findIndex(slide => slide.id === 'S33')
      return activity >= 0 ? activity + 1 : undefined
    }
    if (direction > 0) return path.value.find(page => page > nav.currentPage.value)
    return [...path.value].reverse().find(page => page < nav.currentPage.value)
  }

  const nextRoute = computed(() => followsFlow.value
    ? nav.slides.value[(adjacentPage(1) ?? nav.currentPage.value) - 1]
    : native.nextRoute.value)
  const prevRoute = computed(() => followsFlow.value
    ? nav.slides.value[(adjacentPage(-1) ?? nav.currentPage.value) - 1]
    : native.prevRoute.value)
  const hasNext = computed(() => followsFlow.value
    ? nav.clicks.value < nav.clicksTotal.value || adjacentPage(1) !== undefined
    : native.hasNext.value)
  const hasPrev = computed(() => followsFlow.value
    ? nav.clicks.value > nav.clicksStart.value || adjacentPage(-1) !== undefined
    : native.hasPrev.value)

  async function moveSlide(direction: number, lastClicks = false) {
    if (!followsFlow.value)
      return direction > 0 ? native.nextSlide(lastClicks) : native.prevSlide(lastClicks)
    const page = adjacentPage(direction)
    if (page !== undefined) await go(page, lastClicks)
  }

  async function move(direction: number) {
    if (!followsFlow.value) return direction > 0 ? native.next() : native.prev()
    if (direction > 0 && nav.clicks.value < nav.clicksTotal.value) return native.next()
    if (direction < 0 && nav.clicks.value > nav.clicksStart.value) return native.prev()
    return moveSlide(direction, direction < 0)
  }

  async function first() {
    if (!followsFlow.value) return native.goFirst()
    if (path.value.length) await go(path.value[0])
  }

  async function last() {
    if (!followsFlow.value) return native.goLast()
    if (path.value.length) await go(path.value[path.value.length - 1])
  }

  async function chapter(section: string) {
    const match = path.value.find(n => slides[n - 1]?.section === section)
    if (match) await go(match)
  }

  return {
    nav, flowId, selected, path, position, progress, currentSlide, minutes,
    nextRoute, prevRoute, hasNext, hasPrev,
    choose, go, goId, move, moveSlide, first, last, chapter,
  }
}
