<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useSlideVideo } from '../../composables/useSlideVideo'
import { assetUrl } from '../../utils/assets'
import { notebookOutputs } from '../../utils/notebook-outputs'

const props = defineProps<{ outputId: string }>()
const output = computed(() => notebookOutputs[props.outputId])
const index = ref(0)
const revealed = ref(false)
const selected = ref<number>()
const hintVisible = ref(false)
const zoomed = ref(false)
const showEvidence = ref(false)
const imageError = ref(false)
const mediaError = ref(false)
const audio = ref<HTMLAudioElement>()
const video = ref<HTMLVideoElement>()
const questionContent = ref<HTMLElement>()
useSlideVideo(audio)
useSlideVideo(video)
const question = computed(() => output.value.questions?.[index.value])
const card = computed(() => output.value.cards?.[index.value])
const count = computed(() => output.value.pages?.length || output.value.cards?.length || output.value.questions?.length || 1)
const image = computed(() => output.value.preview || output.value.pages?.[index.value] || output.value.src)
const downloadable = computed(() => ['audio','video','flashcards','table'].includes(output.value.type) || output.value.src.endsWith('.csv'))
const downloadLabel = computed(() => output.value.preview && output.value.src.endsWith('.csv') ? 'Download table (CSV)' : ({ pdf: 'Open PDF', image: 'Open image', quiz: 'Open questions and solutions', flashcards: 'Download cards (CSV)', table: 'Download table (CSV)', audio: 'Download audio', video: 'Download video' }[output.value.type]))
const localViewer = computed(() => ['quiz', 'flashcards', 'table'].includes(output.value.type))
const imageViewer = computed(() => ['pdf', 'image'].includes(output.value.type))
function resetItem() {
  revealed.value = false
  selected.value = undefined
  hintVisible.value = false
  zoomed.value = false
  imageError.value = false
}
watch(() => props.outputId, () => { index.value = 0; mediaError.value = false; showEvidence.value = false; resetItem() })
watch(index, () => { resetItem(); if (questionContent.value) questionContent.value.scrollTop = 0 })
watch(revealed, async shown => {
  await nextTick()
  if (questionContent.value) questionContent.value.scrollTop = shown ? questionContent.value.scrollHeight : 0
})
function move(offset: number) { index.value = Math.max(0, Math.min(count.value - 1, index.value + offset)) }
function onKey(event: KeyboardEvent) {
  // Keep slide navigation keys available outside this focused output.
  if (event.target instanceof HTMLElement && event.target.matches('audio,video')) return
  if (['ArrowRight', 'ArrowLeft'].includes(event.key) && count.value > 1) {
    event.preventDefault()
    move(event.key === 'ArrowRight' ? 1 : -1)
  }
}
</script>

