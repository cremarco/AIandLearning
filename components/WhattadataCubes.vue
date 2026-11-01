<script setup lang="ts">
import { sharedState, useIsSlideActive, useNav } from '@slidev/client'
import { computed, onScopeDispose, ref } from 'vue'

const isActive = useIsSlideActive()
const nav = useNav()
const motion = sharedState as typeof sharedState & { eduforumCubesPaused?: boolean }
const paused = computed(() => motion.eduforumCubesPaused ?? false)
const visible = ref(typeof document !== 'undefined' && !document.hidden)
const updateVisibility = () => { visible.value = !document.hidden }
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', updateVisibility)
  onScopeDispose(() => document.removeEventListener('visibilitychange', updateVisibility))
}
const running = computed(() => isActive.value && visible.value && !paused.value && !nav.isPrintMode.value)
const faces = ['front', 'back', 'right', 'left', 'top', 'bottom']
// One large module and smaller satellites make the modular theme visible.
// Sizes are in Slidev's 1280px canvas coordinates, so the whole scene scales.
const cubes = [
  { x: 49, y: 48, size: 164, tone: 'violet', delay: -3, duration: 18, tilt: -8 },
  { x: 83, y: 21, size: 80, tone: 'lime', delay: -8, duration: 16, tilt: 8 },
  { x: 13, y: 19, size: 56, tone: 'violet', delay: -5, duration: 20, tilt: -14 },
  { x: 13, y: 73, size: 76, tone: 'lime', delay: -11, duration: 17, tilt: 4 },
  { x: 84, y: 85, size: 92, tone: 'violet', delay: -2, duration: 21, tilt: 10 },
  { x: 47, y: 0, size: 34, tone: 'lime', delay: -6, duration: 15, tilt: -6 },
  { x: 44, y: 100, size: 38, tone: 'violet', delay: -9, duration: 19, tilt: -12 },
]
</script>

<template>
  <div class="company-motion" :class="{ 'is-running': running }">
    <div class="cube-scene" aria-hidden="true">
      <div v-for="(cube, index) in cubes" :key="index" class="cube-anchor" :class="`cube-${cube.tone}`"
        :style="{
          '--x': `${cube.x}%`, '--y': `${cube.y}%`, '--size': `${cube.size}px`,
          '--delay': `${cube.delay}s`, '--duration': `${cube.duration}s`, '--tilt': `${cube.tilt}deg`,
        }">
        <div class="brand-cube">
          <span v-for="face in faces" :key="face" class="cube-face" :class="`cube-face-${face}`" />
        </div>
      </div>
    </div>
    <button v-if="!nav.isPrintMode.value" type="button" class="btn btn-ghost btn-sm cube-motion-toggle"
      :aria-pressed="paused" @click.stop="motion.eduforumCubesPaused = !paused">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path v-if="paused" d="m7 4 9 6-9 6V4Z" fill="currentColor" />
        <path v-else d="M7 4v12m6-12v12" stroke="currentColor" stroke-width="2" />
      </svg>
      {{ paused ? 'Resume motion' : 'Pause motion' }}
    </button>
  </div>
</template>

<style scoped>
.company-motion {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
.cube-scene {
  position: absolute;
  left: 59%;
  top: 21%;
  width: 34%;
  height: 57%;
  perspective: 1100px;
  perspective-origin: 50% 45%;
}
.cube-anchor {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--size);
  height: var(--size);
  transform: translate(-50%, -50%);
  transform-style: preserve-3d;
}
.cube-violet {
  --face: #6554ee;
  --face-lit: #b0a3ff;
  --face-shade: #362487;
  --edge: #b4a6ff70;
}
.cube-lime {
  --face: #b5ed3e;
  --face-lit: #e5ffa0;
  --face-shade: #6d941e;
  --edge: #e5ffa080;
}
.brand-cube {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateX(-24deg) rotateY(-34deg) rotateZ(var(--tilt));
  animation: cube-drift var(--duration) ease-in-out var(--delay) infinite;
  animation-play-state: paused;
}
.is-running .brand-cube { animation-play-state: running; }
.cube-face {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: 1px solid var(--edge);
  backface-visibility: hidden;
  background: var(--face);
}
.cube-face-front { transform: translateZ(calc(var(--size) / 2)); background: linear-gradient(145deg, var(--face-lit), var(--face) 75%); }
.cube-face-back { transform: rotateY(180deg) translateZ(calc(var(--size) / 2)); }
.cube-face-right { transform: rotateY(90deg) translateZ(calc(var(--size) / 2)); background: var(--face-shade); }
.cube-face-left { transform: rotateY(-90deg) translateZ(calc(var(--size) / 2)); background: var(--face-shade); }
.cube-face-top { transform: rotateX(90deg) translateZ(calc(var(--size) / 2)); background: var(--face-lit); }
.cube-face-bottom { transform: rotateX(-90deg) translateZ(calc(var(--size) / 2)); background: var(--face-shade); }
.cube-motion-toggle.btn {
  position: absolute;
  right: 64px;
  bottom: 80px;
  min-height: 44px;
  height: 44px;
  padding-inline: 12px;
  gap: 8px;
  pointer-events: auto;
  color: var(--deck-muted);
  font-size: 15px;
  font-weight: 500;
}
.cube-motion-toggle.btn:hover { color: var(--deck-ink); background: var(--deck-surface); }
.cube-motion-toggle.btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
@keyframes cube-drift {
  0%, 100% { transform: translate3d(0, 5px, 0) rotateX(-24deg) rotateY(-34deg) rotateZ(var(--tilt)); }
  50% { transform: translate3d(0, -13px, 22px) rotateX(-14deg) rotateY(18deg) rotateZ(calc(var(--tilt) + 6deg)); }
}
@media (prefers-reduced-motion: reduce) {
  .brand-cube { animation: none; }
  .cube-motion-toggle { display: none; }
}
@media print {
  .brand-cube { animation: none; }
  .cube-motion-toggle { display: none; }
}
</style>
