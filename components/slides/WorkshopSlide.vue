<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSlideVideo } from '../../composables/useSlideVideo'
import LucaReaction from '../media/LucaReaction.vue'
import EmphasisText from '../shared/EmphasisText.vue'
import AnimatedBook from '../media/AnimatedBook.vue'
import SlideAudience from '../shared/SlideAudience.vue'
import ChatGPTIntro from './ChatGPTIntro.vue'
import PromptCommandTables from '../shared/PromptCommandTables.vue'
import FormalCommandResults from './FormalCommandResults.vue'
import PromptBlock from '../shared/PromptBlock.vue'
import PromptVideoDialog from '../media/PromptVideoDialog.vue'
import SkillCatalogue from './SkillCatalogue.vue'
import DownloadIcon from '../shared/DownloadIcon.vue'
import BrowserVideo from '../media/BrowserVideo.vue'
import RecordingResultLinks from '../shared/RecordingResultLinks.vue'
import ShortcutCloud from '../shared/ShortcutCloud.vue'
import ShortcutDetail from './ShortcutDetail.vue'
import ScreenshotResults from './ScreenshotResults.vue'
import ToolLogos from '../shared/ToolLogos.vue'
import ToolResourceTable from '../shared/ToolResourceTable.vue'
import BibliographyGrid from '../shared/BibliographyGrid.vue'
import ActivityTimer from '../shared/ActivityTimer.vue'
import { brandsForLabel, brandsForSlide } from '../../utils/tool-brands'
import { assetUrl as asset } from '../../utils/assets'
import { explainedShortcuts, getShortcutVideo } from '../../utils/shortcut-videos'
import type { Slide, StudyFocus } from '../../utils/deck'
const props = defineProps<{ slide: Slide }>()
const emit = defineEmits<{ studyPhaseChange: [focus: StudyFocus | undefined] }>()
const s = computed(() => props.slide)
const hasVideo = computed(() => s.value.media?.type === 'video'
  || s.value.commands?.some(command => command.result?.media.type === 'video'))
const headingCommand = computed(() => {
  const command = s.value.commandCategory === 'formal-web' && s.value.commands?.length === 1
    ? s.value.commands[0].command : ''
  return command && s.value.title.startsWith(command) ? command : ''
})
const video = ref<HTMLVideoElement>()
useSlideVideo(video)
const lucaReaction = ref<InstanceType<typeof LucaReaction>>()
const promptVideo = ref<InstanceType<typeof PromptVideoDialog>>()
const exampleVideo = computed(() => s.value.kind === 'shortcut-example'
  ? getShortcutVideo(s.value.prompt?.match(/^\/\S+/)?.[0] || '') : undefined)
</script>

