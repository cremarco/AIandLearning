export const WAVE_CONFIG = {
  width: 1280,
  height: 720,
  columns: 117,
  rows: 43,
  fps: 30,
  speed: 2.05,
  twistAmplitude: .14,
  rippleAmplitude: 46,
  depthAmplitude: 34,
  rightExtension: 70,
} as const

export type WaveParticle = {
  x: number
  y: number
  depth: number
  radius: number
  light: number
  alpha: number
  color: string
}

const smoothstep = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Keep the authored folded surface while allocating its particle pool only once. */
export function createParticleWave() {
  const samples = Array.from({ length: WAVE_CONFIG.rows * WAVE_CONFIG.columns }, (_, index) => {
    const v = Math.floor(index / WAVE_CONFIG.columns) / (WAVE_CONFIG.rows - 1) * 2 - 1
    const u = (index % WAVE_CONFIG.columns) / (WAVE_CONFIG.columns - 1)
    const near = (1 - v) / 2
    const crestRow = .72 * Math.tanh((u - .45) * 5)
    const crest = Math.exp(-Math.pow((v - crestRow) / .32, 2))
    const light = Math.min(1, .08 + .18 * near + .78 * crest)
    return {
      angle: .14 + u * 3.05 + .22 * Math.sin(v * 2.4) * Math.sin(u * Math.PI),
      across: v * (175 + 20 * Math.cos(u * Math.PI * 2)) * (1 - .7 * smoothstep(.76, 1, u)),
      phase: u * 5.4 + v * 1.8,
      offsetX: (u - .5) * 820 + v * 125 * smoothstep(.45, .85, u),
      offsetY: 65 - u * 80 + 30 * Math.sin(u * 7) + 65 * smoothstep(.68, 1, u)
        - 50 * Math.exp(-Math.pow((u - .77) / .2, 2)),
      extension: WAVE_CONFIG.rightExtension * smoothstep(.45, 1, u),
      radius: 1.15 + 1.1 * light,
      opacity: .4 + .58 * light,
      point: {
        x: 0, y: 0, depth: 0, radius: 0, alpha: 0, light,
        color: `${Math.round(3 + 15 * light)},${Math.round(60 + 180 * light)},255`,
      } satisfies WaveParticle,
    }
  })
  const drawingOrder = samples.map(sample => sample.point)

  return (time: number): readonly WaveParticle[] => {
    const motionTime = time * WAVE_CONFIG.speed
    const breath = Math.sin(motionTime * Math.PI / 16)
    for (const sample of samples) {
      const angle = sample.angle + WAVE_CONFIG.twistAmplitude * breath
      const ripple = Math.sin(sample.phase - motionTime * .16)
      const worldX = sample.offsetX + sample.across * Math.sin(angle) * .3
      const worldY = sample.offsetY + sample.across * Math.cos(angle) + WAVE_CONFIG.rippleAmplitude * ripple
      const depth = sample.across * Math.sin(angle) + WAVE_CONFIG.depthAmplitude * ripple
      const perspective = 1000 / (1000 + depth)
      const point = sample.point
      point.x = 900 + worldX * perspective + sample.extension
      point.y = 365 + worldY * perspective
      point.depth = depth
      point.alpha = smoothstep(555, 775, point.x) * sample.opacity
      point.radius = sample.radius * perspective
    }
    // Paint far rows first. Sorting references leaves the reusable pool intact.
    drawingOrder.sort((a, b) => b.depth - a.depth)
    return drawingOrder
  }
}
