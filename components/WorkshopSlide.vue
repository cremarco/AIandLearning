<script setup lang="ts">
import { computed, ref } from 'vue'
import LearningMap from './LearningMap.vue'
import SoftmaxFormula from './SoftmaxFormula.vue'
import LucaReaction from './LucaReaction.vue'
import EmphasisText from './EmphasisText.vue'
import AnimatedBook from './AnimatedBook.vue'
import SlideAudience from './SlideAudience.vue'
import ChatGPTIntro from './ChatGPTIntro.vue'
import PromptCommandTables from './PromptCommandTables.vue'
import { assetUrl as asset } from '../utils/assets'
import type { Slide } from '../utils/deck'
const props = defineProps<{ slide: Slide }>()
const s = computed(() => props.slide)
const active = ref(0)
const pipeline = [
  { label: 'Text', description: 'Text enters as a sequence: the model does not receive words as we read them.' },
  { label: 'Tokens and position', description: 'The tokenizer assigns identifiers; representations and position prepare the sequence.' },
  { label: 'Attention and networks', description: 'Within decoder blocks, each position combines the allowed context and transforms its representation.' },
  { label: 'Probabilities', description: 'Scores become probabilities over the vocabulary. Temperature changes the distribution.' },
  { label: 'New token', description: 'One token is selected and added to the context; the cycle repeats.' },
]
const lucaReaction = ref<InstanceType<typeof LucaReaction>>()
</script>

<template>
  <div class="workshop-content" :lang="s.lang" :class="[`kind-${s.kind}`, { 'has-media': !!s.media, 'has-character': !!s.character, 'has-prompt': !!s.prompt, 'has-comparison': !!s.comparison?.length }]" @click="lucaReaction?.advance()">
    <header v-if="s.kind !== 'chatgpt-intro'" class="workshop-heading"><h1>{{ s.title }}</h1></header>
    <p v-if="s.message && s.kind !== 'chatgpt-intro'" class="workshop-lead"><EmphasisText :text="s.message" /></p>
    <div class="workshop-stage">
      <ChatGPTIntro v-if="s.kind === 'chatgpt-intro'" :title="s.title" :message="s.message" :slide-number="s.number" />
      <PromptCommandTables v-else-if="s.kind === 'prompt-commands'" :commands="s.commands || []" />
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
          <video v-else-if="s.media.type==='video'" controls preload="none" :poster="asset(s.media.poster)" :aria-label="s.media.alt" @click.stop>
            <source :src="asset(s.media.src)" :type="s.media.src.endsWith('webm') ? 'video/webm' : 'video/mp4'" />
            <track kind="captions" srclang="en" label="English" :src="asset(s.media.captions)" default />
          </video>
          <img v-else :src="asset(s.media.src)" :alt="s.media.alt" :style="s.media.fit ? {objectFit:s.media.fit} : undefined" />
          <img v-if="s.media.type==='video'" class="video-print-poster" :src="asset(s.media.poster)" :alt="s.media.alt" />
          <figcaption v-if="s.media.caption || s.media.source">{{ s.media.caption }}<a v-if="s.media.source" class="link" :href="s.media.source" target="_blank" rel="noopener"> Source</a></figcaption>
        </figure>
        <div class="workshop-copy">
          <blockquote v-if="s.prompt" class="workshop-prompt"><span class="prompt-label">{{ s.promptLabel || 'Prompt to copy' }}</span><p>{{ s.prompt }}</p></blockquote>
          <div v-if="s.comparison?.length" class="comparison" :class="{three:s.comparison.length===3}">
            <section v-for="(item,i) in s.comparison" :key="i"><SlideAudience v-if="s.kind === 'audience-legend'" :audience="item.audience || 'both'" inline /><h2><EmphasisText :text="item.label" /></h2><p><EmphasisText :text="item.text" /></p></section>
          </div>
          <ol v-if="s.steps?.length" class="procedure-list">
            <li v-for="(step,i) in s.steps" :key="i"><span class="step-number">{{ i+1 }}</span><div><h2><EmphasisText :text="step.title" /></h2><p><EmphasisText :text="step.text" /></p></div></li>
          </ol>
          <div v-if="s.body?.length" class="workshop-body"><p v-for="(text,i) in s.body" :key="i"><EmphasisText :text="text" /></p></div>
          <div v-if="s.result" class="workshop-result"><h2>{{ s.resultLabel || 'Result of this step' }}</h2><p><EmphasisText :text="s.result" /></p></div>
          <div v-if="s.links?.length" class="workshop-links">
            <a v-for="l in s.links" :key="l.url" class="btn gap-3" :class="s.kind === 'book' && l.download ? 'btn-primary btn-xl' : s.kind === 'access' ? 'text-3xl' : 'text-xl'"
              :href="asset(l.url)" :download="l.download ? '' : undefined" :target="l.download ? undefined : '_blank'" rel="noopener">
              <span v-if="l.download" class="size-6 shrink-0 bg-current mask-contain mask-center mask-no-repeat"
                :style="{ maskImage: `url(${asset('icons/heroicons/arrow-down-tray.svg')})` }" aria-hidden="true" />
              {{ l.label }}
            </a>
          </div>
        </div>
      </template>
    </div>
    <p v-if="s.decision" class="workshop-decision"><EmphasisText :text="s.decision" /></p>
  </div>
</template>
