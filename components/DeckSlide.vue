<script setup lang="ts">
import { computed } from 'vue'
import slides from '../data/slides.json'
import { useDeckFlow } from '../data/flow'
import BentoCard from './BentoCard.vue'
import ActivityTimer from './ActivityTimer.vue'
import FlowPicker from './FlowPicker.vue'
import SourceLine from './SourceLine.vue'
import DeckIcon from './DeckIcon.vue'
import WhattadataCubes from './WhattadataCubes.vue'

const props = defineProps<{ id: string }>()
const s = computed<any>(() => slides.find(slide => slide.id === props.id))
const flow = useDeckFlow()
const slideProgress = computed(() => {
  const selected = flow.nav.isPrintMode.value ? undefined : flow.selected.value
  // Reference cards are a detour from S33, so they keep the activity's position.
  const reference = s.value?.type === 'evidence_card'
  const index = selected?.slideIds.indexOf(reference ? 'S33' : props.id) ?? -1
  const value = index >= 0 ? index + 1 : s.value.number
  const max = index >= 0 ? selected!.slideIds.length : slides.length
  return {
    value, max,
    label: index >= 0 ? `${selected!.name} route progress` : 'All slides progress',
    text: `${reference && index >= 0 ? 'Study reference; activity position: ' : 'Slide '}${value} of ${max}`,
  }
})
const base = import.meta.env.BASE_URL
const image = (name: string) => `${base}images/${name}`
const file = (name: string) => `${base}materials/${name}`
const minutes = computed(() => s.value.duration[flow.selected.value?.id || 'forum'])
const lead = computed(() => s.value.type === 'study' ? s.value.finding
  : ['cover', 'profile', 'agenda', 'discussion', 'evidence_card'].includes(s.value.type) ? ''
  : s.value.explanation || s.value.message)
const cards = computed(() => s.value.cards || s.value.body.map((body: string, i: number) => ({
  title: body,
  image: ['learning.png', 'visual-maps.png', 'evidence.png', 'inclusion.png'][i % 4],
})))
const chapters = [
  { title: 'Learning decisions and evidence', section: 'evidence', image: 'evidence.png', number: '01' },
  { title: 'Visual guidance', section: 'visual_guidance', image: 'visual-maps.png', number: '02' },
  { title: 'Risks and inclusive access', section: 'responsible_practice', image: 'inclusion.png', number: '03' },
  { title: 'Designing a learning activity', section: 'practice', image: 'learning.png', number: '04' },
]
function openChapter(index: number) {
  const starts = [['S06', 'S09'], ['S16', 'S17'], ['S21', 'S23'], ['S31']][index]
  const page = flow.path.value.find(n => starts.includes(slides[n - 1]?.id))
  if (page) flow.go(page)
}
const dataset = [
  { id: 'S41', title: 'School mathematics', label: 'Bastani et al. · 2025' },
  { id: 'S42', title: 'Physics tutor', label: 'Kestin et al. · 2025' },
  { id: 'S43', title: 'Writing and transfer', label: 'Fan et al. · 2025' },
]
</script>

