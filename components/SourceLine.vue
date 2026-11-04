<script setup lang="ts">
import sources from '../data/sources.json'
defineProps<{ ids?: string[] }>()
</script>

<template>
  <footer class="source-line">
    <template v-for="(id, index) in ids" :key="id">
      <a class="link" :href="sources[id]?.url" target="_blank" rel="noopener" :title="sources[id]?.title">{{ sources[id]?.label || id }}</a><span v-if="index < ids.length - 1"> · </span>
    </template>
  </footer>
</template>
