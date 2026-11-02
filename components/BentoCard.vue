<script setup lang="ts">
defineProps<{ title: string; body?: string }>()
</script>

<template>
  <article class="card bento-card">
    <div class="card-body">
      <h2 class="card-title">{{ title }}</h2>
      <p v-if="body" class="bento-card__body">{{ body }}</p>
    </div>
  </article>
</template>