<template>
  <section v-if="output" class="notebook-output" :aria-label="`${output.feature} generated output`" @click.stop @pointerdown.stop @keydown.stop="onKey" @keyup.stop>
    <aside class="nb-sidebar">
      <div>
        <h2>{{ output.feature }}</h2>
        <p class="nb-origin">Created in NotebookLM</p>
      </div>
      <div class="nb-request">
        <h3>{{ output.prompt ? 'Prompt' : 'About this output' }}</h3>
        <p>{{ output.prompt || output.description }}</p>
      </div>
      <p v-if="localViewer" class="nb-format">Local viewer · original NotebookLM content</p>
      <p v-else-if="outputId === 'mind-map'" class="nb-format">Complete static map · zoom to read the branches</p>
      <p v-else-if="outputId === 'table' && output.preview" class="nb-format">Screenshot of the generated table</p>
      <a class="link" :href="assetUrl(output.src)" :download="downloadable ? '' : undefined" :target="downloadable ? undefined : '_blank'" rel="noopener">{{ downloadLabel }}</a>
    </aside>

    <div class="nb-viewer" :class="`nb-${output.type}`">
      <div v-if="imageViewer" class="nb-image-scroll" :class="{ 'is-zoomed': zoomed }" tabindex="0" :aria-label="`${output.feature}, ${output.type === 'pdf' ? `page ${index + 1}` : 'image'}`">
        <p v-if="imageError" role="alert">This preview could not load. Use the original file link.</p>
        <img v-else :key="image" :src="assetUrl(image)" :alt="`${output.feature} generated from Andrea’s textbook${output.type === 'pdf' ? `, page ${index + 1}` : ''}`" @error="imageError = true" />
      </div>

      <div v-else-if="output.type === 'audio'" class="nb-audio-content">
        <h3>How generative AI predicts next tokens</h3>
        <p>Listen to the generated episode.</p>
        <audio ref="audio" controls preload="metadata" aria-label="Generated NotebookLM Audio Overview" @error="mediaError = true">
          <source :src="assetUrl(output.src)" type="audio/mp4" />
        </audio>
        <p v-if="mediaError" role="alert">Audio could not load. Try the download link.</p>
      </div>

      <div v-else-if="output.type === 'video'" class="nb-video-content">
        <video ref="video" controls playsinline preload="none" :poster="assetUrl(output.poster)" aria-label="Generated NotebookLM Video Overview" @error="mediaError = true">
          <source :src="assetUrl(output.src)" type="video/mp4" />
          <track v-if="output.captions" kind="captions" srclang="en" label="English" :src="assetUrl(output.captions)" />
        </video>
        <img class="nb-print-poster" :src="assetUrl(output.poster)" alt="Generated NotebookLM Video Overview" />
        <p v-if="mediaError" role="alert">Video could not load. Try the download link.</p>
      </div>

      <div v-else-if="output.type === 'flashcards' && card" class="nb-card-content" aria-live="polite">
        <h3>{{ card.question }}</h3>
        <p v-if="revealed" class="nb-card-answer">{{ card.answer }}</p>
        <p v-else class="nb-card-instruction">Answer from memory, then show the answer.</p>
      </div>

      <div v-else-if="output.type === 'quiz' && question" ref="questionContent" class="nb-quiz-content">
        <h3>{{ question.question }}</h3>
        <div class="nb-options" role="group" aria-label="Answer choices">
          <button v-for="(option, i) in question.options" :key="i" class="btn nb-option" type="button" :aria-pressed="selected === i" :data-selected="selected === i" :data-correct="revealed && i === question.correctIndex" @click="selected = i; revealed = false">
            <strong>{{ String.fromCharCode(65 + i) }}.</strong><span>{{ option }}</span>
          </button>
        </div>
        <p v-if="hintVisible" class="nb-hint" role="status">{{ question.hint }}</p>
        <section v-if="revealed" class="nb-feedback" aria-live="polite">
          <h4>Correct answer: {{ String.fromCharCode(65 + question.correctIndex) }}</h4>
          <p>{{ question.explanations[question.correctIndex] }}</p>
          <p v-if="selected !== undefined && selected !== question.correctIndex"><strong>Your choice: {{ String.fromCharCode(65 + selected) }}.</strong> {{ question.explanations[selected] }}</p>
        </section>
      </div>

      <div v-else-if="output.type === 'table'" class="nb-table-scroll" tabindex="0" aria-label="Generated comparison table">
        <table class="table">
          <thead><tr><th v-for="(header, i) in output.headers?.slice(0, showEvidence ? undefined : 3)" :key="i" scope="col">{{ header }}</th></tr></thead>
          <tbody><tr v-for="(row, i) in output.rows" :key="i"><template v-for="(cell, col) in row.slice(0, showEvidence ? undefined : 3)" :key="col"><th v-if="col === 0" scope="row">{{ cell }}</th><td v-else>{{ cell }}</td></template></tr></tbody>
        </table>
      </div>

      <nav v-if="count > 1 || imageViewer || localViewer" class="nb-controls flex flex-wrap items-center" :aria-label="`${output.feature} controls`">
        <template v-if="count > 1">
          <button class="btn btn-sm" type="button" :disabled="index === 0" @click="move(-1)">Previous</button>
          <span class="nb-position" role="status">{{ output.type === 'pdf' ? 'Page' : output.type === 'quiz' ? 'Question' : 'Card' }} {{ index + 1 }} of {{ count }}</span>
          <button class="btn btn-sm" type="button" :disabled="index === count - 1" @click="move(1)">Next</button>
        </template>
        <button v-if="imageViewer" class="btn btn-sm" type="button" :aria-pressed="zoomed" @click="zoomed = !zoomed">{{ zoomed ? 'Fit output' : 'Zoom in' }}</button>
        <button v-if="output.type === 'flashcards' || output.type === 'quiz'" class="btn btn-sm" type="button" :aria-expanded="revealed" @click="revealed = !revealed">{{ revealed ? 'Hide answer' : 'Show answer' }}</button>
        <button v-if="output.type === 'quiz'" class="btn btn-sm" type="button" :aria-expanded="hintVisible" @click="hintVisible = !hintVisible">{{ hintVisible ? 'Hide hint' : 'Show hint' }}</button>
        <button v-if="output.type === 'table'" class="btn btn-sm" type="button" :aria-expanded="showEvidence" @click="showEvidence = !showEvidence">{{ showEvidence ? 'Show key columns' : 'Show evidence and errors' }}</button>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.notebook-output { display:grid; grid-template-columns:264px minmax(0,1fr); width:100%; min-height:0; height:100%; gap:32px; color:var(--deck-ink); }
