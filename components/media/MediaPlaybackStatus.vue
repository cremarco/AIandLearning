<script setup lang="ts">
import { useNav } from '@slidev/client'
import { watch } from 'vue'
import { mediaPlaybackIssue } from '../../utils/presenter-media'
import { useSlideLanguage } from '../../utils/slide-language'
const { t } = useSlideLanguage()

defineProps<{ inline?: boolean }>()
const nav = useNav()
watch(nav.currentSlideNo, () => { mediaPlaybackIssue.value = undefined })
</script>

<template>
  <div v-if="mediaPlaybackIssue && !nav.isPrintMode.value" class="alert text-sm" :class="inline ? 'mb-3' : 'absolute inset-x-4 bottom-4 z-50 mx-auto w-fit max-w-xl'" role="alert" @click.stop @keydown.stop>
    <template v-if="nav.isPresenter.value">
      <span>{{ t("Playback is blocked in the audience window. Enable playback there once, then control the video here.") }}</span>
    </template>
    <template v-else>
      <span>{{ t("Enable playback to allow video and audio controls from the presenter.") }}</span>
      <button class="btn btn-sm" type="button" @click="mediaPlaybackIssue?.retry?.()">{{ t("Enable playback") }}</button>
    </template>
  </div>
</template>
