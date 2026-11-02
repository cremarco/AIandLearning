<script setup lang="ts">
defineProps<{ revised?: boolean }>()
</script>
<template>
  <svg class="learning-map" viewBox="0 0 1080 260" role="img" :aria-label="revised ? 'Revised map: training data update parameters; context and parameters contribute to generation. Parameters stay fixed in inference.' : 'Initial map: Luca links context to model with the uncertain relation trains again and cannot yet explain how a response is produced.'">
    <defs><marker :id="revised?'arrow-correct':'arrow-initial'" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8" fill="currentColor" /></marker></defs>
    <g class="map-shapes" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="0" y="95" width="214" height="90" rx="8"/><rect x="422" y="95" width="214" height="90" rx="8"/><rect x="854" y="95" width="224" height="90" rx="8"/>
      <path d="M214 140 H415" :marker-end="`url(#${revised?'arrow-correct':'arrow-initial'})`"/>
      <path d="M636 140 H847" :marker-end="`url(#${revised?'arrow-correct':'arrow-initial'})`"/>
      <path v-if="revised" d="M529 70 V92" :marker-end="`url(#arrow-correct)`"/>
    </g>
    <g fill="currentColor" text-anchor="middle" font-family="inherit">
      <text x="107" y="146" style="font-size:27px">Context</text><text x="529" y="146" style="font-size:27px">Model</text><text x="966" y="133" style="font-size:27px">{{ revised?'Token':'Response' }}</text>
      <text v-if="revised" x="966" y="165" style="font-size:24px">probabilities</text>
      <text x="320" y="113" style="font-size:22px">{{ revised?'conditions':'trains again?' }}</text>
      <text x="744" y="113" style="font-size:22px">{{ revised?'computes':'produces… how?' }}</text>
      <text v-if="revised" x="529" y="43" style="font-size:24px">Parameters learned from data</text>
      <text x="529" y="237" style="font-size:22px">{{ revised?'Parameters remain fixed during this generation.':'“?” marks a relation to check against the chapter.' }}</text>
    </g>
  </svg>
</template>
