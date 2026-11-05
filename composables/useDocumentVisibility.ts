import { onMounted, onScopeDispose, readonly, ref } from 'vue'

const visible = ref(typeof document === 'undefined' || !document.hidden)
let consumers = 0
const update = () => { visible.value = !document.hidden }

/** All mounted presentation components share one document listener. */
export function useDocumentVisibility() {
  let mounted = false
  onMounted(() => {
    mounted = true
    if (consumers++ === 0) {
      update()
      document.addEventListener('visibilitychange', update)
    }
  })
  onScopeDispose(() => {
    if (mounted && --consumers === 0) {
      document.removeEventListener('visibilitychange', update)
    }
  })
  return readonly(visible)
}
