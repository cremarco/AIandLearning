<script setup lang="ts">
import { computed } from 'vue'
import { splitCommandText } from '../utils/command-text'
import CommandTag from './CommandTag.vue'

const props = withDefaults(defineProps<{ text: string; label?: string }>(), { label: 'Prompt to copy' })
const parts = computed(() => splitCommandText(props.text))
</script>

<template>
  <div class="prompt-block">
    <span class="prompt-label">{{ label }}</span>
    <div class="chat chat-end prompt-chat">
      <div class="chat-bubble max-w-full bg-base-200 text-base-content"><template v-for="(part, index) in parts" :key="index"><CommandTag v-if="part.command" :text="part.text" /><template v-else>{{ part.text }}</template></template></div>
    </div>
  </div>
</template>

<style scoped>
.prompt-block { min-width:0; }
.prompt-chat { padding-block:0; }
.prompt-chat .chat-bubble { padding:1em 1.2em; font-size:inherit; line-height:1.4; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
</style>
