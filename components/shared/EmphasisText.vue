<script setup lang="ts">
import { computed, inject } from 'vue'
import { EMPHASIS_TERMS_KEY, splitEmphasis, type EmphasisTerm } from '../../utils/emphasis'
import { splitCommandText } from '../../utils/command-text'
import { t } from '../../utils/language'

const props = withDefaults(defineProps<{ text?: string; terms?: readonly EmphasisTerm[] }>(), { text: '' })
const inherited = inject(EMPHASIS_TERMS_KEY, computed(() => []))
const parts = computed(() => splitEmphasis(t(props.text), props.terms || inherited.value)
  .flatMap(part => splitCommandText(part.text).map(segment => ({ ...part, ...segment }))))
</script>

<template>
  <span><template v-for="(part,index) in parts" :key="index"><code v-if="part.command" class="command-token">{{ part.text }}</code><strong v-else-if="part.emphasized" class="reading-emphasis" :class="{ 'reading-emphasis--important': part.tone === 'important', 'reading-emphasis--critical': part.tone === 'critical' }">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></span>
</template>
