<script setup lang="ts">
import { sharedState, useIsSlideActive, useNav, useSlideContext } from '@slidev/client'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ minutes: number }>()
const isSlideActive = useIsSlideActive()
const nav = useNav()
const { $page, $renderContext } = useSlideContext()

type ActivityTimerState = {
  status: 'stopped' | 'running' | 'paused' | 'finished'
  remainingMs: number
  deadline: number | null
  announcement: string
}
const shared = sharedState as typeof sharedState & {
  eduforumTimers?: Record<string, ActivityTimerState>
}
const flowId = computed(() => String(nav.router.currentRoute.value.query.flow || 'all'))
const timerKey = computed(() => `${$page.value}:${flowId.value}`)
const canMutate = computed(() => (
  ($renderContext.value === 'slide' || $renderContext.value === 'presenter')
  && !nav.isPrintMode.value
))

const initialMs = computed(() => {
  const duration = Math.round(props.minutes * 60_000)
  return Number.isFinite(duration) ? Math.max(0, duration) : 0
})

// A newly mounted copy only reads the shared record. In particular, presenter
// previews and changes to minutes must not reset a timer in the other window.
const timer = computed<ActivityTimerState>(() => shared.eduforumTimers?.[timerKey.value] ?? {
  status: 'stopped',
  remainingMs: initialMs.value,
  deadline: null,
  announcement: '',
})
const now = ref(Date.now())
const remainingMs = computed(() => timer.value.status === 'running' && timer.value.deadline !== null
  ? Math.max(0, timer.value.deadline - now.value)
  : timer.value.remainingMs)
const running = computed(() => timer.value.status === 'running')
const state = computed(() => timer.value.status === 'stopped' ? 'ready' : timer.value.status)
const announcement = computed(() => canMutate.value ? timer.value.announcement : '')
let interval: ReturnType<typeof setInterval> | undefined

const secondsRemaining = computed(() => Math.ceil(remainingMs.value / 1_000))
const displayTime = computed(() => {
  const minutes = Math.floor(secondsRemaining.value / 60)
  const seconds = secondsRemaining.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})
const timeDescription = computed(() => {
  const minutes = Math.floor(secondsRemaining.value / 60)
  const seconds = secondsRemaining.value % 60
  return `${minutes} minute${minutes === 1 ? '' : 's'} and ${seconds} second${seconds === 1 ? '' : 's'} remaining`
})
const stateLabel = computed(() => ({
  ready: 'Ready — starts only when you choose',
  running: 'Running',
  paused: 'Paused — select Start to continue',
  finished: 'Time is up — extend if useful',
})[state.value])

function clearTicker() {
  if (interval !== undefined) {
    clearInterval(interval)
    interval = undefined
  }
}

function writeTimer(key: string, value: ActivityTimerState) {
  if (!canMutate.value)
    return
  // Broadcast actions and completion, never the local display ticks.
  shared.eduforumTimers = { ...shared.eduforumTimers, [key]: value }
}

function describeTime(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1_000)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes} minute${minutes === 1 ? '' : 's'} and ${remainder} second${remainder === 1 ? '' : 's'} remaining`
}

function finish(key: string) {
  if (shared.eduforumTimers?.[key]?.status !== 'running')
    return
  writeTimer(key, {
    status: 'finished',
    remainingMs: 0,
    deadline: null,
    announcement: 'Time is up. Finish your thought; the activity can be extended.',
  })
}

function updateRemaining() {
  // Recompute from the deadline, so delayed browser ticks do not accumulate drift.
  now.value = Date.now()
  if (running.value && remainingMs.value === 0 && canMutate.value && isSlideActive.value)
    finish(timerKey.value)
}

function start() {
  if (!canMutate.value || running.value || !isSlideActive.value || remainingMs.value <= 0)
    return

  now.value = Date.now()
  const remaining = remainingMs.value
  writeTimer(timerKey.value, {
    status: 'running',
    remainingMs: remaining,
    deadline: now.value + remaining,
    announcement: `Timer started. ${describeTime(remaining)}.`,
  })
}

function pauseTimer(key: string, reason: 'manual' | 'inactive') {
  const current = shared.eduforumTimers?.[key]
  if (!canMutate.value || current?.status !== 'running' || current.deadline === null)
    return

  now.value = Date.now()
  const remaining = Math.max(0, current.deadline - now.value)
  if (remaining === 0) {
    finish(key)
    return
  }
  writeTimer(key, {
    status: 'paused',
    remainingMs: remaining,
    deadline: null,
    announcement: reason === 'inactive'
      ? `Timer paused because this slide is no longer active. ${describeTime(remaining)}.`
      : `Timer paused. ${describeTime(remaining)}.`,
  })
}

function pause() {
  if (isSlideActive.value)
    pauseTimer(timerKey.value, 'manual')
}

function reset() {
  if (!isSlideActive.value)
    return
  writeTimer(timerKey.value, {
    status: 'stopped',
    remainingMs: initialMs.value,
    deadline: null,
    // Reset and extensions stay quiet; only start, pause and completion announce.
    announcement: '',
  })
}

function addMinute() {
  if (!canMutate.value || !isSlideActive.value)
    return
  updateRemaining()
  const current = timer.value
  writeTimer(timerKey.value, {
    ...current,
    status: current.status === 'finished' ? 'stopped' : current.status,
    remainingMs: remainingMs.value + 60_000,
    deadline: current.status === 'running' && current.deadline !== null
      ? current.deadline + 60_000
      : null,
  })
}

watch([timerKey, isSlideActive, canMutate], ([key, active, mutable], previous) => {
  const [previousKey, wasActive, wasMutable] = previous
  // On a flow change the old record must pause, not the new activity branch.
  if (mutable && wasMutable && wasActive && (!active || key !== previousKey))
    pauseTimer(previousKey, 'inactive')
}, { flush: 'sync' })

watch([timerKey, () => timer.value.status, () => timer.value.deadline], () => {
  clearTicker()
  now.value = Date.now()
  if (running.value)
    interval = setInterval(updateRemaining, 250)
}, { immediate: true, flush: 'sync' })

onBeforeUnmount(clearTicker)
</script>

<template>
  <section
    class="activity-timer"
    role="group"
    aria-label="Activity timer"
    @click.stop
    @keydown.stop
  >
    <div class="timer-readout">
      <p class="timer-label">Activity timer</p>
      <p
        class="timer-value"
        role="timer"
        aria-live="off"
        :aria-label="timeDescription"
      >
        {{ displayTime }}
      </p>
      <p class="timer-state" aria-live="off">{{ stateLabel }}</p>
    </div>

    <div class="timer-actions">
      <button
        type="button"
        class="btn"
        :disabled="running || remainingMs <= 0 || !isSlideActive || !canMutate"
        @click="start()"
      >Start</button>
      <button type="button" class="btn" :disabled="!running || !isSlideActive || !canMutate" @click="pause()">Pause</button>
      <button type="button" class="btn" :disabled="!isSlideActive || !canMutate" @click="reset()">Reset</button>
      <button type="button" class="btn" aria-label="Add one minute" :disabled="!isSlideActive || !canMutate" @click="addMinute()">+1 min</button>
    </div>

    <p class="timer-guidance">A flexible timebox, not a test of speed. Keep access support available.</p>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </section>
</template>
