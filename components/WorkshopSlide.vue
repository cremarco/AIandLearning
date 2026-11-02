<script setup lang="ts">
import { computed, ref } from 'vue'
import LearningMap from './LearningMap.vue'
import SoftmaxFormula from './SoftmaxFormula.vue'
const props = defineProps<{ slide: any }>()
const s = computed(() => props.slide)
const base = import.meta.env.BASE_URL
const asset = (url: string) => /^https?:/.test(url) ? url : `${base}${url.replace(/^\//, '')}`
const toolNames: Record<string,string> = { goblin:'Goblin.tools', notebook:'Gemini Notebook', excalidraw:'Excalidraw', napkin:'Napkin', claude:'Claude', magicschool:'MagicSchool', formative:'Formative', edge:'Edge', dictation:'Dictation', demo:'Browser model', desmos:'Desmos' }
const toolName = computed(() => toolNames[s.value.tool] || '')
const active = ref(0)
const pipeline = ['Text', 'Tokens and position', 'Attention and networks', 'Probabilities', 'New token']
const isPipeline = computed(() => ['S77'].includes(s.value.id))
</script>

<template>
  <div class="workshop-content" :class="[`kind-${s.kind}`, { 'has-media': !!s.media, 'has-prompt': !!s.prompt, 'has-comparison': !!s.comparison?.length }]">
    <header class="workshop-heading"><h1>{{ s.title }}</h1></header>
    <p v-if="s.message" class="workshop-lead">{{ s.message }}</p>
    <div class="workshop-stage">
      <template v-if="s.kind === 'references'">
        <div class="reference-list">
          <article v-for="(r,i) in s.references || []" :key="i">
            <h2>{{ r.label }}</h2><p>{{ r.citation }}</p>
            <a v-if="r.url" class="link" :href="r.url" target="_blank" rel="noopener">{{ r.display || r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*/, '') }}</a>
          </article>
          <p v-for="(text,i) in s.body || []" :key="`body${i}`">{{ text }}</p>
        </div>
      </template>
      <template v-else-if="s.formula">
        <SoftmaxFormula /><ol class="procedure-list"><li v-for="(step,i) in s.steps" :key="i"><span class="step-number">{{ i+1 }}</span><div><h2>{{ step.title }}</h2><p>{{ step.text }}</p></div></li></ol>
      </template>
      <template v-else-if="s.diagram === 'initial' || s.diagram === 'revised'">
        <div class="map-composition"><LearningMap :revised="s.diagram==='revised'" /><p>{{ s.result || s.body?.join(' ') }}</p></div>
      </template>
      <template v-else-if="isPipeline">
        <div class="pipeline" role="group" aria-label="Conceptual generation flow, five stages">
          <button v-for="(label,i) in pipeline" :key="label" class="btn pipeline-step" :class="{ current: active === i }" :aria-pressed="active===i" @click.stop="active=i"><span>{{ i+1 }}</span><strong>{{ label }}</strong></button>
        </div>
        <p class="pipeline-caption" aria-live="polite" aria-atomic="true">{{ ['Text enters as a sequence: the model does not receive words as we read them.', 'The tokenizer assigns identifiers; representations and position prepare the sequence.', 'Within decoder blocks, each position combines the allowed context and transforms its representation.', 'Scores become probabilities over the vocabulary. Temperature changes the distribution.', 'One token is selected and added to the context; the cycle repeats.'][active] }}</p>
        <p class="pipeline-static">Text → tokens and position → decoder blocks → vocabulary probabilities → selected token. Parameters stay fixed during inference. The selected token is added to the context and the process repeats.</p>
      </template>
      <template v-else>
        <figure v-if="s.media" class="workshop-media">
          <video v-if="s.media.type==='video'" controls preload="none" :poster="asset(s.media.poster)" :aria-label="s.media.alt" @click.stop>
            <source :src="asset(s.media.src)" :type="s.media.src.endsWith('webm') ? 'video/webm' : 'video/mp4'" />
            <track kind="captions" srclang="en" label="English" :src="asset(s.media.captions)" default />
          </video>
          <img v-else :src="asset(s.media.src)" :alt="s.media.alt" :style="s.media.fit ? {objectFit:s.media.fit} : undefined" />
          <img v-if="s.media.type==='video'" class="video-print-poster" :src="asset(s.media.poster)" :alt="s.media.alt" />
          <figcaption>{{ s.media.caption }}<a v-if="s.media.source" class="link" :href="s.media.source" target="_blank" rel="noopener"> Source</a></figcaption>
        </figure>
        <div class="workshop-copy">
          <blockquote v-if="s.prompt" class="workshop-prompt"><span class="prompt-label">{{ s.promptLabel || 'Prompt to copy' }}</span><p>{{ s.prompt }}</p></blockquote>
          <div v-if="s.comparison?.length" class="comparison" :class="{three:s.comparison.length===3}">
            <section v-for="(item,i) in s.comparison" :key="i"><h2>{{ item.label }}</h2><p>{{ item.text }}</p></section>
          </div>
          <ol v-if="s.steps?.length" class="procedure-list">
            <li v-for="(step,i) in s.steps" :key="i"><span class="step-number">{{ i+1 }}</span><div><h2>{{ step.title }}</h2><p>{{ step.text }}</p></div></li>
          </ol>
          <div v-if="s.body?.length" class="workshop-body"><p v-for="(text,i) in s.body" :key="i">{{ text }}</p></div>
          <div v-if="s.result" class="workshop-result"><h2>{{ s.resultLabel || 'Result of this step' }}</h2><p>{{ s.result }}</p></div>
          <div v-if="s.links?.length" class="workshop-links"><a v-for="l in s.links" :key="l.url" class="btn" :href="asset(l.url)" target="_blank" rel="noopener">{{ l.label }}</a></div>
        </div>
      </template>
    </div>
    <p v-if="s.decision" class="workshop-decision">{{ s.decision }}</p>
    <footer class="workshop-context"><span>{{ s.stage || s.section }}</span><span v-if="toolName">{{ toolName }}<span v-if="s.plan"> · {{ s.plan }}</span></span></footer>
  </div>
</template>