<template>
  <div class="workshop-content" :lang="s.lang" :class="[`kind-${s.kind}`, { 'has-video': hasVideo, 'has-media': !!s.media, 'has-character': !!s.character, 'has-prompt': !!s.prompt, 'has-full-prompt': s.videoLayout === 'prompt', 'has-long-prompt': (s.prompt?.length || 0) > 600, 'has-comparison': !!s.comparison?.length, 'has-four-steps': (s.steps?.length || 0) >= 4, 'has-mixed-content': !!s.comparison?.length && !!s.steps?.length, 'has-long-title': s.title.length > 55 }]" @click="lucaReaction?.advance()">
    <img v-if="s.kind === 'section-divider' && s.media" class="section-divider-art pointer-events-none absolute right-0 top-0 h-full w-[54%] object-contain" :src="asset(s.media.src)" :alt="s.media.alt" />
    <div v-if="s.kind === 'tool-divider'" class="hero h-full">
      <div class="hero-content w-full max-w-none text-center">
        <ToolLogos :ids="brandsForSlide(s)" prominent />
        <h1>{{ s.title }}</h1>
      </div>
    </div>
    <header v-if="!['chatgpt-intro', 'shortcut-cloud', 'tool-divider'].includes(s.kind)" class="workshop-heading flex items-center gap-4">
      <ToolLogos :ids="brandsForSlide(s)" />
      <h1><svg v-if="s.kind === 'shortcut-detail' && explainedShortcuts.has(s.title)" class="command-example-dot" role="img" aria-label="Example explained in the speaker notes" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor" /></svg><template v-if="headingCommand"><span class="command-token">{{ headingCommand }}</span>{{ s.title.slice(headingCommand.length) }}</template><EmphasisText v-else :text="s.title" :terms="s.kind === 'section-divider' ? undefined : []" /></h1>
    </header>
    <p v-if="s.message && !['chatgpt-intro', 'shortcut-cloud'].includes(s.kind)" class="workshop-lead"><EmphasisText :text="s.message" /></p>
    <PromptBlock v-if="s.prompt && s.kind === 'tool-demo'" class="tool-demo-prompt" :text="s.prompt" :label="s.promptLabel || 'Prompt to copy'" />
    <div v-if="!['section-divider', 'tool-divider'].includes(s.kind)" class="workshop-stage">
      <ChatGPTIntro v-if="s.kind === 'chatgpt-intro'" :title="s.title" :message="s.message" :slide-number="s.number" />
      <ShortcutCloud v-else-if="s.kind === 'shortcut-cloud'" :items="s.shortcutLabels || []" :slide-number="s.number" />
      <ShortcutDetail v-else-if="s.kind === 'shortcut-detail'" :slide="s" />
      <ul v-else-if="s.kind === 'audience-questions'" class="list audience-questions" :aria-label="s.title">
        <li v-for="(question, index) in s.body" :key="question" class="list-row">
          <span class="audience-question-symbol" aria-hidden="true">
            <svg v-if="index === 0" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 11v5a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h6" />
              <path d="m18 2 1.3 3.7L23 7l-3.7 1.3L18 12l-1.3-3.7L13 7l3.7-1.3Z" />
              <path d="M7 12h4m-4 3h8" />
            </svg>
            <ToolLogos v-else :ids="index === 1 ? ['chatgpt'] : ['notebook']" />
          </span>
          <p class="audience-question-text">{{ question }}</p>
        </li>
      </ul>
      <ScreenshotResults v-else-if="s.screenshots?.length" :items="s.screenshots" />
      <FormalCommandResults v-else-if="s.commandCategory === 'formal-web' && s.commands?.some(command => command.result)" :commands="s.commands || []" />
      <SkillCatalogue v-else-if="s.skillIds?.length" :ids="s.skillIds" @study-phase-change="emit('studyPhaseChange', $event)" />
      <ToolResourceTable v-else-if="s.toolTable" :table="s.toolTable" :label="s.title" />
      <BibliographyGrid v-else-if="s.kind === 'bibliography' || s.kind === 'web-resources'" :references="s.references || []" :spacious="s.kind === 'web-resources'" />
      <PromptCommandTables v-else-if="s.kind === 'prompt-commands'" :commands="s.commands || []" :category="s.commandCategory" />
      <template v-else-if="s.character">
        <div class="workshop-copy"><div class="workshop-body"><p v-for="(text,i) in s.body" :key="i"><EmphasisText :text="text" /></p></div></div>
        <LucaReaction ref="lucaReaction" :character="s.character" :slide-number="s.number" />
      </template>
      <template v-else>
        <figure v-if="s.media" class="workshop-media">
          <AnimatedBook v-if="s.book" :book="s.book" :slide-number="s.number" />
          <BrowserVideo v-else-if="s.media.type==='video' && s.media.browserFrame" :media="s.media" :show-result="false" />
          <video v-else-if="s.media.type==='video'" ref="video" playsinline controls preload="none" :poster="asset(s.media.poster)" :aria-label="s.media.alt" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
            <source :src="asset(s.media.src)" :type="s.media.src.endsWith('webm') ? 'video/webm' : 'video/mp4'" />
            <track kind="captions" srclang="en" label="English" :src="asset(s.media.captions)" :default="s.media.captionsDefault !== false" />
          </video>
          <picture v-else-if="s.media.src.endsWith('.gif') && s.media.poster" class="block w-full">
            <source media="print, (prefers-reduced-motion: reduce)" :srcset="asset(s.media.poster)" />
            <img :src="asset(s.media.src)" :alt="s.media.alt" :style="s.media.fit ? {objectFit:s.media.fit} : undefined" />
          </picture>
          <img v-else :src="asset(s.media.src)" :alt="s.media.alt" :style="s.media.fit ? {objectFit:s.media.fit} : undefined" />
          <img v-if="s.media.type==='video' && !s.media.browserFrame" class="video-print-poster" :src="asset(s.media.poster)" :alt="s.media.alt" />
          <figcaption v-if="s.media.caption || s.media.source || s.media.result">
            <span v-if="s.media.type !== 'video'">{{ s.media.caption }}</span>
            <a v-if="s.tool === 'notebook' && s.media.source" class="link" :href="s.media.source" target="_blank" rel="noopener" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>Open notebook</a>
            <template v-else>
              <a v-if="s.media.source && !s.media.result" class="link" :href="s.media.source" target="_blank" rel="noopener">Source</a>
              <RecordingResultLinks compact :links-only="s.media.type === 'video'" :result="s.media.result" />
            </template>
            <button v-if="exampleVideo" class="btn btn-sm workshop-video-open" type="button" @click.stop="promptVideo?.open(exampleVideo.command)">Open video</button>
          </figcaption>
        </figure>
        <div class="workshop-copy">
          <PromptBlock v-if="s.prompt && s.kind !== 'tool-demo'" class="workshop-prompt" :text="s.prompt" :label="s.promptLabel || 'Prompt to copy'" />
          <div v-if="s.comparison?.length" class="comparison" :class="{three:s.comparison.length===3}">
            <section v-for="(item,i) in s.comparison" :key="i"><SlideAudience v-if="s.kind === 'audience-legend'" :audience="item.audience || 'both'" inline /><h2 class="comparison-heading"><ToolLogos :ids="brandsForLabel(item.label)" compact /><EmphasisText :text="item.label" /></h2><p><EmphasisText :text="item.text" /></p></section>
          </div>
          <ol v-if="s.steps?.length" class="procedure-list">
            <li v-for="(step,i) in s.steps" :key="i"><span class="step-number">{{ i+1 }}</span><div><h2><EmphasisText :text="step.title" /></h2><p><EmphasisText :text="step.text" /></p></div></li>
          </ol>
          <ActivityTimer v-if="s.activityTimer" :minutes="s.activityTimer.minutes" :timer-id="s.activityTimer.id" />
          <div v-if="s.body?.length" class="workshop-body"><p v-for="(text,i) in s.body" :key="i"><EmphasisText :text="text" /></p></div>
          <div v-if="s.result" class="workshop-result"><h2>{{ s.resultLabel || 'Result of this step' }}</h2><p><EmphasisText :text="s.result" /></p></div>
          <div v-if="s.links?.length" class="workshop-links">
            <a v-for="l in s.links" :key="l.url" class="btn gap-3" :class="s.kind === 'book' && l.download ? 'btn-primary btn-xl' : s.kind === 'access' ? 'text-3xl' : 'text-xl'"
              :href="asset(l.url)" :download="l.download ? '' : undefined" :target="l.download ? undefined : '_blank'" rel="noopener">
              <DownloadIcon v-if="l.download" :slide-number="s.number" />
              {{ l.label }}
            </a>
          </div>
        </div>
      </template>
    </div>
    <div v-if="s.links?.length && ['bibliography', 'web-resources'].includes(s.kind)" class="workshop-links bibliography-links">
      <a v-for="link in s.links" :key="link.url" class="btn btn-sm gap-2" :href="asset(link.url)" :download="link.download ? '' : undefined" :target="link.download ? undefined : '_blank'" rel="noopener"><DownloadIcon v-if="link.download" :slide-number="s.number" />{{ link.label }}</a>
    </div>
    <p v-if="s.decision && s.kind !== 'shortcut-cloud'" class="workshop-decision"><EmphasisText :text="s.decision" /></p>
    <PromptVideoDialog v-if="exampleVideo" ref="promptVideo" />
  </div>
</template>

<style scoped>
.workshop-heading h1 { min-width:0; }
.command-example-dot { display:inline-block; width:8px; height:8px; margin-right:10px; vertical-align:middle; color:var(--deck-important); }
.comparison-heading { display:flex; align-items:center; gap:10px; }
.workshop-video-open { margin-left:12px; vertical-align:middle; }
@media print { .workshop-video-open { display:none; } }
</style>
