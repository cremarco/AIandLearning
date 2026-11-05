<script setup lang="ts">
import { ref } from 'vue'
import { useSlideVideo } from '../../composables/useSlideVideo'
import type { SlideMedia } from '../../utils/deck'
import { assetUrl as asset } from '../../utils/assets'

defineProps<{ media: SlideMedia }>()
const video = ref<HTMLVideoElement>()
useSlideVideo(video)
</script>

<template>
  <div class="mockup-browser browser-video" :class="{ 'browser-video-dark': media.darkFrame }">
    <div class="mockup-browser-toolbar">
      <div class="input browser-video-address">{{ media.source?.replace(/^https?:\/\//, '') }}</div>
    </div>
    <div class="browser-video-page">
      <video ref="video" controls playsinline preload="none" width="1440" height="900" :poster="asset(media.poster)" :aria-label="media.alt" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
        <source :src="asset(media.src)" type="video/mp4" />
        <track kind="captions" srclang="en" label="English" :src="asset(media.captions)" :default="media.captionsDefault !== false" />
      </video>
      <img class="video-print-poster" :src="asset(media.poster)" :alt="media.alt" />
    </div>
  </div>
</template>

<style src="../../styles/browser-video.css"></style>
