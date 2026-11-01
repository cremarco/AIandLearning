import { defineRootSetup } from '@slidev/types'
import { configs, sharedState } from '@slidev/client'
import { ref, watch } from 'vue'
import { flowOptions, useDeckFlow } from '../data/flow'

type FlowSharedState = typeof sharedState & {
  eduforumFlow?: string
  eduforumFlowSender?: string
}
const durationKey = Symbol.for('eduforum.default-duration')
const senderKey = Symbol.for('eduforum.flow-sender')
const ownSender = (Reflect.get(globalThis, senderKey) as string | undefined) ?? crypto.randomUUID()
Reflect.set(globalThis, senderKey, ownSender)

export default defineRootSetup(() => {
  const flow = useDeckFlow()
  const nav = flow.nav

  // Root setups run before RouterView: native controls, swipe navigation and
  // presenter previews all receive the same route-aware operations and refs.
  nav.next = () => flow.move(1)
  nav.prev = () => flow.move(-1)
  nav.nextSlide = lastClicks => flow.moveSlide(1, lastClicks)
  nav.prevSlide = lastClicks => flow.moveSlide(-1, lastClicks)
  nav.nextRoute = flow.nextRoute
  nav.prevRoute = flow.prevRoute
  nav.hasNext = flow.hasNext
  nav.hasPrev = flow.hasPrev
  nav.goFirst = flow.first
  nav.goLast = flow.last

  if (!Reflect.has(configs, durationKey))
    Object.defineProperty(configs, durationKey, { value: configs.duration || '90min' })
  const defaultDuration = ref(String(Reflect.get(configs, durationKey)))
  // The virtual config is a plain object. A getter must read a reactive
  // dependency so native useTimer() can recompute duration and percentage.
  Object.defineProperty(configs, 'duration', {
    configurable: true,
    enumerable: true,
    get: () => flow.selected.value ? `${flow.selected.value.minutes}min` : defaultDuration.value,
    set: (value: string) => { defaultDuration.value = value },
  })

  const shared = sharedState as FlowSharedState
  const validFlow = (id: unknown): id is string => typeof id === 'string'
    && (id === 'all' || flowOptions.some(option => option.id === id))

  // Publish only from presenter mode. Native Slidev sync continues to own
  // physical page/click state; this optional field carries route metadata.
  watch([nav.isPresenter, flow.flowId], ([isPresenter, id]) => {
    if (isPresenter) {
      shared.eduforumFlowSender = ownSender
      shared.eduforumFlow = validFlow(id) ? id : 'all'
    }
  }, { immediate: true, flush: 'sync' })

  watch([
    () => shared.eduforumFlow,
    () => shared.lastUpdate?.time,
    nav.isPresenter,
    () => nav.router.currentRoute.value.fullPath,
    () => shared.eduforumFlowSender,
  ], ([id, , isPresenter]) => {
    if (isPresenter || !nav.isPlaying.value || nav.isPrintMode.value || nav.isNotesViewer.value)
      return
    // Leaving presenter mode must not replay metadata sent by this window.
    if (shared.eduforumFlowSender === ownSender)
      return
    if (shared.lastUpdate?.type !== 'presenter' || !validFlow(id) || flow.flowId.value === id)
      return
    // A viewer that is not following the shared page keeps its local route.
    if (nav.currentPage.value !== shared.page)
      return
    // Reconcile after native page sync as well: native sync preserves the
    // receiver's own query, so simultaneous page/flow changes can race.
    void nav.router.replace({
      query: { ...nav.router.currentRoute.value.query, flow: id === 'all' ? undefined : id },
    })
  }, { immediate: true, flush: 'post' })
})
