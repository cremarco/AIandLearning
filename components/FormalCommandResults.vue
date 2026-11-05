<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PromptCommand } from '../utils/deck'
import { assetUrl } from '../utils/assets'
import PromptBlock from './PromptBlock.vue'

const props = defineProps<{ commands: PromptCommand[] }>()
const selectedIndex = ref(0)
const selected = computed(() => props.commands[selectedIndex.value] || props.commands[0])
const result = computed(() => selected.value?.result)
</script>

<template>
  <div class="formal-command-results grid grid-cols-1 md:grid-cols-[380px_minmax(0,1fr)]">
    <nav aria-label="Recorded formal actions">
      <ul class="menu menu-vertical formal-command-menu">
        <li v-for="(command, index) in commands" :key="command.command">
          <button type="button" :class="{ 'menu-active': selectedIndex === index }" :aria-pressed="selectedIndex === index" @click.stop="selectedIndex = index">
            {{ command.command }}
          </button>
        </li>
      </ul>
      <PromptBlock v-if="selected?.command === 'Study' && result" class="formal-prompt" label="Prompt after selecting Study" :text="result.instruction" />
      <template v-else>
        <p class="formal-instruction-label">Action</p>
        <p class="formal-instruction">{{ result?.instruction }}</p>
      </template>
    </nav>
    <section v-if="result" class="formal-command-output" :data-command="selected.command" :data-result-status="result.status" aria-live="polite">
      <h2>{{ result.label }}</h2>
      <p v-if="result.text" class="formal-response">{{ result.text }}</p>
      <img v-else class="formal-result-image" :src="assetUrl(result.media.src)" :alt="result.media.alt" />
      <p class="formal-result-caption">{{ result.media.caption }}</p>
      <div class="formal-result-links">
        <a class="link" :href="assetUrl(result.media.src)" target="_blank" rel="noopener">Open original capture</a>
        <a v-if="result.inputCapture" class="link" :href="assetUrl(result.inputCapture)" target="_blank" rel="noopener">Study selection and prompt</a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.formal-command-results { width:100%; gap:42px; align-self:stretch; align-items:start; }
.formal-command-results nav { min-width:0; }
.slidev-layout .formal-command-menu { width:100%; padding:0; gap:0; background:none; font-size:22px; }
.slidev-layout .formal-command-menu li { margin:0; padding:0; }
.slidev-layout .formal-command-menu button { min-height:28px; padding:2px 12px; border-radius:5px; line-height:1.1; color:var(--deck-ink); }
.slidev-layout .formal-command-menu button.menu-active { color:var(--deck-cyan); background:var(--deck-surface); font-weight:700; }
.slidev-layout .formal-instruction-label { margin-top:20px; font-size:16px; color:var(--deck-muted); }
.slidev-layout .formal-instruction { margin-top:7px; font-size:18px; line-height:1.3; }
.formal-prompt { margin-top:12px; font-size:16px; }
.formal-prompt :deep(.prompt-label) { font-size:15px; margin-bottom:7px; }
.formal-command-output { display:flex; min-width:0; flex-direction:column; gap:13px; padding-top:4px; }
.slidev-layout .formal-command-output h2 { font-size:23px; color:var(--deck-cyan); }
.slidev-layout .formal-response { white-space:pre-line; font-size:22px; line-height:1.3; }
.formal-result-image { display:block; width:100%; max-height:270px; object-fit:contain; object-position:left top; }
.slidev-layout .formal-result-caption { font-size:17px; line-height:1.3; color:var(--deck-muted); }
.formal-result-links { display:flex; flex-wrap:wrap; gap:10px 24px; font-size:16px; }
</style>
