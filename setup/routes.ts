import { defineRoutesSetup } from '@slidev/types'
import PrintDeck from '../components/PrintDeck.vue'
// The static route uses the same renderer and catalog as the interactive deck.
// It also keeps PDF output independent of browser-exporter feature flags.
export default defineRoutesSetup(routes=>[
  ...routes.filter(route=>route.path!=='/print'),
  {name:'print',path:'/print',component:PrintDeck},
])
