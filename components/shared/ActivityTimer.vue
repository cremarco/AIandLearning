<script setup lang="ts">
import { computed } from 'vue'
import { useActivityTimer } from '../../composables/useActivityTimer'

const { seconds, running, pristine, status, toggle, reset } = useActivityTimer()
const minutes = computed(() => Math.floor(seconds.value / 60))
const remainder = computed(() => seconds.value % 60)
const action = computed(() => running.value ? 'Pause' : seconds.value === 0
  ? 'Restart' : pristine.value ? 'Start' : 'Resume')
</script>

<template>
  <section class="activity-timer border-t border-base-300 pt-4" aria-label="Five-minute practice timer" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
    <div class="activity-timer-live">
      <div class="flex items-center justify-between gap-4 sm:gap-6">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="activity-timer-digits flex items-center text-[40px] font-semibold tabular-nums" role="timer" aria-live="polite" aria-atomic="true" :aria-label="`${minutes} minutes ${remainder} seconds remaining`">
            <span class="countdown"><span :style="{ '--value': minutes, '--digits': 2 }">{{ minutes }}</span></span>
            <span aria-hidden="true">:</span>
            <span class="countdown"><span :style="{ '--value': remainder, '--digits': 2 }">{{ remainder }}</span></span>
          </div>
          <span class="text-base text-base-content/70" role="status">{{ status }}</span>
        </div>
        <div class="flex gap-2 sm:gap-3">
          <button class="btn btn-sm" type="button" @click="toggle">{{ action }}</button>
          <button class="btn btn-sm btn-ghost" type="button" :disabled="pristine" @click="reset">Reset</button>
        </div>
      </div>
      <progress class="progress progress-primary mt-3 h-1 w-full" :value="seconds" max="300" aria-label="Time remaining" />
    </div>
    <span class="activity-timer-print">5-minute practice · 05:00</span>
  </section>
</template>

<style scoped>
.activity-timer { border-color:var(--deck-line); }
.activity-timer-digits { line-height:1; letter-spacing:0; }
.activity-timer-print { display:none; }
:global(.workshop-print) .activity-timer-live { display:none; }
:global(.workshop-print) .activity-timer-print { display:inline; }
@media print {
  .activity-timer-live { display:none; }
  .activity-timer-print { display:inline; }
}
</style>
