import { computed } from 'vue'
import { useNav } from '@slidev/client'
import flows from './flows.json'
import slides from './slides.json'

export const flowOptions = flows

export function useDeckFlow() {
  const nav = useNav()
  const router = nav.router
  const flowId = computed(() => String(router.currentRoute.value.query.flow || 'all'))
  const selected = computed(() => flows.find(f => f.id === flowId.value))
  const path = computed(() => selected.value
    ? selected.value.slideIds.map(id => slides.findIndex(s => s.id === id) + 1).filter(n => n > 0)
    : slides.map((_, i) => i + 1))
  const position = computed(() => path.value.indexOf(nav.currentPage.value))
  const progress = computed(() => position.value < 0 ? 'Extra slide' : `${position.value + 1} / ${path.value.length}`)
  const currentSlide = computed(() => slides[nav.currentPage.value - 1])
  const minutes = computed(() => currentSlide.value?.duration?.[selected.value?.id || 'forum'] || 0)

  async function go(page: number) {
    await nav.go(page)
    // Inactive slides stay mounted. Release their controls so a presenter
    // can continue immediately with arrow keys or a presentation remote.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  async function choose(id: string, restart = true) {
    await router.replace({ query: { ...router.currentRoute.value.query, flow: id === 'all' ? undefined : id } })
    if (restart) await goId('S02')
  }

  async function goId(id: string) {
    const index = slides.findIndex(slide => slide.id === id)
    if (index >= 0) await go(index + 1)
  }

  async function move(direction: number) {
    if (!selected.value) return direction > 0 ? nav.next() : nav.prev()
    let index = position.value
    if (index < 0) {
      const nearest = path.value.find(n => n > nav.currentPage.value)
      return go(direction > 0 ? (nearest || path.value.at(-1)!) : path.value[0])
    }
    index = Math.max(0, Math.min(path.value.length - 1, index + direction))
    return go(path.value[index])
  }

  async function chapter(section: string) {
    const match = path.value.find(n => slides[n - 1]?.section === section)
    if (match) await go(match)
  }

  return { nav, flowId, selected, path, position, progress, currentSlide, minutes, choose, go, goId, move, chapter }
}
