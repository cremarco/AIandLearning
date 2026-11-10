import { defineRootSetup } from '@slidev/types'
import { useNav } from '@slidev/client'
import { watch } from 'vue'
import { language } from '../utils/language'

// One linear presentation. Old event links must not re-enable skipped slides.
export default defineRootSetup(() => {
  // Keep author controls in development and presenter mode, outside the published viewer.
  document.documentElement.classList.toggle('published-deck', import.meta.env.PROD)
  watch(language, value => { document.documentElement.lang = value }, { immediate: true })
  const nav = useNav()
  watch(() => nav.router.currentRoute.value.query.flow, id => {
    if (id === undefined) return
    const query = { ...nav.router.currentRoute.value.query }
    delete query.flow
    void nav.router.replace({ query })
  }, { immediate:true })
})
