<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSlideVideo } from '../utils/slide-video'
import type { PromptCommand } from '../utils/deck'
import { assetUrl } from '../utils/assets'
import CommandTag from './CommandTag.vue'
import EmphasisText from './EmphasisText.vue'

const props = defineProps<{ commands: PromptCommand[] }>()
const selectedIndex = ref(0)
const selected = computed(() => props.commands[selectedIndex.value] || props.commands[0])
const result = computed(() => selected.value?.result)
const video = ref<HTMLVideoElement>()
const pauseVideo = useSlideVideo(video)
watch(selectedIndex, pauseVideo)
</script>

<template>
  <div class="formal-command-results" :class="selected?.command === 'Study' ? 'formal-study-chat' : 'formal-split'">
    <section v-if="selected?.command === 'Study' && result" class="formal-study-conversation" :data-command="selected.command" :data-result-status="result.status" aria-label="Recorded Study conversation" aria-live="polite">
      <div class="chat chat-end">
        <div class="chat-header">You · Prompt after selecting Study</div>
        <div class="chat-bubble max-w-[850px] bg-base-200 text-base-content"><CommandTag text="/Study" class="mr-2" /><EmphasisText :text="result.instruction" /></div>
      </div>
      <div class="chat chat-start">
        <div class="chat-header">ChatGPT · {{ result.label }}</div>
        <div class="chat-bubble max-w-[1060px]"><EmphasisText :text="result.text" /></div>
        <div class="chat-footer formal-study-evidence">
          <p>{{ result.media.caption }}</p>
        </div>
      </div>
    </section>
    <template v-else>
      <nav aria-label="Recorded formal actions">
        <ul v-if="commands.length > 1" class="menu menu-vertical formal-command-menu">
          <li v-for="(command, index) in commands" :key="command.command">
            <button type="button" :class="{ 'menu-active': selectedIndex === index }" :aria-pressed="selectedIndex === index" @click.stop="selectedIndex = index">
              <CommandTag :text="command.command" />
            </button>
          </li>
        </ul>
        <p class="formal-instruction-label">Action</p>
        <CommandTag v-if="selected" :text="selected.command" class="mt-2" />
        <p class="formal-instruction">{{ result?.instruction }}</p>
      </nav>
      <section v-if="result" class="formal-command-output" :data-command="selected.command" :data-result-status="result.status" aria-live="polite">
        <h2>{{ result.label }}</h2>
        <p v-if="result.text" class="formal-response">{{ result.text }}</p>
        <figure v-else-if="result.media.type === 'video'" class="formal-recording">
          <video ref="video" :key="result.media.src" controls playsinline preload="none" :poster="assetUrl(result.media.poster || '')" :aria-label="result.media.alt" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
            <source :src="assetUrl(result.media.src)" type="video/mp4" />
            <track v-if="result.media.captions" kind="captions" srclang="en" label="English" :src="assetUrl(result.media.captions)" :default="result.media.captionsDefault !== false" />
          </video>
          <img class="formal-print-poster" :src="assetUrl(result.media.poster || '')" :alt="result.media.alt" />
        </figure>
        <img v-else class="formal-result-image" :src="assetUrl(result.media.src)" :alt="result.media.alt" />
        <p class="formal-result-caption">{{ result.media.caption }}</p>
        <div class="formal-result-links">
          <a v-if="selected.command !== 'Study'" class="link" :href="assetUrl(result.media.src)" target="_blank" rel="noopener" @click.stop @keydown.stop>{{ result.media.type === 'video' ? 'Open video' : 'Open original capture' }}</a>
          <a v-if="result.media.type === 'video' && result.media.source" class="link" :href="result.media.source" target="_blank" rel="noopener" @click.stop @keydown.stop>Original conversation</a>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.formal-command-results { width:100%; gap:42px; align-self:stretch; align-items:start; }
.formal-split { display:grid; grid-template-columns:320px minmax(0,1fr); }
.formal-command-results nav { min-width:0; }
.slidev-layout .formal-command-menu { width:100%; padding:0; gap:0; background:none; font-size:22px; }
.slidev-layout .formal-command-menu li { margin:0; padding:0; }
.slidev-layout .formal-command-menu button { min-height:28px; padding:2px 12px; border-radius:5px; line-height:1.1; color:var(--deck-ink); }
.slidev-layout .formal-command-menu button.menu-active { color:var(--deck-cyan); background:var(--deck-surface); font-weight:700; }
.slidev-layout .formal-instruction-label { margin-top:20px; font-size:16px; color:var(--deck-muted); }
.slidev-layout .formal-instruction { margin-top:7px; font-size:18px; line-height:1.3; }
.formal-study-conversation { width:100%; display:flex; flex-direction:column; gap:12px; }
.formal-study-conversation .chat { padding-block:0; row-gap:6px; }
.formal-study-conversation .chat-header { font-size:17px; line-height:1.25; font-weight:650; color:var(--deck-cyan); }
.formal-study-conversation .chat-end .chat-header { color:var(--deck-muted); }
.formal-study-conversation .chat-bubble { padding:12px 20px; white-space:pre-line; font-size:21px; line-height:1.3; }
.formal-study-conversation .formal-study-evidence { display:flex; flex-direction:column; gap:6px; padding-top:3px; color:var(--deck-muted); font-size:16px; line-height:1.25; }
.formal-command-output { display:flex; min-width:0; flex-direction:column; gap:13px; padding-top:4px; }
.slidev-layout .formal-command-output h2 { font-size:23px; color:var(--deck-cyan); }
.slidev-layout .formal-response { white-space:pre-line; font-size:22px; line-height:1.3; }
.formal-result-image { display:block; width:100%; max-height:270px; object-fit:contain; object-position:left top; }
.formal-recording { margin:0; min-width:0; }
.formal-recording video,.formal-print-poster { display:block; width:100%; max-height:320px; object-fit:contain; object-position:left top; border-radius:12px; }
.formal-recording .formal-print-poster { display:none; }
:global(.workshop-print) .formal-recording video { display:none; }
:global(.workshop-print) .formal-recording .formal-print-poster { display:block; }
@media print { .formal-recording video { display:none; } .formal-recording .formal-print-poster { display:block; } }
.slidev-layout .formal-result-caption { font-size:17px; line-height:1.3; color:var(--deck-muted); }
.formal-result-links { display:flex; flex-wrap:wrap; gap:10px 24px; font-size:16px; }
</style>
