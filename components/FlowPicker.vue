<script setup lang="ts">
import { useDeckFlow, flowOptions } from '../data/flow'
const flow = useDeckFlow()
</script>

<template>
  <nav class="flow-picker" aria-label="Choose an event route">
    <button v-for="option in flowOptions" :key="option.id" class="btn" :aria-label="`${option.name}, ${option.minutes} minutes`" @click.stop="flow.choose(option.id)">
      <span>{{ option.name }}</span><small>{{ option.minutes }} min</small><span aria-hidden="true">↗</span>
    </button>
  </nav>
</template>
