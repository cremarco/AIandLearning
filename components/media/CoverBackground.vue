<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { createParticleWave, WAVE_CONFIG } from '../../utils/particle-wave'
import { useSlideMotion } from '../../composables/useSlideMotion'

const canvas = ref<HTMLCanvasElement>()
const { running, isStatic } = useSlideMotion()
const updateParticles = createParticleWave()
const frameInterval = 1000 / WAVE_CONFIG.fps
let paint: CanvasRenderingContext2D | null = null
let frame = 0
let elapsed = 0
let last = 0
let nextDraw = 0

function draw(time: number) {
  if (!paint) return
  paint.clearRect(0, 0, WAVE_CONFIG.width, WAVE_CONFIG.height)
  for (const { x, y, radius, light, alpha, color } of updateParticles(time)) {
    if (!alpha) continue
    paint.fillStyle = `rgba(${color},${alpha})`
    paint.beginPath()
    paint.arc(x, y, radius, 0, Math.PI * 2)
    paint.fill()
    if (light > .85) {
      paint.fillStyle = `rgba(0,180,255,${alpha * .065})`
      paint.beginPath()
      paint.arc(x, y, radius * 2.6, 0, Math.PI * 2)
      paint.fill()
    }
  }
}
function stop() {
  cancelAnimationFrame(frame)
  frame = last = nextDraw = 0
}
function tick(now: number) {
  if (!running.value) return
  if (!last) last = nextDraw = now
  elapsed += Math.min(now - last, 100) / 1000
  last = now
  if (now >= nextDraw) {
    draw(elapsed)
    nextDraw = now + frameInterval - ((now - nextDraw) % frameInterval)
  }
  frame = requestAnimationFrame(tick)
}
function sync() {
  stop()
  draw(isStatic.value ? 0 : elapsed)
  if (running.value) frame = requestAnimationFrame(tick)
}
watch([running, isStatic], sync)
onMounted(() => {
  paint = canvas.value?.getContext('2d') ?? null
  sync()
})
onScopeDispose(stop)
</script>

<template>
  <div class="cover-background absolute inset-0 pointer-events-none" aria-hidden="true"
    :data-motion="running ? 'playing' : 'still'">
    <canvas ref="canvas" class="h-full w-full" width="1280" height="720" />
  </div>
</template>

<style scoped>
.cover-background { z-index: 0; overflow: hidden; }
</style>
