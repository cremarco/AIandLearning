<script setup lang="ts">
import { useSlideMotion } from '../../composables/useSlideMotion'

const { running } = useSlideMotion()
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
}
.cube-anchor {
  position: absolute;
  left: var(--x);
  top: var(--y);
  width: var(--size);
  height: var(--size);
  transform: translate(-50%, -50%);
  /* Composite each cube independently: neighbouring faces must not intersect
     in a shared perspective context when Chrome scales the Slidev canvas. */
  perspective: 1100px;
  perspective-origin: 50% 50%;
}
.cube-violet {
  --face: var(--color-violet-500);
  --face-lit: var(--color-violet-300);
  --face-shade: var(--color-violet-800);
  --edge: color-mix(in srgb, var(--color-violet-300) 45%, transparent);
}
.cube-lime {
  --face: var(--color-lime-400);
  --face-lit: var(--color-lime-200);
  --face-shade: var(--color-lime-700);
  --edge: color-mix(in srgb, var(--color-lime-200) 50%, transparent);
}
.brand-cube {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateX(-24deg) rotateY(-34deg) rotateZ(var(--tilt));
  animation: cube-drift var(--duration) ease-in-out var(--delay) infinite;
  animation-play-state: paused;
  will-change: transform;
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
@keyframes cube-drift {
  0%, 100% { transform: translate3d(0, 5px, 0) rotateX(-24deg) rotateY(-34deg) rotateZ(var(--tilt)); }
  /* Keep side faces away from edge-on backface culling during the drift. */
  50% { transform: translate3d(0, -13px, 0) rotateX(-18deg) rotateY(-20deg) rotateZ(calc(var(--tilt) + 6deg)); }
}
@media (prefers-reduced-motion: reduce) {
  .brand-cube { animation: none; will-change: auto; }
}
@media print {
  .brand-cube { animation: none; will-change: auto; }
}
</style>
