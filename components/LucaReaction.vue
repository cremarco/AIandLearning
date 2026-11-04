<script setup lang="ts">
import { useNav } from '@slidev/client'
import { computed } from 'vue'

const props = defineProps<{
  slideNumber: number
  character: { happy: string; worried: string; happyAlt: string; worriedAlt: string }
}>()
const nav = useNav()
const isStatic = computed(() => nav.isPrintMode.value || nav.currentRoute.value.name === 'print')
const worried = computed(() => !isStatic.value && nav.currentSlideNo.value === props.slideNumber && nav.clicks.value >= 1)
const description = computed(() => worried.value ? props.character.worriedAlt : props.character.happyAlt)
const asset = (url: string) => `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`

function advance() {
  if (!isStatic.value && nav.currentSlideNo.value === props.slideNumber) void nav.next()
}
function toggleExpression() {
  if (isStatic.value || nav.currentSlideNo.value !== props.slideNumber) return
  if (worried.value) void nav.prev()
  else void nav.next()
}
defineExpose({ advance })
</script>

<template>
  <figure class="luca-reaction" :data-expression="worried ? 'worried' : 'happy'">
    <button class="btn btn-ghost luca-portrait relative block h-full min-h-0 w-full rounded-field p-0" type="button" aria-label="Luca’s reaction to the assignment"
      :aria-pressed="worried" :disabled="isStatic" @click.stop="toggleExpression">
      <img v-show="!worried" :src="asset(character.happy)" alt="" aria-hidden="true" width="1024" height="1536" />
      <img v-show="worried" :src="asset(character.worried)" alt="" aria-hidden="true" width="1024" height="1536" />
    </button>
    <figcaption class="sr-only" role="status" aria-live="polite">{{ description }}</figcaption>
  </figure>
</template>

<style scoped>
.luca-reaction { flex: 0 0 340px; height: 100%; max-height: 390px; min-height: 0; }
.luca-portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
@media print { .luca-portrait { pointer-events: none; } }
</style>
