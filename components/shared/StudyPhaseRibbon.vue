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
.study-phase-ribbon { position:absolute; z-index:6; top:0; right:0; width:128px; height:128px; pointer-events:none; }
/* Meet the slide's top and right edges without cropping a rotated rectangle. */
.study-phase-ribbon::before { content:""; position:absolute; inset:0; background:var(--phase-color,var(--color-primary)); clip-path:polygon(0 0,52px 0,100% 76px,100% 100%); }
.study-phase-ribbon[data-phase="plan"] { --phase-color:var(--color-sky-300); }
.study-phase-ribbon[data-phase="understand"] { --phase-color:var(--color-teal-400); }
.study-phase-ribbon[data-phase="connect"] { --phase-color:var(--color-violet-300); }
.study-phase-ribbon[data-phase="recall"] { --phase-color:var(--color-amber-300); }
.study-phase-ribbon[data-phase="apply"] { --phase-color:var(--color-orange-300); }
.study-phase-ribbon[data-phase="check"] { --phase-color:var(--color-rose-300); }
.study-phase-ribbon[data-phase="support"] { --phase-color:var(--color-teal-400); }
.study-phase-ribbon .badge { --badge-color:transparent; background:transparent; color:var(--color-zinc-950); }
.study-phase-ribbon .study-phase-band { position:absolute; top:51px; left:77px; transform:translate(-50%,-50%) rotate(45deg); display:flex; flex-direction:column; gap:3px; width:108px; height:32px; padding:0; border:0; border-radius:0; line-height:1; letter-spacing:.035em; text-transform:uppercase; white-space:nowrap; }
.study-phase-primary { font-size:14px; font-weight:750; }
.study-phase-secondary { font-size:11px; font-weight:600; letter-spacing:.04em; }
@media (forced-colors:active) {
  .study-phase-ribbon::before { background:Highlight; }
  .study-phase-ribbon .study-phase-band { color:HighlightText; }
}
</style>
