<script setup lang="ts">
import { useNav, useSlideContext } from '@slidev/client'
import { computed, ref } from 'vue'
import { assetUrl as asset } from '../../utils/assets'
import type { Character } from '../../utils/deck'
import { useSlideLanguage } from '../../utils/slide-language'
const { t } = useSlideLanguage()

const props = defineProps<{
  slideNumber: number
  character: Character
}>()
const nav = useNav()
// The custom print route renders outside Slidev's per-slide context.
const clicks = nav.currentRoute.value.name === 'print' ? ref(0) : useSlideContext().$clicks
const isStatic = computed(() => nav.isPrintMode.value || nav.currentRoute.value.name === 'print')
const worried = computed(() => !isStatic.value && clicks.value >= 1)
const description = computed(() => worried.value ? props.character.worriedAlt : props.character.happyAlt)

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
    <button class="btn btn-ghost luca-portrait relative block h-full min-h-0 w-full rounded-field border-transparent! bg-transparent! p-0 shadow-none" type="button" :aria-label="t('Andrea’s reaction to the assignment')"
      :aria-pressed="worried" :disabled="isStatic" @click.stop="toggleExpression">
      <img :class="{ 'is-current': !worried }" :src="asset(character.happy)" alt="" aria-hidden="true" width="1024" height="1536" />
      <img :class="{ 'is-current': worried }" :src="asset(character.worried)" alt="" aria-hidden="true" width="1024" height="1536" />
    </button>
    <figcaption class="sr-only" role="status" aria-live="polite">{{ description }}</figcaption>
  </figure>
</template>

<style scoped>
.luca-reaction { position: absolute; inset: 0 0 0 auto; z-index: 0; width: 480px; height: 100%; min-height: 0; }
.luca-portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity:0; transition:opacity var(--deck-motion-feedback) var(--deck-motion-ease); }
.luca-portrait img.is-current { opacity:1; }
.luca-portrait:focus-visible { outline-offset: -4px; }
@media print { .luca-portrait { pointer-events: none; } }
</style>
