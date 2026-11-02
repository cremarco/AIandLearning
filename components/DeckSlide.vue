<script setup lang="ts">
import { computed } from 'vue'
import slides from '../data/slides.json'
import BentoCard from './BentoCard.vue'
import SourceLine from './SourceLine.vue'
import WhattadataCubes from './WhattadataCubes.vue'
import SlideAudience from './SlideAudience.vue'
import WorkshopSlide from './WorkshopSlide.vue'

const props = defineProps<{ id: string }>()
const s = computed<any>(() => slides.find(slide => slide.id === props.id))
const image = (name: string) => `${import.meta.env.BASE_URL}images/${name}`
const lead = computed(() => s.value && !['cover', 'profile', 'agenda'].includes(s.value.type) ? s.value.message : '')
const cards = computed(() => s.value && 'cards' in s.value ? s.value.cards : [])
const slideProgress = computed(() => ({
  value: s.value?.number || 1,
  max: slides.length,
  label: 'Progress through all slides',
  text: `Slide ${s.value?.number} of ${slides.length}`,
}))
const eventNames: Record<string, string> = { S48:'Forum', S49:'University', S50:'Teachers' }
const agendaItems = slides.filter(slide => slide.type === 'brief')
  .map(slide => ({ title:eventNames[slide.id] || slide.title,
    timing:slide.message.split(' · ')[0], detail:slide.title }))
  .sort((a, b) => Number(a.timing.split(' ')[0]) - Number(b.timing.split(' ')[0]))
  .map((item, index) => ({ ...item, number:String(index + 1).padStart(2, '0') }))
</script>

<template>
  <main v-if="s" class="deck-slide" :class="[`type-${s.type}`, `slide-${s.id}`, s.tool ? `tool-${s.tool}` : '']" :data-slide-id="s.id">
    <SlideAudience :audience="s.audience" />
    <template v-if="s.type === 'cover'">
      <div class="cover-copy">
        <h1 class="cover-title">Beyond<br /><span>prompting</span></h1>
        <p class="cover-subtitle">{{ s.message }}</p>
        <p class="cover-author">Marco Cremaschi<br /><span>University of Milano-Bicocca · Whattadata</span></p>
        <p class="cover-meta">Vilnius · November 2026</p>
      </div>
    </template>

    <template v-else-if="s.type === 'workshop'">
      <WorkshopSlide :slide="s" />
      <SourceLine :ids="s.sources.filter((id: string) => id !== 'BIO02').slice(0, 3)" />
    </template>

    <template v-else>
      <WhattadataCubes v-if="s.type === 'company'" />
      <header class="slide-heading" :class="{ 'company-heading': s.type === 'company' }">
        <h1>{{ s.title }}</h1>
        <img v-if="s.type === 'company'" class="company-logo" :src="image('whattadata.svg')" alt="Logo Whattadata" />
      </header>
      <p v-if="s.type === 'brief'" class="lead">
        <strong>{{ s.message.split(' · ')[0] }}</strong> · {{ s.message.split(' · ').slice(1).join(' · ') }}
      </p>
      <p v-else-if="lead" class="lead">{{ lead }}</p>

      <template v-if="s.type === 'profile'">
        <div class="profile-grid">
          <div class="profile-copy">
            <p class="profile-role">{{ s.message }}</p>
            <p class="profile-affiliation">{{ s.body[0] }}</p>
            <div class="profile-universities flex items-center gap-8" role="group" aria-label="Universities">
              <img class="profile-university-logo profile-university-logo--bicocca" :src="image('universities/milano-bicocca.png')" alt="Universities degli Studi di Milano-Bicocca" width="96" height="96" />
              <img class="profile-university-logo" :src="image('universities/bergamo.png')" alt="Universities degli Studi di Bergamo" width="96" height="96" />
              <img class="profile-university-logo profile-university-logo--cattolica" :src="image('universities/cattolica.png')" alt="Universities Cattolica del Sacro Cuore" width="96" height="96" />
            </div>
            <ul class="profile-research"><li v-for="area in s.body.slice(1)" :key="area">{{ area }}</li></ul>
          </div>
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
        <div class="agenda-route grid md:grid-cols-3">
          <section v-for="chapter in agendaItems" :key="chapter.title" class="agenda-step">
            <span class="agenda-step-meta"><span>{{ chapter.number }}</span><span>{{ chapter.timing }}</span></span>
            <strong>{{ chapter.title }}</strong>
            <span class="agenda-step-detail">{{ chapter.detail }}</span>
          </section>
        </div>
        <p class="agenda-access">November 2026 · Audiences, activities and outcomes · Original programmes</p>
      </template>

      <template v-else>
        <div class="bento-grid" :class="{ three: cards.length === 3 }">
          <BentoCard v-for="(card, i) in cards" :key="i" v-bind="card" />
        </div>
      </template>

      <p v-if="s.takeaway" class="takeaway">{{ s.takeaway }}</p>
      <SourceLine :ids="s.sources.filter((id: string) => id !== 'BIO02').slice(0, 3)" />
    </template>
    <span class="slide-page" :aria-label="`Slide ${s.number} of ${slides.length}`">{{ s.number }} / {{ slides.length }}</span>
    <progress class="progress progress-accent slide-progress" :value="slideProgress.value" :max="slideProgress.max" :aria-label="slideProgress.label" :aria-valuetext="slideProgress.text" />
  </main>
</template>
