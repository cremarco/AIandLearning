<script setup lang="ts">
import { computed } from 'vue'
import { splitCommandText } from '../../utils/command-text'
import CommandTag from './CommandTag.vue'
import CopyPromptButton from './CopyPromptButton.vue'
import { language, t } from '../../utils/language'

const props = withDefaults(defineProps<{ text: string; label?: string }>(), { label: 'Prompt to copy' })
const parts = computed(() => splitCommandText(props.text))
</script>

<template>
  <div class="prompt-block">
    <div class="prompt-header flex flex-wrap items-center justify-between gap-2 sm:gap-3">
      <span class="prompt-label">{{ t(label) }}<template v-if="language === 'uk'"> · EN</template></span>
      <CopyPromptButton :text="text" />
    </div>
    <div class="chat chat-end prompt-chat" lang="en">
      <div class="chat-bubble max-w-full bg-base-200 text-base-content"><template v-for="(part, index) in parts" :key="index"><CommandTag v-if="part.command" :text="part.text" /><template v-else>{{ part.text }}</template></template></div>
    </div>
  </div>
</template>

<style scoped>
.prompt-block { min-width:0; }
.prompt-header { margin-bottom:10px; }
.prompt-chat { padding-block:0; }
.prompt-chat .chat-bubble { padding:1em 1.2em; font-size:inherit; line-height:1.4; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
</style>
