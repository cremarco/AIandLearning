<script setup lang="ts">
import { computed } from 'vue'
import type { Reference } from '../utils/deck'

const props = defineProps<{ references: Reference[]; spacious?: boolean }>()
const groups = computed(() => {
  const grouped = new Map<string, Reference[]>()
  for (const reference of props.references) {
    const title = reference.group || 'References'
    if (!grouped.has(title)) grouped.set(title, [])
    grouped.get(title)!.push(reference)
  }
  return [...grouped].map(([title, references]) => ({ title, references }))
})
</script>

<template>
  <div class="bibliography" :class="{ 'bibliography-spacious': spacious }">
    <div class="bibliography-columns grid gap-6 lg:gap-9" :class="groups.length === 2 ? 'grid-cols-2' : 'grid-cols-3'">
      <section v-for="group in groups" :key="group.title" class="bibliography-group">
        <h2>{{ group.title }}</h2>
        <ul class="list bibliography-list">
          <li v-for="reference in group.references" :key="reference.url || reference.citation" class="list-row">
            <a class="link bibliography-entry" :href="reference.url" target="_blank" rel="noopener" :title="reference.citation" :aria-label="reference.citation">
              <span class="bibliography-author">{{ reference.label }}</span>
              <span class="bibliography-title">{{ reference.shortTitle || reference.citation }}</span>
            </a>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bibliography { width:100%; align-self:stretch; display:flex; flex-direction:column; gap:12px; }
.bibliography-columns { flex:1; min-height:0; align-items:start; }
.slidev-layout .bibliography-group h2 { font-size:22px; line-height:1.2; margin:0 0 9px; }
.slidev-layout .bibliography-list.list { padding:0; margin:0; list-style:none; }
.slidev-layout .bibliography-list .list-row { grid-template-columns:minmax(0,1fr); gap:0; margin:0; padding:6px 0; border-radius:0; }
.slidev-layout .bibliography-entry { display:flex; flex-direction:column; gap:2px; text-decoration:none; }
.bibliography-author { font-size:19px; line-height:1.16; font-weight:650; text-decoration:underline; text-underline-offset:3px; }
.bibliography-title { color:var(--deck-muted); font-size:18px; line-height:1.2; }
.slidev-layout .bibliography-spacious .bibliography-group h2 { font-size:26px; margin-bottom:12px; }
.slidev-layout .bibliography-spacious .list-row { padding-block:10px; }
.slidev-layout .bibliography-spacious .bibliography-entry { gap:4px; }
.bibliography-spacious .bibliography-author { font-size:22px; }
.bibliography-spacious .bibliography-title { font-size:21px; }
</style>