.nb-sidebar { display:flex; flex-direction:column; gap:24px; min-width:0; align-self:center; }
.notebook-output .nb-sidebar h2 { font-size:32px; line-height:1.1; }
.notebook-output .nb-origin { margin-top:8px; font-size:18px; color:var(--deck-muted); }
.notebook-output .nb-request h3 { font-size:18px; margin-bottom:8px; }
.notebook-output .nb-request p { font-size:19px; line-height:1.4; }
.notebook-output .nb-format { font-size:16px; line-height:1.35; color:var(--deck-muted); }
.nb-sidebar .link { color:var(--deck-link); font-size:18px; text-underline-offset:4px; }
.nb-viewer { min-width:0; min-height:0; height:100%; display:flex; flex-direction:column; gap:16px; }
.nb-image-scroll,.nb-card-content,.nb-quiz-content,.nb-table-scroll { min-height:0; flex:1; overflow:auto; scrollbar-color:var(--deck-control-line) var(--deck-paper); }
.nb-image-scroll { background:var(--color-white); text-align:center; }
.nb-image-scroll img { display:block; width:100%; height:100%; object-fit:contain; margin:auto; }
.nb-image-scroll.is-zoomed img { width:150%; height:auto; max-width:none; max-height:none; margin:0; }
.nb-controls { flex-shrink:0; gap:10px; padding-top:12px; border-top:1px solid var(--deck-line); }
.nb-controls .btn { height:38px; min-height:38px; padding-inline:12px; font-size:16px; }
.nb-position { font-size:17px; font-variant-numeric:tabular-nums; margin-inline:4px; }
.nb-audio-content,.nb-video-content { display:flex; flex:1; min-height:0; flex-direction:column; justify-content:center; gap:24px; }
.notebook-output .nb-audio-content h3 { font-size:36px; line-height:1.2; max-width:24ch; }
.notebook-output .nb-audio-content p { font-size:22px; }
.nb-audio-content audio { width:100%; height:54px; }
.nb-video-content video { width:100%; max-height:100%; min-height:0; object-fit:contain; background:var(--deck-surface); }
.nb-print-poster { display:none; }
.nb-card-content { display:flex; flex-direction:column; justify-content:center; align-items:flex-start; gap:28px; border-top:1px solid var(--deck-line); }
.notebook-output .nb-card-content h3 { font-size:30px; line-height:1.25; }
.notebook-output :is(.nb-card-content,.nb-quiz-content,.nb-audio-content) h3 { text-transform:none; letter-spacing:-.01em; }
.notebook-output .nb-card-answer { font-size:25px; line-height:1.4; color:var(--deck-emphasis); }
.notebook-output .nb-card-instruction { font-size:20px; color:var(--deck-muted); }
.notebook-output .nb-quiz-content h3 { font-size:24px; line-height:1.3; margin-bottom:18px; }
.nb-options { display:flex; flex-direction:column; gap:8px; }
.notebook-output .nb-options .nb-option.btn { display:flex; justify-content:flex-start; align-items:flex-start; gap:10px; text-align:left; height:auto; min-height:48px; padding:12px; border:1px solid var(--deck-line); border-radius:8px; white-space:normal; font-size:18px; line-height:1.3; font-weight:400; background:transparent; color:var(--deck-ink); box-shadow:none; }
.nb-option.btn:hover,.nb-option.btn[data-selected="true"] { background:var(--deck-raised); }
.nb-option.btn[data-correct="true"] { border-color:var(--deck-emphasis); background:var(--deck-surface); }
.nb-option strong { color:var(--deck-emphasis); }
.nb-feedback,.nb-hint { margin-top:16px; padding-top:12px; border-top:1px solid var(--deck-line); }
.notebook-output .nb-feedback h4 { font-size:21px; color:var(--deck-emphasis); margin:0 0 8px; }
.notebook-output :is(.nb-feedback p,.nb-hint) { font-size:19px; line-height:1.4; }
.nb-feedback p + p { margin-top:12px; }
.nb-table-scroll .table { font-size:19px; }
.nb-table-scroll :is(th,td) { min-width:150px; white-space:normal; vertical-align:top; padding:16px 12px; }
.nb-table-scroll thead th { color:var(--deck-muted); font-size:17px; }
.nb-table-scroll tbody th { font-size:21px; min-width:170px; }
.nb-viewer :focus-visible,.nb-sidebar :focus-visible { outline:2px solid var(--deck-emphasis); outline-offset:4px; }
@media print {
  .nb-controls,audio,video { display:none; }
  .nb-print-poster { display:block; width:100%; object-fit:contain; }
  .nb-image-scroll img { width:100%!important; height:100%!important; object-fit:contain; }
  .nb-image-scroll,.nb-card-content,.nb-quiz-content,.nb-table-scroll { overflow:hidden; }
}
</style>
