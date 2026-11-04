<script setup lang="ts">
import { computed } from 'vue'
import { assetUrl } from '../utils/assets'
import type { Audience } from '../utils/deck'

const props = defineProps<{ audience: Audience, inline?: boolean }>()
const label = computed(() => ({
  student: 'For students',
  teacher: 'For teachers',
  both: 'For students and teachers',
})[props.audience])
</script>

<template>
  <div class="tooltip tooltip-bottom tooltip-end" :class="{ 'slide-audience': !inline }" :data-tip="label">
    <span class="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      role="img" :aria-label="label" tabindex="0">
      <span v-if="audience !== 'teacher'" class="audience-icon" aria-hidden="true"
        :style="{ maskImage: `url(${assetUrl('icons/heroicons/academic-cap.svg')})` }" />
      <span v-if="audience !== 'student'" class="audience-icon" aria-hidden="true"
        :style="{ maskImage: `url(${assetUrl('icons/heroicons/presentation-chart-bar.svg')})` }" />
    </span>
  </div>
</template>
