<script setup lang="ts">
import { useSlideMotion } from '../../composables/useSlideMotion'

const props = defineProps<{ slideNumber: number }>()
const { running } = useSlideMotion(() => props.slideNumber)
</script>

<template>
  <svg class="download-icon size-6 shrink-0" :class="{ 'is-running': running }"
    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">
    <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
    <path class="download-arrow" d="M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
</template>

<style>
@media (prefers-reduced-motion: no-preference) {
  .download-icon.is-running .download-arrow {
    animation: download-cue 650ms 500ms cubic-bezier(.16, 1, .3, 1);
  }
  .btn:is(:hover, :focus-visible, :active) .download-icon.is-running .download-arrow {
    animation: download-feedback 650ms cubic-bezier(.16, 1, .3, 1);
  }
}
/* Separate names replay the cue when the link gains hover or keyboard focus. */
@keyframes download-cue {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(2.5px); }
}
@keyframes download-feedback {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(2.5px); }
}
@media print {
  .download-icon .download-arrow { animation: none !important; }
}
</style>
