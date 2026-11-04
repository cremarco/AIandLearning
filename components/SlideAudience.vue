<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ audience: 'student' | 'teacher' | 'both' }>()
const base = import.meta.env.BASE_URL
const label = computed(() => ({
  student: 'For students',
  teacher: 'For teachers',
  both: 'For students and teachers',
})[props.audience])
</script>

<template>
  <div class="slide-audience tooltip tooltip-bottom tooltip-end rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" :data-tip="label"
    role="img" :aria-label="label" tabindex="0">
    <span v-if="audience !== 'teacher'" class="audience-icon" aria-hidden="true"
      :style="{ maskImage: `url(${base}icons/heroicons/academic-cap.svg)` }" />
    <span v-if="audience !== 'student'" class="audience-icon" aria-hidden="true"
      :style="{ maskImage: `url(${base}icons/heroicons/presentation-chart-bar.svg)` }" />
  </div>
</template>
