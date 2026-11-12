<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { copyText } from '../../utils/copy-text.mjs'
import { useSlideLanguage } from '../../utils/slide-language'
const { t } = useSlideLanguage()

const props = defineProps<{ text: string }>()
const copied = ref(false)
const failed = ref(false)
const pending = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

function reset() {
  clearTimeout(resetTimer)
  copied.value = false
  failed.value = false
}
watch(() => props.text, reset)
onBeforeUnmount(() => clearTimeout(resetTimer))

async function copy() {
  reset()
  pending.value = true
  const text = props.text
  try {
    await copyText(text)
    if (text !== props.text) return
    copied.value = true
    resetTimer = setTimeout(reset, 2000)
  } catch {
    if (text === props.text) failed.value = true
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <span class="prompt-copy-control inline-flex flex-wrap items-center gap-2 sm:gap-2">
    <button class="btn btn-sm prompt-copy" type="button" :disabled="pending" @click.stop="copy" @pointerdown.stop @keydown.stop @keyup.stop>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
      <span aria-live="polite">{{ t(copied ? 'Copied!' : 'Copy prompt') }}</span>
    </button>
    <span v-if="failed" class="prompt-copy-error" role="status">{{ t('Could not copy. Select and copy the prompt manually.') }}</span>
  </span>
</template>

<style scoped>
.prompt-copy-control { flex-shrink:0; }
.prompt-copy.btn { min-height:28px; height:28px; padding-inline:10px; font-size:14px; white-space:nowrap; }
.prompt-copy-error { max-width:24ch; font-size:14px; line-height:1.3; }
:global(.workshop-print) .prompt-copy-control { display:none; }
@media print { .prompt-copy-control { display:none; } }
</style>
