<script setup lang="ts">
import { useNav } from '@slidev/client'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useSlideVideo } from '../../composables/useSlideVideo'
import type { Slide } from '../../utils/deck'
import { assetUrl } from '../../utils/assets'
import { getShortcutVideo } from '../../utils/shortcut-videos'
import PromptBlock from '../shared/PromptBlock.vue'
import RecordingResultLinks from '../shared/RecordingResultLinks.vue'
import { t } from '../../utils/language'

const props = defineProps<{ slide: Slide }>()
const clip = computed(() => getShortcutVideo(props.slide.title))
const focused = computed(() => props.slide.videoLayout === 'focus')
const promptDialog = ref<HTMLDialogElement>()
const promptId = useId()
const nav = useNav()
watch(nav.currentSlideNo, () => promptDialog.value?.close())
onBeforeUnmount(() => promptDialog.value?.close())

function showPrompt() {
  video.value?.pause()
  promptDialog.value?.showModal()
}

function fullScreen() {
  video.value?.requestFullscreen().catch(() => {})
}
// The original UI excerpts contain paragraph breaks and table-cell tabs.
// Keep their words verbatim while restoring compact reading groups.
const staticResultBlocks = computed(() => {
  const raw = props.slide.result || ''
  const parts = raw.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
  const blocks: { label: string; text: string }[] = []
  if (!parts.length) return blocks
  const add = (values: string[], label = '') => {
    if (values.length || label) blocks.push({ label, text: values.join(' ').replace(/\s+/g, ' ') })
  }
  if (raw.includes('\t')) {
    const prefix = raw.slice(0, raw.indexOf('\t')).trim().split(/\n\s*\n/).filter(Boolean)
    const firstRow = prefix.length + 1
    add(parts.slice(1, firstRow), parts[0])
    let index = firstRow
    while (index + 1 < parts.length && parts[index].length < 120 && parts[index + 1].length > 35) {
      add([parts[index + 1]], parts[index])
      index += 2
    }
    add(parts.slice(index))
  } else if (parts.some(part => /^\d+[.)]\s/.test(part))) {
    let start = parts.findIndex(part => /^\d+[.)]\s/.test(part))
    if (start > 0) add(parts.slice(1, start), parts[0])
    while (start < parts.length) {
      let end = start + 1
      while (end < parts.length && !/^\d+[.)]\s/.test(parts[end])) end++
      add(parts.slice(start + 1, end), parts[start])
      start = end
    }
  } else {
    let group: string[] = []
    let label = parts[0]
    for (const part of parts.slice(1)) {
      if (group.join(' ').length > 220) { add(group, label); group = []; label = '' }
      group.push(part)
    }
    add(group, label)
  }
  return blocks
})
const video = ref<HTMLVideoElement>()
useSlideVideo(video)
</script>

<template>
  <div class="shortcut-detail" :class="{ 'shortcut-detail-focus': focused }">
    <section class="shortcut-detail-request" aria-label="Recorded prompt and output format">
      <div v-if="focused" class="shortcut-focus-toolbar flex flex-wrap items-center gap-3">
        <button class="btn btn-sm" type="button" aria-haspopup="dialog" @click.stop="showPrompt" @keydown.stop>{{ t('Recorded prompt') }}</button>
        <button class="btn btn-sm" type="button" @click.stop="fullScreen" @keydown.stop>{{ t('Full screen') }}</button>
      </div>
      <PromptBlock v-else-if="slide.prompt" class="shortcut-detail-prompt" :text="slide.prompt" :label="slide.promptLabel || 'Recorded prompt'" />
      <div class="shortcut-detail-context">
        <p v-for="text in slide.body" :key="text" class="shortcut-detail-format">{{ text }}</p>
        <div v-if="slide.links?.length" class="shortcut-detail-links">
          <a v-for="link in slide.links" :key="link.url" class="link link-hover" :href="assetUrl(link.url)" target="_blank" rel="noopener" @click.stop @keydown.stop>{{ link.label }}</a>
        </div>
      </div>
    </section>

    <section class="shortcut-detail-output" :aria-label="slide.resultLabel || 'Recorded output'">
      <h2 v-if="!clip">{{ t(slide.resultLabel || 'Recorded output') }}</h2>
      <figure v-if="clip" class="shortcut-detail-recording">
        <video :key="clip.sha256 || clip.src" ref="video" controls playsinline preload="none" :width="clip.width" :height="clip.height" :poster="assetUrl(clip.poster)" :aria-label="clip.alt" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
          <source :src="assetUrl(clip.src) + (focused ? `?v=${clip.sha256.slice(0, 12)}` : '')" type="video/mp4" />
          <track kind="captions" srclang="en" label="English" :src="assetUrl(clip.captions)" />
        </video>
        <img class="shortcut-detail-print-poster" :src="assetUrl(clip.poster)" :alt="clip.alt" />
      </figure>
      <footer v-if="clip" class="shortcut-detail-caption"><RecordingResultLinks links-only :result="clip.result" /></footer>
      <div v-else class="chat chat-start shortcut-detail-static" lang="en">
        <div class="chat-bubble w-full max-w-full bg-base-200 text-base-content">
          <p v-for="(block,index) in staticResultBlocks" :key="index" class="shortcut-detail-excerpt"><strong v-if="block.label">{{ block.label + ' ' }}</strong>{{ block.text }}</p>
        </div>
      </div>
    </section>
    <Teleport v-if="focused" to="body">
      <dialog ref="promptDialog" class="modal" :aria-labelledby="promptId" @click.stop @keydown.stop>
        <div class="modal-box w-11/12 max-w-3xl">
          <header class="mb-5 flex items-center justify-between gap-4">
            <h2 :id="promptId" class="text-2xl font-bold">{{ slide.title }} · {{ t('Recorded prompt') }}</h2>
            <form method="dialog"><button class="btn btn-sm" type="submit" autofocus>{{ t('Close') }}</button></form>
          </header>
          <PromptBlock v-if="slide.prompt" :text="slide.prompt" :label="slide.promptLabel || 'Recorded prompt'" />
          <p v-for="text in slide.body" :key="text" class="mt-4">{{ text }}</p>
          <div class="mt-5 flex flex-wrap gap-4">
            <a v-for="link in slide.links" :key="link.url" class="link" :href="assetUrl(link.url)" target="_blank" rel="noopener">{{ link.label }}</a>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="submit">{{ t('Close recorded prompt') }}</button></form>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
