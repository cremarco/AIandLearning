<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <span class="command-token">{{ text }}</span>
</template>
