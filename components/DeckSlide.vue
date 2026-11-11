<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { getSlide, presentationSlideCount, type StudyFocus } from '../utils/deck'
import { assetUrl, imageUrl as image } from '../utils/assets'
import highlights from '#deck/highlights'
import { EMPHASIS_TERMS_KEY, type EmphasisTerm } from '../utils/emphasis'
import EmphasisText from './shared/EmphasisText.vue'
import BentoCard from './shared/BentoCard.vue'
import SourceLine from './shared/SourceLine.vue'
import WhattadataCubes from './media/WhattadataCubes.vue'
import SlideAudience from './shared/SlideAudience.vue'
import StudyPhaseRibbon from './shared/StudyPhaseRibbon.vue'
import CoverBackground from './media/CoverBackground.vue'
import WorkshopSlide from './slides/WorkshopSlide.vue'
import MruLanguageSelector from './shared/MruLanguageSelector.vue'
import { supportsLanguageSwitch, t, localizeContent, slideCountText } from '../utils/language'

const props = defineProps<{ id: string }>()
provide(EMPHASIS_TERMS_KEY, computed(() => localizeContent((highlights as Record<string, EmphasisTerm[]>)[props.id] || [])))
const s = computed(() => getSlide(props.id))
const selectedStudyPhases = ref<StudyFocus>()
watch(() => props.id, () => { selectedStudyPhases.value = undefined })
const studyPhases = computed(() => selectedStudyPhases.value || s.value?.studyPhases)
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
  max: presentationSlideCount,
  label: t('Progress through the presentation'),
  text: slideCountText(s.value?.number || 1, presentationSlideCount),
}))
</script>

<template>
  <main v-if="s" class="deck-slide" :class="[`type-${s.type}`, `slide-${s.id}`, s.tool ? `tool-${s.tool}` : '', { 'has-study-phases': !!studyPhases }]" :data-slide-id="s.id" :aria-label="s.kind === 'shortcut-cloud' ? s.title : undefined">
    <StudyPhaseRibbon v-if="studyPhases && s.kind !== 'shortcut-cloud'" v-bind="studyPhases" />
    <SlideAudience v-if="!['cover', 'profile', 'company'].includes(s.type) && !['S48', 'S49', 'S50QR', 'S99'].includes(s.id) && !['thanks', 'shortcut-cloud', 'tool-divider'].includes(s.kind)" :audience="s.audience" />
    <span v-if="s.todo" class="badge badge-warning absolute left-16 top-4 z-10 h-7 gap-2 text-sm font-medium" role="note">
      <strong>TODO</strong>{{ s.todo }}
    </span>
    <template v-if="s.type === 'cover'">
      <CoverBackground />
      <MruLanguageSelector v-if="supportsLanguageSwitch" />
      <img class="cover-university-logo" :src="image('universities/milano-bicocca.png')" alt="Università degli Studi di Milano-Bicocca" />
      <svg v-if="s.coverOrganisationLogo" class="cover-organisation-logo" viewBox="0 0 300 166" role="img" :aria-label="s.coverOrganisationLogo.alt">
        <defs>
          <clipPath :id="`${s.id}-organisation-symbol`"><rect width="120" height="115" /></clipPath>
          <clipPath :id="`${s.id}-organisation-text`"><path d="M120 0H300V166H0V115H120Z" /></clipPath>
        </defs>
        <image :href="assetUrl(s.coverOrganisationLogo.src)" width="300" height="166" :clip-path="`url(#${s.id}-organisation-symbol)`" aria-hidden="true" />
        <image class="cover-organisation-wordmark" :href="assetUrl(s.coverOrganisationLogo.src)" width="300" height="166" :clip-path="`url(#${s.id}-organisation-text)`" aria-hidden="true" />
      </svg>
      <img v-if="s.coverEventLogo" class="cover-event-logo" :src="assetUrl(s.coverEventLogo.src)" :alt="s.coverEventLogo.alt" width="615" height="410" />
      <div class="cover-copy" :class="{ 'cover-copy-long': s.title.length > 50 }">
        <h1 v-if="s.title.length > 50" class="cover-title">{{ s.title }}</h1>
        <h1 v-else class="cover-title">{{ t('Beyond') }}<br /><span>{{ t('prompting') }}</span></h1>
        <p class="cover-subtitle"><EmphasisText :text="s.message" /></p>
        <p class="cover-author">Marco Cremaschi<br /><span>{{ t('University of Milano-Bicocca · Whattadata') }}</span><br /><a class="link link-hover cover-email" href="mailto:marco.cremaschi@unimib.it">marco.cremaschi@unimib.it</a></p>
      </div>
      <p v-if="s.coverDate" class="cover-date">{{ s.coverDate }}</p>
      <aside v-if="s.coverNotice" class="card card-border cover-practice-note" role="note" :aria-label="s.coverNotice.title">
        <div class="card-body">
          <h2 class="card-title">{{ s.coverNotice.title }}</h2>
          <p>{{ s.coverNotice.text }}</p>
        </div>
      </aside>
    </template>

    <template v-else-if="s.kind === 'thanks'">
      <img v-if="s.media" class="absolute right-16 top-[50px] h-[620px] w-[540px] object-contain" :src="assetUrl(s.media.src)" :alt="s.media.alt" />
      <div class="cover-copy thank-you-copy">
        <h1 class="thank-you-title">{{ s.title }}</h1>
        <p class="cover-author">{{ s.message }}<br /><span>{{ s.body[0] }}</span><br /><a v-for="link in s.links" :key="link.url" class="link link-hover cover-email" :href="link.url">{{ link.label }}</a></p>
      </div>
    </template>

    <template v-else-if="s.type === 'workshop'">
      <WorkshopSlide :slide="s" @study-phase-change="selectedStudyPhases = $event" />
      <SourceLine v-if="!['S97', 'S97STUDY', 'S97P', 'S97ACCESS'].includes(s.id) && !['bibliography', 'web-resources', 'shortcut-cloud'].includes(s.kind)" :ids="sourceIds" />
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
    <span v-if="s.kind !== 'shortcut-cloud' && s.number <= presentationSlideCount" class="slide-page" :aria-label="slideCountText(s.number, presentationSlideCount)">{{ s.number }} / {{ presentationSlideCount }}</span>
    <progress v-if="s.kind !== 'shortcut-cloud' && s.number <= presentationSlideCount" class="progress slide-progress h-1 rounded-none" :class="s.type === 'company' ? 'progress-accent' : 'text-base-content/60'" :value="slideProgress.value" :max="slideProgress.max" :aria-label="slideProgress.label" :aria-valuetext="slideProgress.text" />
  </main>
</template>
