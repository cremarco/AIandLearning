import { onMounted, ref } from 'vue'

const enabled = ref(true)
const key = 'eduforum-captions-enabled'
let initialized = false

/** Share the preference across slides without coupling it to audio playback. */
export function useCaptionPreference() {
  onMounted(() => {
    if (initialized) return
    initialized = true
    try { enabled.value = localStorage.getItem(key) !== 'false' } catch { /* Storage may be unavailable. */ }
  })
  function toggle() {
    enabled.value = !enabled.value
    try { localStorage.setItem(key, String(enabled.value)) } catch { /* Keep the in-memory preference. */ }
  }
  return { captionsEnabled: enabled, toggleCaptions: toggle }
}
