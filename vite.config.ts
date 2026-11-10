import tailwindcss from '@tailwindcss/vite'
import { cp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const isMru = process.env.EDUFORUM_DECK === 'mru'
const projectRoot = fileURLToPath(new URL('.', import.meta.url))

// Slidev's own CSS uses UnoCSS @apply directives. Tailwind owns the
// application stylesheet; leave dependency styles to Slidev's CSS engine.
const applicationTailwind = tailwindcss().map((plugin) => {
  const transform = plugin.transform
  if (transform && typeof transform === 'object') {
    const handler = transform.handler
    plugin.transform = {
      ...transform,
      handler(code, id, ...args) {
        if (id.includes('/node_modules/')) return
        return handler.call(this, code, id, ...args)
      },
    }
  }
  return plugin
})

function publicAssets() {
  let publicDirectory: string
  let outputDirectory: string
  return {
    name: 'eduforum-public-assets',
    apply: 'build' as const,
    configResolved(config: { publicDir: string; root: string; build: { outDir: string } }) {
      publicDirectory = config.publicDir
      outputDirectory = path.resolve(config.root, process.env.EDUFORUM_PUBLIC_OUT_DIR || config.build.outDir)
    },
    async writeBundle() {
      // MRU reuses the main site's public files rather than copying videos and images.
      if (isMru) return
      const models = path.join(publicDirectory, 'materials/demo-genai/models')
      await cp(publicDirectory, outputDirectory, {
        recursive: true,
        // Keep one local model installation. Opt in for a self-contained offline build.
        filter: source => process.env.INCLUDE_MODEL_WEIGHTS === '1'
          || (source !== models && !source.startsWith(models + path.sep)),
      })
    },
  }
}

export default {
  plugins: [applicationTailwind, publicAssets()],
  build: { copyPublicDir: false },
  experimental: {
    renderBuiltUrl(filename: string, { type, hostType, hostId }: { type: string; hostType: string; hostId: string }) {
      const sharedBase = process.env.VITE_SHARED_ASSET_BASE
      if (!sharedBase || type !== 'public') return
      // Relative CSS URLs resolve from the stylesheet's directory, not the page.
      if (sharedBase.startsWith('.') && hostType === 'css') {
        const stylesheet = hostId.startsWith('assets/') ? hostId : `assets/${hostId}`
        return path.posix.relative(path.posix.dirname(stylesheet), `${sharedBase}${filename}`)
      }
      return `${sharedBase}${filename}`
    },
  },
  resolve: {
    dedupe: ['vue', 'vue-router'],
    alias: {
      '#deck/slides': path.join(projectRoot, isMru ? 'data/mru/slides.json' : 'data/generated/slides-runtime.json'),
      '#deck/highlights': path.join(projectRoot, isMru ? 'data/mru/highlights.json' : 'data/content/highlights.json'),
    },
  },
}
