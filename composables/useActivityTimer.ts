import { computed, onMounted, onScopeDispose, ref } from 'vue'

type TimerState = { remainingMs: number; endsAt: number | null }
const durationMs = 5 * 60 * 1000
const storageKey = 'eduforum:shortcut-practice-timer:v1'
const initialState = (): TimerState => ({ remainingMs: durationMs, endsAt: null })
const state = ref<TimerState>(initialState())
const now = ref(Date.now())
let consumers = 0
let interval: ReturnType<typeof setInterval> | undefined

function remainingAt(time: number) {
  return Math.max(0, Math.min(durationMs, state.value.endsAt === null
    ? state.value.remainingMs : state.value.endsAt - time))
}

function restore(raw: string | null) {
  try {
    const value = raw ? JSON.parse(raw) : null
    if (value && Number.isFinite(value.remainingMs) && value.remainingMs >= 0
      && value.remainingMs <= durationMs && (value.endsAt === null
        || (Number.isFinite(value.endsAt) && value.endsAt > 0))) {
      state.value = { remainingMs: value.remainingMs, endsAt: value.endsAt }
    } else {
      state.value = initialState()
    }
  } catch {
    state.value = initialState()
  }
  now.value = Date.now()
}

function onStorage(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) restore(event.newValue)
}

function save(next: TimerState) {
  state.value = next
  now.value = Date.now()
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // Keep the controls usable when browser storage is unavailable.
  }
}

/** One deadline shared by previews and same-origin presenter/audience tabs. */
export function useActivityTimer() {
  let mounted = false
  onMounted(() => {
    mounted = true
    if (consumers++ !== 0) return
    try {
      restore(window.localStorage.getItem(storageKey))
    } catch {
      now.value = Date.now()
    }
    window.addEventListener('storage', onStorage)
    // Derive remaining time from the deadline, so throttled tabs do not drift.
    interval = setInterval(() => { now.value = Date.now() }, 250)
  })
  onScopeDispose(() => {
    if (mounted && --consumers === 0) {
      clearInterval(interval)
      window.removeEventListener('storage', onStorage)
    }
  })

  const seconds = computed(() => Math.ceil(remainingAt(now.value) / 1000))
  const running = computed(() => state.value.endsAt !== null && seconds.value > 0)
  const pristine = computed(() => state.value.endsAt === null && state.value.remainingMs === durationMs)
  const status = computed(() => seconds.value === 0 ? 'Time’s up' : running.value
    ? 'Running' : pristine.value ? '5-minute practice' : 'Paused')

  function toggle() {
    const time = Date.now()
    const remainingMs = remainingAt(time)
    if (state.value.endsAt !== null && remainingMs > 0) {
      save({ remainingMs, endsAt: null })
    } else {
      const duration = remainingMs || durationMs
      save({ remainingMs: duration, endsAt: time + duration })
    }
  }

  return { seconds, running, pristine, status, toggle, reset: () => save(initialState()) }
}
