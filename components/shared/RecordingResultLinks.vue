<script setup lang="ts">
import { computed, useId } from 'vue'
import type { VideoResult } from '../../utils/deck'
import { assetUrl } from '../../utils/assets'

const props = defineProps<{ result?: VideoResult; compact?: boolean; linksOnly?: boolean }>()
const qualificationId = `${useId()}-result-qualification`
// Keep forensic qualifications in the packet and reader; live slides need the
// short instruction that helps someone choose the result they can actually use.
const qualification = computed(() => {
  if (props.linksOnly) return undefined
  const result = props.result
  if (!props.compact) return result?.qualification
  if (!result?.qualification || result.kind === 'file') return undefined
  return result.supplemental?.some(file => file.mediaType?.split(';')[0] === 'text/html' || /\.html?(?:[?#]|$)/i.test(file.url))
    ? 'Open the HTML download to use the kit.'
    : 'Shared conversation. Live controls were not verified.'
})
</script>

<template>
  <span v-if="result && result.label !== 'Open result (text)'" class="recording-result-links inline-flex max-w-full flex-wrap items-baseline gap-x-4 gap-y-1 sm:gap-x-5">
    <a class="link" :href="assetUrl(result.url)" :download="result.download ? '' : undefined" :target="result.download ? undefined : '_blank'" rel="noopener" :aria-describedby="qualification ? qualificationId : undefined" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>{{ result.label }}</a>
    <a v-for="file in result.supplemental" :key="file.url" class="link" :href="assetUrl(file.url)" download @click.stop @pointerdown.stop @keydown.stop @keyup.stop>{{ file.label }}</a>
    <span v-if="qualification" :id="qualificationId" class="basis-full">{{ qualification }}</span>
  </span>
</template>
