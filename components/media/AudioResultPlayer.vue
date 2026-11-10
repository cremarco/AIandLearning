<script setup lang="ts">
import { ref } from 'vue'
import { useSlideVideo } from '../../composables/useSlideVideo'
import { assetUrl } from '../../utils/assets'
import type { VideoResult } from '../../utils/deck'

defineProps<{ result: VideoResult }>()
const audio = ref<HTMLAudioElement>()
useSlideVideo(audio)
</script>

<template>
  <div class="audio-result-player">
    <div class="audio-result-heading">
      <p>Full Audio Overview</p>
      <a class="link" :href="assetUrl(result.url)" download @click.stop @pointerdown.stop @keydown.stop @keyup.stop>Download audio</a>
    </div>
    <audio ref="audio" controls preload="metadata" aria-label="Full NotebookLM Audio Overview"
      @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
      <source :src="assetUrl(result.url)" :type="result.mediaType" />
    </audio>
  </div>
</template>

<style scoped>
.audio-result-player { display:flex; flex-direction:column; gap:8px; min-width:0; }
.audio-result-heading { display:flex; align-items:baseline; justify-content:space-between; gap:20px; font-size:18px; line-height:1.3; }
.slidev-layout .audio-result-heading p { margin:0; font-size:inherit; font-weight:600; }
.audio-result-player audio { display:block; width:100%; height:48px; }
@media print { .audio-result-player audio { display:none; } }
</style>
