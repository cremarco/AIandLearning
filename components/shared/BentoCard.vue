<script setup lang="ts">
import EmphasisText from './EmphasisText.vue'
withDefaults(defineProps<{
  title: string
  body?: string
  tone?: 'surface' | 'paper' | 'accent'
  backgroundImage?: string
}>(), { tone: 'surface' })
</script>

<template>
  <article class="card bento-card" :class="[`bento-card--${tone}`, { 'bento-card--illustrated': !!backgroundImage }]">
    <div class="card-body">
      <h2 class="card-title">{{ title }}</h2>
      <div v-if="backgroundImage" class="bento-card__art" aria-hidden="true">
        <img class="bento-card__image" :src="backgroundImage" alt="" decoding="async" />
      </div>
      <p v-if="body" class="bento-card__body"><EmphasisText :text="body" /></p>
    </div>
  </article>
</template>
