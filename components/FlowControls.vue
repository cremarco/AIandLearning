<script setup lang="ts">
import { useDeckFlow } from '../data/flow'
const flow = useDeckFlow()
</script>

<template>
  <nav v-if="!flow.nav.isPrintMode.value" class="flow-controls" aria-label="Presentation navigation">
    <button class="btn btn-ghost btn-sm" aria-label="Choose event route" @click.stop="flow.go(1)">Routes</button>
    <button class="btn btn-ghost btn-sm" aria-label="Open session agenda" @click.stop="flow.go(3)">Agenda</button>
    <span class="flow-status">{{ flow.selected.value?.name || 'All slides' }} <span aria-hidden="true">·</span> {{ flow.progress.value }}</span>
    <button v-if="flow.selected.value" class="btn btn-ghost btn-sm" @click.stop="flow.choose('all', false)">All slides</button>
    <button class="btn btn-ghost btn-sm" aria-label="Previous slide in selected route" :disabled="flow.position.value === 0" @click.stop="flow.move(-1)">←</button>
    <button class="btn btn-sm" aria-label="Next slide in selected route" :disabled="flow.position.value === flow.path.value.length - 1" @click.stop="flow.move(1)">Next →</button>
  </nav>
</template>
