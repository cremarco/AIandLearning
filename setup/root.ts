import { defineRootSetup } from '@slidev/types'
import { useNav } from '@slidev/client'
import { watch } from 'vue'

// One linear presentation. Old event links must not re-enable skipped slides.
export default defineRootSetup(() => {
  const nav = useNav()
  watch(() => nav.router.currentRoute.value.query.flow, id => {
    if (id === undefined) return
    const query = { ...nav.router.currentRoute.value.query }
    delete query.flow
    void nav.router.replace({ query })
  }, { immediate:true })
})
