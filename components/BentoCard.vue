<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  body?: string
  tone?: 'surface' | 'paper' | 'accent'
}>(), { tone: 'surface' })
</script>

<template>
  <article class="card bento-card" :class="`bento-card--${tone}`">
    <div class="card-body">
      <h2 class="card-title">{{ title }}</h2>
      <p v-if="body" class="bento-card__body">{{ body }}</p>
    </div>
  </article>
</template>
