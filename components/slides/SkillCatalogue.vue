<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import { useSelectionMotion } from '../../composables/useSelectionMotion'
import research from '../../data/catalogues/skills-research.json'
import { assetUrl } from '../../utils/assets'
import type { StudyFocus } from '../../utils/deck'
import { localizeContent, t } from '../../utils/language'

const props = defineProps<{ ids: string[]; clickNavigation?: boolean }>()
const emit = defineEmits<{ studyPhaseChange: [focus: StudyFocus | undefined] }>()
const nav = useNav()
const context = nav.currentRoute.value.name === 'print' ? undefined : useSlideContext()
const localIndex = ref(0)
const skills = computed(() => props.ids.map(id => research.skills.find(skill => skill.id === id)).filter(Boolean).map(skill => localizeContent(skill)))
const index = computed(() => props.clickNavigation && context
  ? Math.min(context.$clicks.value, skills.value.length - 1)
  : localIndex.value)
const selected = computed(() => skills.value[index.value] || skills.value[0])
function selectSkill(next: number) {
  if (props.clickNavigation && context) void nav.go(context.$page.value, next)
  else localIndex.value = next
}
watch(selected, skill => emit('studyPhaseChange', skill?.studyPhases as StudyFocus | undefined), { immediate: true })
const detail = ref<HTMLElement>()
useSelectionMotion(detail, () => selected.value?.id)
</script>

<template>
  <div class="skill-catalogue">
    <nav :aria-label="t('Select a documented skill')">
      <ul class="menu menu-vertical skill-menu">
        <li v-for="(skill, i) in skills" :key="skill!.id">
          <button type="button" :class="{ 'menu-active': index === i }" :aria-pressed="index === i" @keydown.stop @click.stop="selectSkill(i)">{{ skill!.name }}</button>
        </li>
      </ul>
      <div v-if="selected" class="skill-host">
        <p>{{ selected.publisher }} · {{ selected.origin }}</p>
        <p>{{ selected.platform }}</p>
        <p>{{ selected.requirements }}</p>
      </div>
    </nav>
    <section v-if="selected" ref="detail" class="skill-detail" :data-skill="selected.id" aria-live="polite">
      <h2>{{ selected.summary }}</h2>
      <p class="skill-capabilities">{{ selected.capabilities || selected.summary }}</p>
      <div class="skill-expected"><h3>{{ t(selected.executionStatus === 'executed' ? 'Observed in the chapter test' : 'Expected deliverable') }}</h3><p>{{ selected.resultExcerpt || selected.expected }}</p></div>
      <p class="skill-caveat">{{ selected.caveat }}</p>
      <div class="skill-links">
        <a class="link" :href="selected.sourceUrl" target="_blank" rel="noopener">{{ t('Publisher’s skill') }}</a>
        <a class="link" :href="assetUrl(`materials/skills-guide.html#${selected.id}`)" target="_blank" rel="noopener">{{ t('Install and requirements') }}</a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.skill-catalogue { display:grid; grid-template-columns:320px minmax(0,1fr); width:100%; gap:40px; align-self:stretch; align-items:start; }
.skill-catalogue nav { min-width:0; }
.slidev-layout .skill-menu { width:100%; padding:0; gap:6px; background:none; font-size:22px; }
.slidev-layout .skill-menu li { padding:0; margin:0; }
.slidev-layout .skill-menu button { min-height:48px; padding:9px 12px; border-radius:6px; line-height:1.2; overflow-wrap:anywhere; color:var(--deck-ink); transition:color var(--deck-motion-feedback) var(--deck-motion-ease), background-color var(--deck-motion-feedback) var(--deck-motion-ease); }
.slidev-layout .skill-menu button.menu-active { color:var(--deck-cyan); background:var(--deck-surface); font-weight:700; }
.skill-host { display:flex; flex-direction:column; gap:8px; margin-top:12px; padding-inline:12px; }
.slidev-layout .skill-host p { font-size:18px; line-height:1.25; color:var(--deck-muted); }
.skill-detail { min-width:0; display:flex; flex-direction:column; gap:20px; padding-top:6px; }
.slidev-layout .skill-detail h2 { font-size:26px; line-height:1.2; }
.slidev-layout .skill-capabilities { font-size:22px; line-height:1.35; overflow-wrap:anywhere; }
.skill-expected { display:flex; flex-direction:column; gap:5px; }
.slidev-layout .skill-expected h3 { font-size:var(--deck-text-label); color:var(--deck-cyan); font-weight:650; opacity:1; text-transform:none; letter-spacing:0; }
.slidev-layout .skill-expected p { font-size:22px; line-height:1.25; }
.slidev-layout .skill-caveat { font-size:18px; line-height:1.3; color:var(--deck-muted); }
.skill-links { display:flex; flex-wrap:wrap; gap:12px 26px; font-size:18px; }
</style>
