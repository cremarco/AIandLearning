<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, watch } from 'vue'
import { useSlideVideo } from '../../composables/useSlideVideo'
import { assetUrl } from '../../utils/assets'
import { getShortcutVideo, loadShortcutTranscript, type ShortcutVideo } from '../../utils/shortcut-videos'
import CommandTag from '../shared/CommandTag.vue'
import PromptBlock from '../shared/PromptBlock.vue'
import RecordingResultLinks from '../shared/RecordingResultLinks.vue'
import { t } from '../../utils/language'

const id = useId()
const dialog = ref<HTMLDialogElement>()
const video = ref<HTMLVideoElement>()
const selected = shallowRef<ShortcutVideo>()
const transcriptText = ref('')
const transcriptLoading = ref(false)
const transcriptError = ref(false)
let transcriptRequest: AbortController | undefined
const transcript = computed(() => {
  const clip = selected.value
  if (!clip) return ''
  const marker = `\n\nPROMPT\n${clip.prompt}\n\n`
  const promptEnd = transcriptText.value.indexOf(marker)
  return promptEnd < 0 ? transcriptText.value : transcriptText.value.slice(promptEnd + marker.length)
})

function stop() {
  video.value?.pause()
  transcriptRequest?.abort()
  transcriptRequest = undefined
  selected.value = undefined
}

function close() {
  dialog.value?.close()
  stop()
}

useSlideVideo(video, close)
watch(selected, () => {
  transcriptRequest?.abort()
  transcriptRequest = undefined
  transcriptText.value = ''
  transcriptLoading.value = false
  transcriptError.value = false
})

async function loadTranscript() {
  const clip = selected.value
  if (!clip || transcriptLoading.value || transcriptText.value) return
  const request = new AbortController()
  transcriptRequest = request
  transcriptLoading.value = true
  transcriptError.value = false
  try {
    const text = await loadShortcutTranscript(clip, request.signal)
    if (!request.signal.aborted && selected.value === clip) transcriptText.value = text
  } catch {
    if (!request.signal.aborted && selected.value === clip) transcriptError.value = true
  } finally {
    if (transcriptRequest === request) {
      transcriptRequest = undefined
      transcriptLoading.value = false
    }
  }
}

function onTranscriptToggle(event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open) void loadTranscript()
}

async function open(command: string) {
  const clip = getShortcutVideo(command)
  if (!clip) return
  if (selected.value !== clip) {
    video.value?.pause()
    transcriptRequest?.abort()
  }
  selected.value = clip
  await nextTick()
  if (selected.value !== clip) return
  if (dialog.value && !dialog.value.open) dialog.value.showModal()
  video.value?.play().catch(() => {})
}

defineExpose({ open })
</script>

<template>
  <dialog :id="id" ref="dialog" class="modal shortcut-video-dialog" :aria-labelledby="`${id}-title`" @close="stop" @click.stop @keydown.stop @keyup.stop>
    <div class="modal-box shortcut-video-box" :style="selected ? { width: `min(96vw, ${selected.width + 48}px)` } : undefined">
      <header class="shortcut-video-header">
        <h2 :id="`${id}-title`"><CommandTag v-if="selected" :text="selected.command" /> · {{ t('Recorded test') }}</h2>
        <form method="dialog"><button class="btn btn-ghost btn-sm" type="submit" autofocus :aria-label="t('Close video')">{{ t('Close') }}</button></form>
      </header>
      <template v-if="selected">
        <video :key="selected.command" ref="video" controls playsinline preload="none" :width="selected.width" :height="selected.height" :poster="assetUrl(selected.poster)" :aria-label="selected.alt">
          <source :src="assetUrl(selected.src)" type="video/mp4" />
          <track v-if="selected.captions" kind="captions" srclang="en" label="English" :src="assetUrl(selected.captions)" />
        </video>
        <RecordingResultLinks links-only class="shortcut-video-results" :result="selected.result" />
        <details :key="selected.command" class="collapse collapse-arrow shortcut-video-prompt" @toggle="onTranscriptToggle">
          <summary class="collapse-title">{{ t('Tested prompt and transcript') }}</summary>
          <div class="collapse-content">
            <PromptBlock :text="selected.prompt" label="Tested prompt" />
            <p v-if="transcriptLoading" role="status">{{ t('Loading transcript…') }}</p>
            <div v-else-if="transcriptError" class="flex flex-wrap items-baseline gap-x-4 gap-y-2 sm:gap-x-5" role="status">
              <p class="basis-full">{{ t('The transcript could not be loaded.') }}</p>
              <button class="btn btn-ghost btn-sm" type="button" @click="loadTranscript">{{ t('Retry transcript') }}</button>
              <a v-if="selected.transcriptFile" class="link" :href="assetUrl(selected.transcriptFile)" target="_blank" rel="noopener">{{ t('Open transcript file') }}</a>
            </div>
            <p v-else class="shortcut-video-transcript">{{ transcript }}</p>
          </div>
        </details>
      </template>
    </div>
    <form method="dialog" class="modal-backdrop"><button :aria-label="t('Close video')" type="submit">{{ t('Close') }}</button></form>
  </dialog>
</template>

<style scoped>
.shortcut-video-box { width:min(96vw,1200px); max-width:1200px; max-height:95vh; padding:20px 24px; }
.shortcut-video-header { display:flex; align-items:center; justify-content:space-between; gap:24px; margin-bottom:14px; }
.slidev-layout .shortcut-video-header h2 { font-size:23px; line-height:1.3; }
.shortcut-video-box video { display:block; width:auto; height:auto; max-width:100%; max-height:72vh; margin-inline:auto; object-fit:contain; background:var(--color-base-100); }
.shortcut-video-results { margin-top:12px; }
.shortcut-video-prompt { margin-top:12px; font-size:16px; }
.shortcut-video-prompt .collapse-title { min-height:0; padding-block:10px; }
.shortcut-video-prompt .prompt-block { margin-block:8px 18px; }
.slidev-layout .shortcut-video-transcript { white-space:pre-wrap; font-size:16px; line-height:1.45; }
</style>
