<script setup lang="ts">
import type { StudyFocus } from '../../utils/deck'

defineProps<StudyFocus>()
</script>

<template>
  <aside class="study-phase-ribbon" :data-phase="primary" :aria-label="`Main study phase: ${primary}${secondary?.length ? `; secondary: ${secondary[0]}` : ''}`">
    <div class="badge badge-primary study-phase-band">
      <span class="study-phase-primary">{{ primary }}</span>
      <span v-if="secondary?.length" class="study-phase-secondary">{{ secondary[0] }}</span>
    </div>
  </aside>
</template>

<style scoped>
.study-phase-ribbon { position:absolute; z-index:6; top:0; right:0; width:160px; height:160px; overflow:hidden; pointer-events:none; }
.study-phase-ribbon[data-phase="plan"] { --phase-color:var(--color-sky-300); }
.study-phase-ribbon[data-phase="understand"] { --phase-color:var(--color-teal-400); }
.study-phase-ribbon[data-phase="connect"] { --phase-color:var(--color-violet-300); }
.study-phase-ribbon[data-phase="recall"] { --phase-color:var(--color-amber-300); }
.study-phase-ribbon[data-phase="apply"] { --phase-color:var(--color-orange-300); }
.study-phase-ribbon[data-phase="check"] { --phase-color:var(--color-rose-300); }
.study-phase-ribbon[data-phase="support"] { --phase-color:var(--color-teal-400); }
.study-phase-ribbon .badge { --badge-color:var(--phase-color,var(--color-primary)); color:var(--color-zinc-950); }
.study-phase-ribbon .study-phase-band { position:absolute; top:32px; right:-54px; transform:rotate(45deg); display:flex; flex-direction:column; gap:4px; width:240px; height:58px; padding:0; border:0; border-radius:0; line-height:1; letter-spacing:.035em; text-transform:uppercase; white-space:nowrap; }
.study-phase-primary { font-size:16px; font-weight:750; }
.study-phase-secondary { font-size:14px; font-weight:600; letter-spacing:.04em; }
@media (forced-colors:active) { .study-phase-ribbon .study-phase-band { background:Highlight; color:HighlightText; } }
</style>