.shortcut-detail { display:grid; grid-template-columns:minmax(0,.82fr) minmax(0,1.45fr); gap:40px; width:100%; height:100%; min-height:0; align-items:stretch; }
.shortcut-detail:has(.shortcut-detail-static) { grid-template-columns:336px minmax(0,1fr); gap:32px; }
.shortcut-detail-request { display:flex; flex-direction:column; justify-content:space-between; gap:16px; min-width:0; min-height:0; }
.shortcut-detail-prompt { font-size:var(--deck-text-prompt); }
.shortcut-detail-prompt :deep(.prompt-header) { margin-bottom:12px; }
.shortcut-detail-prompt :deep(.prompt-label) { font-size:var(--deck-text-label); }
.shortcut-detail-prompt :deep(.chat-bubble) { padding:16px 24px; line-height:1.45; }
.shortcut-detail-context { display:flex; flex-direction:column; gap:16px; padding-bottom:2px; }
.slidev-layout .shortcut-detail .shortcut-detail-format { margin:0; font-size:18px; line-height:1.4; color:var(--deck-muted); }
.shortcut-detail-links { display:flex; flex-wrap:wrap; gap:12px; font-size:17px; line-height:1.35; }
.shortcut-detail-output { display:grid; grid-template-rows:auto minmax(0,1fr); gap:16px; min-width:0; min-height:0; }
.slidev-layout .shortcut-detail-output h2 { flex:none; margin:0; font-size:21px; line-height:1.25; font-weight:650; color:var(--deck-cyan); }
.shortcut-detail-recording { display:flex; justify-self:start; align-self:start; align-items:center; justify-content:center; width:auto; max-width:100%; height:100%; aspect-ratio:var(--deck-video-ratio); min-height:0; margin:0; overflow:hidden; border:1px solid var(--deck-line); border-radius:12px; background:var(--deck-surface); }
.shortcut-detail-recording video,.shortcut-detail-recording img { display:block; width:100%; height:100%; min-height:0; object-fit:contain; background:var(--deck-surface); }
.shortcut-detail-static { padding:0; min-width:0; min-height:0; align-self:start; }
.shortcut-detail-static .chat-bubble { padding:12px 24px; border-radius:16px; }
.slidev-layout .shortcut-detail .shortcut-detail-excerpt + .shortcut-detail-excerpt { margin-top:8px; }
.slidev-layout .shortcut-detail .shortcut-detail-excerpt { margin:0; white-space:normal; font-size:23px; line-height:1.35; }
.shortcut-detail-recording .shortcut-detail-print-poster { display:none; }
.shortcut-detail-focus .shortcut-detail-recording video:fullscreen { border-radius:0; }
:global(.workshop-print) .shortcut-detail-recording .shortcut-detail-print-poster { display:block; }
@media print { .shortcut-detail-recording video { display:none!important; } .shortcut-detail-recording .shortcut-detail-print-poster { display:block; } .shortcut-focus-toolbar button { display:none; } .shortcut-detail-focus .shortcut-detail-recording .shortcut-detail-print-poster { width:100%; height:100%; object-fit:contain; } }
</style>
