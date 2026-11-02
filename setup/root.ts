import { defineRootSetup } from '@slidev/types'
import { configs, useNav } from '@slidev/client'
import { watch } from 'vue'

// One linear presentation. Old event links must not re-enable skipped slides.
export default defineRootSetup(() => {
  const nav = useNav()
  // Restore native navigation if this replaces the former bridge through HMR.
  const native = Reflect.get(nav, Symbol.for('eduforum.native-navigation'))
  if (native) Object.assign(nav, native)
  if (Object.getOwnPropertyDescriptor(configs, 'duration')?.get)
    Object.defineProperty(configs, 'duration', { configurable:true, enumerable:true, writable:true, value:undefined })
  watch(() => nav.router.currentRoute.value.query.flow, id => {
    if (id === undefined) return
    const query = { ...nav.router.currentRoute.value.query }
    delete query.flow
    void nav.router.replace({ query })
  }, { immediate:true })
})
