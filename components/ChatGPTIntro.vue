<script setup lang="ts">
import { imageUrl } from '../utils/assets'
import { useSlideMotion } from '../utils/slide-motion'

const props = defineProps<{ title: string; message: string; slideNumber: number }>()
const { running: active } = useSlideMotion(() => props.slideNumber)
const logo = imageUrl('tools/chatgpt-logo.svg')
</script>

<template>
  <section class="chatgpt-intro" :class="{ 'is-active': active }" lang="en">
    <div class="chatgpt-logo-stage">
      <img class="chatgpt-logo" :src="logo" alt="ChatGPT logo, by OpenAI" width="300" height="300" />
    </div>
    <div class="chatgpt-intro-copy">
      <h1>{{ title }}</h1>
      <p class="chatgpt-intro-message">{{ message }}</p>
      <p class="chatgpt-intro-preview">Maps · Explanations · Revision · Practice</p>
    </div>
  </section>
</template>

<style scoped>
.chatgpt-intro { display:grid; grid-template-columns:360px minmax(0,1fr); align-items:center; gap:64px; width:100%; }
.chatgpt-logo-stage { display:grid; place-items:center; height:360px; }
.chatgpt-logo { width:300px; height:300px; object-fit:contain; }
.chatgpt-intro-copy { display:flex; flex-direction:column; align-items:flex-start; gap:24px; }
.slidev-layout .chatgpt-intro h1 { font-size:76px; line-height:1.02; max-width:620px; text-wrap:balance; }
.slidev-layout .chatgpt-intro-message { color:var(--deck-muted); font-size:27px; max-width:590px; line-height:1.4; }
.slidev-layout .chatgpt-intro-preview { padding-top:12px; font-size:19px; color:var(--deck-cyan); }
/* The title stays readable while the mark resolves into focus. */
.is-active .chatgpt-logo { animation:chatgpt-resolve var(--deck-motion-focus) var(--deck-motion-ease); }
@keyframes chatgpt-resolve {
  from { filter:blur(2px); transform:rotate(-8deg) scale(.96); }
  to { filter:blur(0); transform:rotate(0) scale(1); }
}
@media (prefers-reduced-motion:reduce), print {
  .is-active .chatgpt-logo { animation:none; filter:none; transform:none; }
}
</style>
