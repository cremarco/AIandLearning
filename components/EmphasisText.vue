<script setup lang="ts">
import { computed, inject } from 'vue'
import { EMPHASIS_TERMS_KEY, splitEmphasis, type EmphasisTerm } from '../utils/emphasis'

const props = withDefaults(defineProps<{ text?: string; terms?: readonly EmphasisTerm[] }>(), { text: '' })
const inherited = inject(EMPHASIS_TERMS_KEY, computed(() => []))
const parts = computed(() => splitEmphasis(props.text, props.terms || inherited.value))
</script>

<template>
  <span><template v-for="(part,index) in parts" :key="index"><strong v-if="part.emphasized" class="reading-emphasis" :class="{ 'reading-emphasis--critical': part.tone === 'critical' }">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></span>
</template>