<template>
  <main v-if="s" class="deck-slide" :class="[`type-${s.type}`, `slide-${s.id}`]" :data-slide-id="s.id">
    <template v-if="s.type === 'cover'">
      <div class="cover-copy">
        <h1 class="cover-title">Beyond<br /><span>prompting</span></h1>
        <p class="cover-subtitle">{{ s.message }}</p>
        <p class="cover-author">Marco Cremaschi<br /><span>University of Milano-Bicocca · Whattadata</span></p>
        <FlowPicker />
        <p class="cover-meta">Vilnius · November 2026</p>
      </div>
    </template>

    <template v-else>
      <WhattadataCubes v-if="s.type === 'company'" />
      <header class="slide-heading" :class="{ 'company-heading': s.type === 'company' }">
        <h1>{{ s.title }}</h1>
        <img v-if="s.type === 'company'" class="company-logo" :src="image('whattadata.svg')" alt="Whattadata logo" />
      </header>
      <p v-if="lead" class="lead">{{ lead }}</p>

      <template v-if="s.type === 'profile'">
        <div class="profile-grid">
          <div class="profile-copy">
            <p class="profile-role">{{ s.message }}</p>
            <p class="profile-affiliation">{{ s.body[0] }}</p>
            <ul class="profile-research"><li v-for="area in s.body.slice(1)" :key="area">{{ area }}</li></ul>
          </div>
          <img class="profile-art" :src="image('marco-cremaschi.webp')" alt="Portrait of Marco Cremaschi, from his personal website" />
        </div>
      </template>

      <template v-else-if="s.type === 'company'">
        <div class="company-pillars">
          <section v-for="card in cards" :key="card.title" class="company-pillar">
            <h2>{{ card.title }}</h2>
            <p>{{ card.body }}</p>
          </section>
        </div>
      </template>

      <template v-else-if="s.type === 'agenda'">
        <p class="lead">{{ flow.selected.value?.focus || 'Choose an event on the opening slide, or explore the complete deck' }}</p>
        <div class="bento-grid agenda-bento">
          <button v-for="(chapter, i) in chapters" :key="chapter.title" class="agenda-button" :aria-label="`Open chapter: ${chapter.title}`" @click.stop="openChapter(i)">
            <BentoCard :title="chapter.title" :label="chapter.number" :image="chapter.image"><DeckIcon class="agenda-arrow" name="arrow-up-right" :size="26" /></BentoCard>
          </button>
        </div>
        <p class="agenda-access">Paper or digital text · no account required · access supports stay available</p>
      </template>

      <template v-else-if="s.type === 'study'">
        <div class="evidence-grid">
          <BentoCard title="" image="evidence.png" span="tall" label="Observed in this study">
            <div v-for="result in s.results" :key="result.label" class="study-stat">
              <strong class="study-number">{{ result.value }}</strong>
              <span>{{ result.label }}</span>
            </div>
            <p v-if="s.result_note" class="study-note">{{ s.result_note }}</p>
          </BentoCard>
          <BentoCard title="Study" :body="s.context" image="learning.png" />
          <BentoCard title="Limit" :body="s.limit" image="responsibility.png" />
        </div>
      </template>

      <template v-else-if="s.type === 'activity'">
        <div v-if="s.id === 'S18'" class="linear-map argument-example" role="group" aria-label="Intentionally unsupported chain: fast answers imply understanding, which implies independence">
          <template v-for="(node, index) in s.body" :key="node">
            <div class="map-node"><strong>{{ node }}</strong></div>
            <span v-if="index < s.body.length - 1" class="map-arrow" aria-hidden="true">→</span>
          </template>
        </div>
        <div v-else-if="s.id === 'S34'" class="bento-grid three canvas-grid">
          <BentoCard v-for="(card, index) in cards" :key="index" v-bind="card" />
        </div>
        <div v-else class="activity-layout">
          <div class="activity-steps">
            <div v-if="s.id === 'S26'" class="map-audit">
              <p aria-hidden="true"><strong>Visual:</strong> Fast answers → Understanding → Independence</p>
              <p><strong>Text:</strong> The chain assumes that fast answers lead to understanding, which then leads to independence.</p>
              <a class="material-link" :href="file('activity-packet.txt')" target="_blank" rel="noopener">Activity 2: inspect and repair the argument</a>
            </div>
            <blockquote v-if="s.quote" class="prompt-block">“{{ s.quote }}”</blockquote>
            <ol>
              <li v-for="line in s.body" :key="line">{{ line }}</li>
            </ol>
            <div v-if="s.id === 'S33'" class="evidence-buttons">
              <button v-for="card in dataset" :key="card.id" class="btn btn-sm" @click.stop="flow.goId(card.id)">{{ card.title }} <DeckIcon name="arrow-up-right" :size="16" /></button>
              <a class="material-link" :href="file('Evidence_Cards_EN.txt')" target="_blank" rel="noopener">Printable study cards <DeckIcon name="arrow-up-right" :size="16" /></a>
            </div>
            <p v-if="s.takeaway" class="takeaway">{{ s.takeaway }}</p>
          </div>
          <aside class="activity-output">
            <h2>Your output</h2>
            <p>{{ s.output }}</p>
            <ActivityTimer :minutes="minutes || 2" />
          </aside>
        </div>
        <div v-if="['S18', 'S34'].includes(s.id)" class="activity-footer">
          <p>{{ s.output }}</p><ActivityTimer class="timer-compact" :minutes="minutes || 2" />
        </div>
      </template>

      <template v-else-if="s.type === 'template'">
        <div class="bento-grid three canvas-grid">
          <BentoCard v-for="(card, index) in cards" :key="index" v-bind="card" :label="String(index + 1).padStart(2, '0')" />
        </div>
      </template>

      <template v-else-if="s.id === 'S30'">
        <p class="lead">{{ s.supplied }}</p>
        <div class="comparison-grid demo-grid">
          <BentoCard title="Prompt" :body="s.prompt" image="learning.png" />
          <BentoCard title="Illustrative response" :body="s.response" label="Prepared example · not a live result" image="evidence.png" />
        </div>
      </template>

      <template v-else-if="s.type === 'case'">
        <div class="bento-grid asymmetric case-grid">
          <BentoCard title="A useful answer can still be wrong" image="inclusion.png" label="Blind people’s experiences with generative AI" :body="s.body[0]" />
          <BentoCard title="The invented detail" image="evidence.png" :body="s.body[1]" />
          <BentoCard title="The design question" image="responsibility.png" body="What route lets the person check the description?" />
        </div>
      </template>

      <template v-else-if="s.type === 'summary'">
        <div class="bento-grid three summary-bento">
          <BentoCard v-for="(card, i) in cards" :key="i" v-bind="card" />
        </div>
        <nav class="resource-links resource-row" aria-label="Workshop resources">
          <a href="https://docs.google.com/document/d/1bga8afM8CtVytu2HqBHhL73TU8YoV4IkxsyA7AZa4cY/edit" target="_blank" rel="noopener">Research dossier <DeckIcon name="arrow-up-right" /></a>
          <a :href="file('activity-packet.txt')" target="_blank" rel="noopener">Classroom packet <DeckIcon name="arrow-up-right" /></a>
          <a :href="file('Prompt_Bank_EN.txt')" target="_blank" rel="noopener">Prompt bank <DeckIcon name="arrow-up-right" /></a>
          <a :href="file('Accessible_Deck_EN.txt')" target="_blank" rel="noopener">Accessible text <DeckIcon name="arrow-up-right" /></a>
        </nav>
      </template>

      <template v-else-if="s.type === 'discussion'">
        <p class="closing-question">{{ s.message }}</p>
        <div class="discussion-prompts"><span v-for="line in s.body" :key="line">{{ line }}</span></div>
        <p class="discussion-name">Marco Cremaschi · University of Milano-Bicocca · Whattadata</p>
      </template>

      <template v-else-if="s.type === 'evidence_card'">
        <div class="bento-grid evidence-card-grid">
          <BentoCard v-for="(line, i) in s.body" :key="line" :title="['Design','Participants and task','Finding','Limit'][i]" :body="line" :image="['evidence.png','learning.png','visual-maps.png','responsibility.png'][i]" />
        </div>
        <button class="btn return-button" @click.stop="flow.goId('S33')"><DeckIcon name="arrow-left" /> Return to the activity</button>
      </template>

      <template v-else>
        <div class="bento-grid" :class="{ three: cards.length === 3 }">
          <BentoCard v-for="(card, i) in cards" :key="i" v-bind="card" />
        </div>
      </template>

      <p v-if="s.takeaway && s.type !== 'activity'" class="takeaway">{{ s.takeaway }}</p>
      <SourceLine :ids="s.sources.filter((id: string) => id !== 'BIO02').slice(0, 3)" :note="s.type === 'activity' || s.type === 'template' ? 'Original workshop activity, informed by' : undefined" />
    </template>
    <span class="slide-page" :aria-label="`Slide ${s.number} of ${slides.length}`">{{ s.number }} / {{ slides.length }}</span>
    <progress class="progress progress-accent slide-progress" :value="slideProgress.value" :max="slideProgress.max" :aria-label="slideProgress.label" :aria-valuetext="slideProgress.text" />
  </main>
</template>
