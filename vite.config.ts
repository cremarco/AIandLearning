import tailwindcss from '@tailwindcss/vite'
import { cp } from 'node:fs/promises'
import path from 'node:path'

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
      outputDirectory = path.resolve(config.root, config.build.outDir)
    },
    async writeBundle() {
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
  resolve: { dedupe: ['vue', 'vue-router'] },
}
