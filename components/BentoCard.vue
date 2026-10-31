<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  body?: string
  image?: string
  label?: string
  span?: string
  tone?: string
  value?: string
}>(), { tone: 'paper' })

const imageUrl = computed(() => props.image
  ? `${import.meta.env.BASE_URL}images/${props.image}`
  : undefined)
</script>

<template>
  <article
    class="card bento-card"
    :class="[
      `bento-card--${tone}`,
      { 'bento-card--image': image, 'bento-card--wide': span === 'wide', 'bento-card--tall': span === 'tall' },
    ]"
  >
    <figure v-if="imageUrl" class="bento-card__figure" aria-hidden="true">
      <img :src="imageUrl" alt="" decoding="async" />
    </figure>
    <div v-if="imageUrl" class="bento-card__scrim" aria-hidden="true" />
    <div class="card-body">
      <div v-if="label && /^\d{2}$/.test(label)" class="bento-card__label">{{ label }}</div>
      <div v-if="value" class="bento-card__value">{{ value }}</div>
      <h2 v-if="title" class="card-title">{{ title }}</h2>
      <p v-if="label && !/^\d{2}$/.test(label)" class="bento-card__context">{{ label }}</p>
      <p v-if="body" class="bento-card__body">{{ body }}</p>
      <slot />
    </div>
  </article>
</template>
