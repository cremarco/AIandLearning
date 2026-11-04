<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { slides } from '../utils/deck'
import DeckSlide from './DeckSlide.vue'
onMounted(()=>document.documentElement.classList.add('workshop-print'))
onUnmounted(()=>document.documentElement.classList.remove('workshop-print'))
</script>
<template>
  <div id="print-container" aria-label="Complete static presentation">
    <section v-for="slide in slides" :id="`${slide.number}-0`" :key="slide.id" class="print-slide-container" :data-slidev-no="slide.number">
      <div class="slidev-layout"><DeckSlide :id="slide.id" /></div>
    </section>
  </div>
</template>
<style>
html.workshop-print, html.workshop-print body,html.workshop-print #app {height:auto!important;min-height:0!important;overflow:visible!important;}
.workshop-print #print-container {width:1280px;margin:0;}
.workshop-print .print-slide-container {width:1280px;height:720px;position:relative;overflow:hidden;break-after:page;page-break-after:always;}
.workshop-print .print-slide-container:last-child {break-after:auto;page-break-after:auto;}
.workshop-print video,.workshop-print .pipeline-caption {display:none!important;}
.workshop-print .workshop-media .video-print-poster {display:block!important;}
.workshop-print .pipeline-static {display:block!important;}
.workshop-print * {-webkit-print-color-adjust:exact;print-color-adjust:exact;animation:none!important;transition:none!important;}
@page {size:1280px 720px;margin:0;}
</style>
