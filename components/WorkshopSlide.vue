<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSlideVideo } from '../utils/slide-video'
import LearningMap from './LearningMap.vue'
import SoftmaxFormula from './SoftmaxFormula.vue'
import LucaReaction from './LucaReaction.vue'
import EmphasisText from './EmphasisText.vue'
import AnimatedBook from './AnimatedBook.vue'
import SlideAudience from './SlideAudience.vue'
import ChatGPTIntro from './ChatGPTIntro.vue'
import PromptCommandTables from './PromptCommandTables.vue'
import FormalCommandResults from './FormalCommandResults.vue'
import PromptBlock from './PromptBlock.vue'
import PromptVideoDialog from './PromptVideoDialog.vue'
import SkillCatalogue from './SkillCatalogue.vue'
import DownloadIcon from './DownloadIcon.vue'
import BrowserVideo from './BrowserVideo.vue'
import ShortcutCloud from './ShortcutCloud.vue'
import ShortcutDetail from './ShortcutDetail.vue'
import ToolLogos from './ToolLogos.vue'
import ToolResourceTable from './ToolResourceTable.vue'
import BibliographyGrid from './BibliographyGrid.vue'
import { brandsForLabel, brandsForSlide } from '../utils/tool-brands'
import { assetUrl as asset } from '../utils/assets'
import { getShortcutVideo } from '../utils/shortcut-videos'
import type { Slide } from '../utils/deck'
const props = defineProps<{ slide: Slide }>()
const s = computed(() => props.slide)
const headingCommand = computed(() => {
  const command = s.value.commandCategory === 'formal-web' && s.value.commands?.length === 1
    ? s.value.commands[0].command : ''
  return command && s.value.title.startsWith(command) ? command : ''
})
const active = ref(0)
const video = ref<HTMLVideoElement>()
useSlideVideo(video)
const pipeline = [
  { label: 'Text', description: 'Text enters as a sequence: the model does not receive words as we read them.' },
  { label: 'Tokens and position', description: 'The tokenizer assigns identifiers; representations and position prepare the sequence.' },
  { label: 'Attention and networks', description: 'Within decoder blocks, each position combines the allowed context and transforms its representation.' },
  { label: 'Probabilities', description: 'Scores become probabilities over the vocabulary. Temperature changes the distribution.' },
  { label: 'New token', description: 'One token is selected and added to the context; the cycle repeats.' },
]
const lucaReaction = ref<InstanceType<typeof LucaReaction>>()
const promptVideo = ref<InstanceType<typeof PromptVideoDialog>>()
const exampleVideo = computed(() => s.value.kind === 'shortcut-example'
  ? getShortcutVideo(s.value.prompt?.match(/^\/\S+/)?.[0] || '') : undefined)
</script>

