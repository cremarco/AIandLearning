<script setup lang="ts">
withDefaults(defineProps<{
  name: 'arrow-right' | 'arrow-left' | 'arrow-up-right'
  size?: number
}>(), { size: 20 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-if="name === 'arrow-right'" d="M4 12h16m-6-6 6 6-6 6" />
    <path v-else-if="name === 'arrow-left'" d="M20 12H4m6 6-6-6 6-6" />
    <path v-else d="M6 18 18 6M6 6h12v12" />
  </svg>
</template>
