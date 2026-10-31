import tailwindcss from '@tailwindcss/vite'

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

export default {
  plugins: [applicationTailwind],
  resolve: { dedupe: ['vue', 'vue-router'] },
}
