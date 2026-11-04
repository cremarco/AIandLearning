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
      <p class="chatgpt-eyebrow">One tool, many ways to learn</p>
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
.slidev-layout .chatgpt-eyebrow { color:var(--deck-cyan); font-size:19px; letter-spacing:.01em; }
.slidev-layout .chatgpt-intro h1 { font-size:76px; line-height:1.02; max-width:620px; text-wrap:balance; }
.slidev-layout .chatgpt-intro-message { color:var(--deck-muted); font-size:27px; max-width:590px; line-height:1.4; }
.slidev-layout .chatgpt-intro-preview { padding-top:12px; font-size:19px; color:var(--deck-cyan); }
.is-active .chatgpt-logo { animation:chatgpt-arrive 4.4s cubic-bezier(.22,.8,.25,1) both; }
.is-active .chatgpt-intro-copy { animation:chatgpt-copy 1s .2s ease-out both; }
@keyframes chatgpt-arrive {
  0% { opacity:0; transform:translateY(24px) rotate(-30deg) scale(.78); }
  30% { opacity:1; transform:translateY(-10px) rotate(5deg) scale(1.04); }
  65% { opacity:1; transform:translateY(4px) rotate(-2deg) scale(.99); }
  100% { opacity:1; transform:translateY(0) rotate(0) scale(1); }
}
@keyframes chatgpt-copy { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
@media (prefers-reduced-motion:reduce), print {
  .is-active .chatgpt-logo, .is-active .chatgpt-intro-copy { animation:none; }
}
</style>
