<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { assetUrl } from '../utils/assets'
import { getShortcutVideo, type ShortcutVideo } from '../utils/shortcut-videos'
import CommandTag from './CommandTag.vue'
import PromptBlock from './PromptBlock.vue'

const id = useId()
const dialog = ref<HTMLDialogElement>()
const video = ref<HTMLVideoElement>()
const selected = ref<ShortcutVideo>()
const transcript = computed(() => {
  const clip = selected.value
  if (!clip) return ''
  const marker = `\n\nPROMPT\n${clip.prompt}\n\n`
  const promptEnd = clip.transcript.indexOf(marker)
  return promptEnd < 0 ? clip.transcript : clip.transcript.slice(promptEnd + marker.length)
})

function stop() {
  video.value?.pause()
  selected.value = undefined
}

async function open(command: string) {
  const clip = getShortcutVideo(command)
  if (!clip) return
  selected.value = clip
  await nextTick()
  dialog.value?.showModal()
  video.value?.play().catch(() => {})
}

onBeforeUnmount(() => {
  video.value?.pause()
  dialog.value?.close()
})
defineExpose({ open })
</script>

<template>
  <dialog :id="id" ref="dialog" class="modal shortcut-video-dialog" :aria-labelledby="`${id}-title`" @close="stop" @click.stop @keydown.stop>
    <div class="modal-box shortcut-video-box" :style="selected ? { width: `min(96vw, ${selected.width + 48}px)` } : undefined">
      <header class="shortcut-video-header">
        <h2 :id="`${id}-title`"><CommandTag v-if="selected" :text="selected.command" /> · prompt → widget</h2>
        <form method="dialog"><button class="btn btn-ghost btn-sm" type="submit" autofocus aria-label="Close video">Close</button></form>
      </header>
      <template v-if="selected">
        <video :key="selected.command" ref="video" controls playsinline preload="metadata" :width="selected.width" :height="selected.height" :poster="assetUrl(selected.poster)" :aria-label="selected.alt">
          <source :src="assetUrl(selected.src)" type="video/mp4" />
          <track kind="captions" srclang="en" label="English" :src="assetUrl(selected.captions)" />
        </video>
        <details class="collapse collapse-arrow shortcut-video-prompt">
          <summary class="collapse-title">Tested prompt and transcript</summary>
          <div class="collapse-content">
            <PromptBlock :text="selected.prompt" label="Tested prompt" />
            <p class="shortcut-video-transcript">{{ transcript }}</p>
          </div>
        </details>
      </template>
    </div>
    <form method="dialog" class="modal-backdrop"><button aria-label="Close video backdrop" type="submit">Close</button></form>
  </dialog>
</template>

<style scoped>
.shortcut-video-box { width:min(96vw,1200px); max-width:1200px; max-height:95vh; padding:20px 24px; }
.shortcut-video-header { display:flex; align-items:center; justify-content:space-between; gap:24px; margin-bottom:14px; }
.slidev-layout .shortcut-video-header h2 { font-size:23px; line-height:1.3; }
.shortcut-video-box video { display:block; width:auto; height:auto; max-width:100%; max-height:72vh; margin-inline:auto; object-fit:contain; background:var(--color-base-100); }
.shortcut-video-prompt { margin-top:12px; font-size:16px; }
.shortcut-video-prompt .collapse-title { min-height:0; padding-block:10px; }
.shortcut-video-prompt .prompt-block { margin-block:8px 18px; }
.slidev-layout .shortcut-video-transcript { white-space:pre-wrap; font-size:16px; line-height:1.45; }
</style>
