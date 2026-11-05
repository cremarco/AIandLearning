<script setup lang="ts">
withDefaults(defineProps<{ text: string; label?: string }>(), { label: 'Prompt to copy' })
</script>

<template>
  <div class="prompt-block">
    <span class="prompt-label">{{ label }}</span>
    <div class="mockup-code prompt-terminal min-w-0 rounded-xl bg-base-200 text-base-content">
      <pre data-prefix=">"><code>{{ text }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.prompt-block { min-width:0; }
.prompt-terminal { padding-block:14px 16px; font-size:inherit; }
.prompt-terminal::before { height:10px; width:10px; margin-bottom:10px; }
.prompt-terminal pre { display:flex; width:100%; min-width:0; margin:0; padding:0 18px; font-size:inherit; line-height:1.3; }
.prompt-terminal pre::before { flex:0 0 12px; width:12px; margin-right:14px; }
.prompt-terminal code { min-width:0; padding:0; background:none; color:inherit; font:inherit; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
</style>
