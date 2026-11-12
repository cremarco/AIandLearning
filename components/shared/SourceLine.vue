<script setup lang="ts">
import { computed } from 'vue'
import sources from '../../data/generated/sources.json'
import { useSlideLanguage } from '../../utils/slide-language'
const { t } = useSlideLanguage()

type Source = { label?: string; title?: string; url?: string; showInFooter?: boolean }
const catalogue: Record<string, Source> = sources
const props = defineProps<{ ids?: string[] }>()
const visibleSources = computed(() => (props.ids || [])
  .map(id => ({ id, ...catalogue[id] }))
  .filter(source => source.showInFooter !== false))
</script>

<template>
  <footer v-if="visibleSources.length" class="source-line">
    <template v-for="(source, index) in visibleSources" :key="source.id">
      <a class="link" :href="source.url" target="_blank" rel="noopener" :title="source.title">{{ t(source.label || source.id) }}</a><span v-if="index < visibleSources.length - 1"> · </span>
    </template>
  </footer>
</template>
