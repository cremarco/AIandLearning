<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CommandCategory, PromptCommand } from '../../utils/deck'
import { explainedShortcuts, getShortcutVideo } from '../../utils/shortcut-videos'
import CommandTag from './CommandTag.vue'
import PromptVideoDialog from '../media/PromptVideoDialog.vue'
import { useSlideLanguage } from '../../utils/slide-language'
const { language, t } = useSlideLanguage()
const player = ref<InstanceType<typeof PromptVideoDialog>>()
const props = withDefaults(defineProps<{ commands: PromptCommand[]; category?: CommandCategory }>(), { category: 'informal' })
const labels = computed(() => props.category === 'formal-web'
  ? { column: 'Menu action', description: 'What it does', table: 'Formal ChatGPT web actions' }
  : props.category === 'formal-desktop'
    ? { column: 'Official command', description: 'What it does', table: 'Formal desktop slash commands' }
    : { column: 'Tested prompt label', description: 'Observed interactive output', table: 'Tested interactive prompt labels' })
const columns = computed(() => {
  const middle = Math.ceil(props.commands.length / 2)
  return [props.commands.slice(0, middle), props.commands.slice(middle)]
})
</script>

<template>
  <div class="command-tables" :lang="language">
    <div v-for="(rows, index) in columns" :key="index" class="overflow-x-auto">
      <table class="table command-table" :aria-label="`${t(labels.table)}, ${t('part')} ${index + 1}`">
        <thead><tr><th scope="col">{{ t(labels.column) }}</th><th scope="col">{{ t(labels.description) }}</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.command">
            <th scope="row">
              <button v-if="getShortcutVideo(row.command)" class="btn btn-link command-video-trigger" type="button" :aria-label="`${t('Play video')}: ${row.command}`" @click.stop="player?.open(row.command)">
                <svg v-if="category === 'informal' && explainedShortcuts.has(row.command)" class="command-example-dot" role="img" :aria-label="t('Example explained in the speaker notes')" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
                <CommandTag :text="row.command" /><svg aria-hidden="true" class="command-video-icon" viewBox="0 0 16 16"><path d="M5 3.5 12 8l-7 4.5Z" fill="currentColor" /></svg>
              </button>
              <CommandTag v-else :text="row.command" />
            </th>
            <td>{{ row.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <PromptVideoDialog ref="player" />
  </div>
</template>

<style scoped>
.command-tables { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); width:100%; gap:24px 40px; align-self:flex-start; }
.slidev-layout .command-table { width:100%; table-layout:fixed; font-size:21px; line-height:1.3; letter-spacing:-.015em; }
.slidev-layout .command-table :is(th,td) { padding:12px 0; border-bottom:1px solid var(--deck-line); vertical-align:top; text-align:left; }
.slidev-layout .command-table thead th { color:var(--deck-muted); font-size:var(--deck-text-label); font-weight:500; padding-top:0; padding-bottom:13px; }
.slidev-layout .command-table th:first-child { width:46%; padding-right:16px; }
.slidev-layout .command-table tbody th { font-weight:600; }
.slidev-layout .command-table td { color:var(--deck-muted); font-size:20px; }
.slidev-layout .command-table .command-token { font-size:19px; }
.slidev-layout .command-table tbody tr:last-child :is(th,td) { border-bottom:0; }
.slidev-layout .command-table .command-video-trigger { display:inline-flex; align-items:center; gap:8px; min-height:44px; height:auto; margin:-4px 0; padding:0; border:0; border-radius:0; background:none; box-shadow:none; color:var(--deck-cyan); font:inherit; text-decoration:none; }
.command-video-trigger:is(:hover,:focus-visible) .command-token { text-decoration:underline; text-underline-offset:4px; }
.command-video-icon { width:16px; height:16px; flex:none; }
.command-example-dot { width:8px; height:8px; flex:none; color:var(--deck-important); }
/* Keep the selected tool or shortcut aligned with its explanation. */
.command-table tbody tr { transition:background-color var(--deck-motion-feedback) var(--deck-motion-ease); }
.command-table tbody tr:has(:focus-visible) { background:var(--deck-surface); }
@media (hover:hover) { .command-table tbody tr:hover { background:var(--deck-surface); } }
@media print { .command-video-icon,.shortcut-video-dialog { display:none; } }
</style>
