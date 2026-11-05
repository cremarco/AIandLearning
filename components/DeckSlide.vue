<script setup lang="ts">
import { computed, provide } from 'vue'
import { getSlide, slides } from '../utils/deck'
import { imageUrl as image } from '../utils/assets'
import highlights from '../data/content/highlights.json'
import { EMPHASIS_TERMS_KEY, type EmphasisTerm } from '../utils/emphasis'
import EmphasisText from './shared/EmphasisText.vue'
import BentoCard from './shared/BentoCard.vue'
import SourceLine from './shared/SourceLine.vue'
import WhattadataCubes from './media/WhattadataCubes.vue'
import SlideAudience from './shared/SlideAudience.vue'
import CoverBackground from './media/CoverBackground.vue'
import WorkshopSlide from './slides/WorkshopSlide.vue'

const props = defineProps<{ id: string }>()
provide(EMPHASIS_TERMS_KEY, computed(() => (highlights as Record<string, EmphasisTerm[]>)[props.id] || []))
const s = computed(() => getSlide(props.id))
const lead = computed(() => s.value && !['cover', 'profile'].includes(s.value.type) ? s.value.message : '')
const cards = computed(() => s.value?.cards || [])
const sourceIds = computed(() => s.value?.sources.filter(id => id !== 'BIO02').slice(0, 3) || [])
const bentoCards = computed(() => {
  const slide = s.value
  if (slide?.type !== 'brief' || cards.value.length !== 3) return cards.value
  return [cards.value[1], cards.value[0], cards.value[2]].map((card, index) => ({
    ...card,
    backgroundImage: index === 0 && slide.cardBackground ? image(slide.cardBackground) : undefined,
  }))
})
const slideProgress = computed(() => ({
  value: s.value?.number || 1,
  max: slides.length,
  label: 'Progress through all slides',
  text: `Slide ${s.value?.number} of ${slides.length}`,
}))
</script>

<template>
  <main v-if="s" class="deck-slide" :class="[`type-${s.type}`, `slide-${s.id}`, s.tool ? `tool-${s.tool}` : '']" :data-slide-id="s.id" :aria-label="s.kind === 'shortcut-cloud' ? s.title : undefined">
    <SlideAudience v-if="s.type !== 'cover' && s.kind !== 'thanks' && s.kind !== 'shortcut-cloud'" :audience="s.audience" />
    <span v-if="s.todo" class="badge badge-warning absolute left-16 top-4 z-10 h-7 gap-2 text-sm font-medium" role="note">
      <strong>TODO</strong>{{ s.todo }}
    </span>
    <template v-if="s.type === 'cover'">
      <CoverBackground />
      <img class="cover-university-logo" :src="image('universities/milano-bicocca.png')" alt="Università degli Studi di Milano-Bicocca" />
      <div class="cover-copy">
        <h1 class="cover-title">Beyond<br /><span>prompting</span></h1>
        <p class="cover-subtitle"><EmphasisText :text="s.message" /></p>
        <p class="cover-author">Marco Cremaschi<br /><span>University of Milano-Bicocca · Whattadata</span><br /><a class="link link-hover cover-email" href="mailto:marco.cremaschi@unimib.it">marco.cremaschi@unimib.it</a></p>
      </div>
    </template>

    <template v-else-if="s.kind === 'thanks'">
      <CoverBackground />
      <div class="cover-copy thank-you-copy">
        <h1 class="thank-you-title">{{ s.title }}</h1>
        <p class="cover-author">{{ s.message }}<br /><span>{{ s.body[0] }}</span><br /><a v-for="link in s.links" :key="link.url" class="link link-hover cover-email" :href="link.url">{{ link.label }}</a></p>
      </div>
    </template>

    <template v-else-if="s.type === 'workshop'">
      <WorkshopSlide :slide="s" />
      <SourceLine v-if="!['bibliography', 'web-resources', 'shortcut-cloud'].includes(s.kind)" :ids="sourceIds" />
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
      <p v-else-if="lead" class="lead"><EmphasisText :text="lead" /></p>

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
            <ul class="profile-research"><li v-for="area in s.body.slice(1)" :key="area"><EmphasisText :text="area" /></li></ul>
          </div>
        </div>
      </template>

      <template v-else-if="s.type === 'company'">
        <div class="company-pillars">
          <section v-for="card in cards" :key="card.title" class="company-pillar">
            <h2>{{ card.title }}</h2>
            <p><EmphasisText :text="card.body" /></p>
          </section>
        </div>
      </template>

      <template v-else>
        <div class="bento-grid" :class="{ three: bentoCards.length === 3 }">
          <BentoCard v-for="(card, i) in bentoCards" :key="card.title" v-bind="card" :tone="i === 0 ? 'paper' : i === 2 ? 'accent' : 'surface'" />
        </div>
      </template>

      <p v-if="s.takeaway" class="takeaway"><EmphasisText :text="s.takeaway" /></p>
      <SourceLine :ids="sourceIds" />
    </template>
    <span v-if="s.kind !== 'shortcut-cloud'" class="slide-page" :aria-label="`Slide ${s.number} of ${slides.length}`">{{ s.number }} / {{ slides.length }}</span>
    <progress v-if="s.kind !== 'shortcut-cloud'" class="progress slide-progress h-1 rounded-none" :class="s.type === 'company' ? 'progress-accent' : 'text-base-content/60'" :value="slideProgress.value" :max="slideProgress.max" :aria-label="slideProgress.label" :aria-valuetext="slideProgress.text" />
  </main>
</template>
