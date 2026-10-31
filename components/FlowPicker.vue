<script setup lang="ts">
import { useDeckFlow, flowOptions } from '../data/flow'
import DeckIcon from './DeckIcon.vue'

const flow = useDeckFlow()
</script>

<template>
  <nav class="flow-picker" aria-label="Choose an event route">
    <button v-for="option in flowOptions" :key="option.id" type="button" class="btn" :data-flow="option.id" :aria-label="`${option.name}, ${option.minutes} minutes`" @click.stop="flow.choose(option.id)">
      <span class="flow-picker-name">{{ option.name }}</span>
      <small class="flow-picker-duration">{{ option.minutes }} min</small>
      <span class="flow-picker-arrow" aria-hidden="true"><DeckIcon name="arrow-up-right" focusable="false" /></span>
    </button>
  </nav>
</template>
