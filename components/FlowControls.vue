<script setup lang="ts">
import { useDeckFlow, flowOptions } from '../data/flow'
import DeckIcon from './DeckIcon.vue'

const flow = useDeckFlow()
const textHref = `${import.meta.env.BASE_URL}materials/Accessible_Deck_EN.txt`

async function chooseRoute(event: Event) {
  const select = event.currentTarget as HTMLSelectElement
  const id = select.value
  if (id === 'all') await flow.choose('all', false)
  else await flow.choose(id, true)
  select.blur()
}
</script>

<template>
  <nav v-if="!flow.nav.isPrintMode.value" class="flow-controls" aria-label="Presentation navigation">
    <select
      class="select select-sm flow-route-select"
      :value="flow.selected.value?.id || 'all'"
      aria-label="Choose event route"
      title="Choose event route"
      @change="chooseRoute"
      @click.stop
      @keydown.stop
    >
      <option value="all">All slides</option>
      <option v-for="option in flowOptions" :key="option.id" :value="option.id">
        {{ option.name }} · {{ option.minutes }} min
      </option>
    </select>
    <button type="button" class="btn btn-ghost btn-sm flow-agenda" aria-label="Open session agenda" title="Open session agenda" @click.stop="flow.goId('S03')">Agenda</button>
    <span class="flow-status">
      <span class="flow-name">{{ flow.selected.value?.name || 'All slides' }}</span>
      <span aria-hidden="true"> · </span>{{ flow.progress.value }}
    </span>
    <a class="btn flow-text" :href="textHref" target="_blank" rel="noopener" aria-label="Open accessible text version">Text</a>
    <button type="button" class="btn btn-ghost btn-sm flow-prev" aria-label="Previous slide in selected route" title="Previous slide in selected route" :disabled="flow.position.value === 0" @click.stop="flow.move(-1)">
      <DeckIcon name="arrow-left" aria-hidden="true" focusable="false" />
    </button>
    <button type="button" class="btn btn-sm flow-next" aria-label="Next slide in selected route" title="Next slide in selected route" :disabled="flow.position.value === flow.path.value.length - 1" @click.stop="flow.move(1)">
      <span>Next</span><DeckIcon name="arrow-right" aria-hidden="true" focusable="false" />
    </button>
  </nav>
</template>
