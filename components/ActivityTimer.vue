<script setup lang="ts">
import { useIsSlideActive } from '@slidev/client'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ minutes: number }>()
const isSlideActive = useIsSlideActive()

const initialMs = computed(() => {
  const duration = Math.round(props.minutes * 60_000)
  return Number.isFinite(duration) ? Math.max(0, duration) : 0
})

const remainingMs = ref(initialMs.value)
const running = ref(false)
const state = ref<'ready' | 'running' | 'paused' | 'finished'>('ready')
const announcement = ref('')
let deadline: number | null = null
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

function finish() {
  remainingMs.value = 0
  running.value = false
  deadline = null
  clearTicker()
  state.value = 'finished'
  announcement.value = 'Time is up. Finish your thought; the activity can be extended.'
}

function updateRemaining() {
  if (!running.value || deadline === null)
    return

  // Recompute from the deadline, so delayed browser ticks do not accumulate drift.
  remainingMs.value = Math.max(0, deadline - Date.now())
  if (remainingMs.value === 0)
    finish()
}

function start() {
  if (running.value || !isSlideActive.value || remainingMs.value <= 0)
    return

  deadline = Date.now() + remainingMs.value
  running.value = true
  state.value = 'running'
  announcement.value = `Timer started. ${timeDescription.value}.`
  clearTicker()
  interval = setInterval(updateRemaining, 250)
}

function pause(reason: 'manual' | 'inactive' = 'manual') {
  if (!running.value)
    return

  updateRemaining()
  if (!running.value)
    return

  running.value = false
  deadline = null
  clearTicker()
  state.value = 'paused'
  announcement.value = reason === 'inactive'
    ? `Timer paused because this slide is no longer active. ${timeDescription.value}.`
    : `Timer paused. ${timeDescription.value}.`
}

function reset() {
  clearTicker()
  deadline = null
  running.value = false
  remainingMs.value = initialMs.value
  state.value = 'ready'
  // Reset and extensions stay quiet; only start, pause and completion are announced.
  announcement.value = ''
}

function addMinute() {
  updateRemaining()
  remainingMs.value += 60_000
  if (running.value && deadline !== null)
    deadline += 60_000
  else if (state.value === 'finished')
    state.value = 'ready'
}

watch(isSlideActive, (active) => {
  if (!active)
    pause('inactive')
}, { flush: 'sync' })

watch(() => props.minutes, reset)
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
        :disabled="running || remainingMs <= 0 || !isSlideActive"
        @click="start()"
      >Start</button>
      <button type="button" class="btn" :disabled="!running" @click="pause()">Pause</button>
      <button type="button" class="btn" @click="reset()">Reset</button>
      <button type="button" class="btn" aria-label="Add one minute" @click="addMinute()">+1 min</button>
    </div>

    <p class="timer-guidance">A flexible timebox, not a test of speed. Keep access support available.</p>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </section>
</template>