<template>
  <div class="workshop-content" :lang="s.lang" :class="[`kind-${s.kind}`, { 'has-media': !!s.media, 'has-character': !!s.character, 'has-prompt': !!s.prompt, 'has-comparison': !!s.comparison?.length, 'has-four-steps': (s.steps?.length || 0) >= 4, 'has-mixed-content': !!s.comparison?.length && !!s.steps?.length, 'has-long-title': s.title.length > 55 }]" @click="lucaReaction?.advance()">
    <header v-if="!['chatgpt-intro', 'shortcut-cloud'].includes(s.kind)" class="workshop-heading flex items-center gap-4">
      <ToolLogos :ids="brandsForSlide(s)" />
      <h1><template v-if="headingCommand"><span class="command-token">{{ headingCommand }}</span>{{ s.title.slice(headingCommand.length) }}</template><EmphasisText v-else :text="s.title" :terms="s.kind === 'section-divider' ? undefined : []" /></h1>
    </header>
    <p v-if="s.message && !['chatgpt-intro', 'shortcut-cloud'].includes(s.kind)" class="workshop-lead"><EmphasisText :text="s.message" /></p>
    <PromptBlock v-if="s.prompt && s.kind === 'tool-demo'" class="tool-demo-prompt" :text="s.promptExcerpt || s.prompt" :label="s.promptLabel || 'Prompt to copy'" />
    <div v-if="s.kind !== 'section-divider'" class="workshop-stage">
      <ChatGPTIntro v-if="s.kind === 'chatgpt-intro'" :title="s.title" :message="s.message" :slide-number="s.number" />
      <ShortcutCloud v-else-if="s.kind === 'shortcut-cloud'" :items="s.shortcutLabels || []" :slide-number="s.number" />
      <ShortcutDetail v-else-if="s.kind === 'shortcut-detail'" :slide="s" />
      <FormalCommandResults v-else-if="s.commandCategory === 'formal-web' && s.commands?.some(command => command.result)" :commands="s.commands || []" />
      <SkillCatalogue v-else-if="s.skillIds?.length" :ids="s.skillIds" />
      <ToolResourceTable v-else-if="s.toolTable" :table="s.toolTable" :label="s.title" />
      <BibliographyGrid v-else-if="s.kind === 'bibliography' || s.kind === 'web-resources'" :references="s.references || []" :spacious="s.kind === 'web-resources'" />
      <PromptCommandTables v-else-if="s.kind === 'prompt-commands'" :commands="s.commands || []" :category="s.commandCategory" />
      <template v-else-if="s.character">
        <div class="workshop-copy"><div class="workshop-body"><p v-for="(text,i) in s.body" :key="i"><EmphasisText :text="text" /></p></div></div>
        <LucaReaction ref="lucaReaction" :character="s.character" :slide-number="s.number" />
      </template>
      <template v-else-if="s.kind === 'references'">
        <div class="reference-list">
          <article v-for="(r,i) in s.references || []" :key="i">
            <h2>{{ r.label }}</h2><p>{{ r.citation }}</p>
            <a v-if="r.url" class="link" :href="r.url" target="_blank" rel="noopener">{{ r.display || r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*/, '') }}</a>
          </article>
          <p v-for="(text,i) in s.body || []" :key="`body${i}`"><EmphasisText :text="text" /></p>
        </div>
      </template>
      <template v-else-if="s.formula">
        <SoftmaxFormula /><ol class="procedure-list"><li v-for="(step,i) in s.steps" :key="i"><span class="step-number">{{ i+1 }}</span><div><h2><EmphasisText :text="step.title" /></h2><p><EmphasisText :text="step.text" /></p></div></li></ol>
      </template>
      <template v-else-if="s.diagram === 'initial' || s.diagram === 'revised'">
        <div class="map-composition"><LearningMap :revised="s.diagram==='revised'" /><p><EmphasisText :text="s.result || s.body?.join(' ')" /></p></div>
      </template>
      <template v-else-if="s.id === 'S77'">
        <div class="pipeline" role="group" aria-label="Conceptual generation flow, five stages">
          <button v-for="(step,i) in pipeline" :key="step.label" type="button" class="btn pipeline-step h-auto min-h-36 flex-1 flex-col gap-3 whitespace-normal p-4.5 text-2xl leading-tight" :class="{ current: active === i, 'btn-primary': active === i }" :aria-pressed="active===i" @click.stop="active=i"><span class="text-lg font-normal opacity-75">{{ i+1 }}</span><strong>{{ step.label }}</strong></button>
        </div>
        <p class="pipeline-caption" aria-live="polite" aria-atomic="true">{{ pipeline[active].description }}</p>
        <p class="pipeline-static">Text → tokens and position → decoder blocks → vocabulary probabilities → selected token. Parameters stay fixed during inference. The selected token is added to the context and the process repeats.</p>
      </template>
      <template v-else>
        <figure v-if="s.media" class="workshop-media">
          <AnimatedBook v-if="s.book" :book="s.book" :slide-number="s.number" />
          <BrowserVideo v-else-if="s.media.type==='video' && s.media.browserFrame" :media="s.media" />
          <video v-else-if="s.media.type==='video'" ref="video" playsinline controls preload="none" :poster="asset(s.media.poster)" :aria-label="s.media.alt" @click.stop @pointerdown.stop @keydown.stop @keyup.stop>
            <source :src="asset(s.media.src)" :type="s.media.src.endsWith('webm') ? 'video/webm' : 'video/mp4'" />
            <track kind="captions" srclang="en" label="English" :src="asset(s.media.captions)" :default="s.media.captionsDefault !== false" />
          </video>
          <img v-else :src="asset(s.media.src)" :alt="s.media.alt" :style="s.media.fit ? {objectFit:s.media.fit} : undefined" />
          <img v-if="s.media.type==='video' && !s.media.browserFrame" class="video-print-poster" :src="asset(s.media.poster)" :alt="s.media.alt" />
          <figcaption v-if="s.media.caption || s.media.source">{{ s.media.caption }}<a v-if="s.media.source" class="link" :href="s.media.source" target="_blank" rel="noopener"> Source</a><button v-if="exampleVideo" class="btn btn-sm workshop-video-open" type="button" @click.stop="promptVideo?.open(exampleVideo.command)">Open video</button></figcaption>
        </figure>
        <div class="workshop-copy">
          <PromptBlock v-if="s.prompt && s.kind !== 'tool-demo'" class="workshop-prompt" :text="s.prompt" :label="s.promptLabel || 'Prompt to copy'" />
          <div v-if="s.comparison?.length" class="comparison" :class="{three:s.comparison.length===3}">
            <section v-for="(item,i) in s.comparison" :key="i"><SlideAudience v-if="s.kind === 'audience-legend'" :audience="item.audience || 'both'" inline /><h2 class="comparison-heading"><ToolLogos :ids="brandsForLabel(item.label)" compact /><EmphasisText :text="item.label" /></h2><p><EmphasisText :text="item.text" /></p></section>
          </div>
          <ol v-if="s.steps?.length" class="procedure-list">
            <li v-for="(step,i) in s.steps" :key="i"><span class="step-number">{{ i+1 }}</span><div><h2><EmphasisText :text="step.title" /></h2><p><EmphasisText :text="step.text" /></p></div></li>
          </ol>
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
.comparison-heading { display:flex; align-items:center; gap:10px; }
.workshop-video-open { margin-left:12px; vertical-align:middle; }
@media print { .workshop-video-open { display:none; } }
</style>
