<script setup lang="ts">
import { toolBrands, type ToolBrandId } from '../../utils/tool-brands'
import { assetUrl } from '../../utils/assets'

withDefaults(defineProps<{ ids: ToolBrandId[]; compact?: boolean; prominent?: boolean }>(), { compact: false, prominent: false })
</script>

<template>
  <span v-if="ids.length" class="tool-logos" :class="{ 'tool-logos--compact': compact, 'tool-logos--prominent': prominent }">
    <span v-for="id in ids" :key="id" class="tool-logo" :class="{ 'tool-logo--dark': toolBrands[id].surface === 'dark' }" :data-tool-brand="id">
      <img :src="assetUrl(toolBrands[id].src)" :alt="`${toolBrands[id].name} logo`" width="48" height="48" />
    </span>
  </span>
</template>

<style scoped>
.tool-logos { display:inline-flex; flex-shrink:0; align-items:center; gap:8px; vertical-align:middle; }
.tool-logo { display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; padding:4px; border-radius:7px; background:var(--color-white); }
.tool-logo--dark { background:var(--color-zinc-950); }
.tool-logo img { display:block; width:100%; height:100%; object-fit:contain; }
.tool-logos--compact { gap:6px; }
.tool-logos--compact .tool-logo { width:32px; height:32px; padding:3px; border-radius:4px; }
.tool-logos--prominent { gap:32px; }
.tool-logos--prominent .tool-logo { width:224px; height:224px; padding:20px; border-radius:24px; }
</style>
