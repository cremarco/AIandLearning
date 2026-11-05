<script setup lang="ts">
import type { ToolTable } from '../utils/deck'
import { brandsForLabel } from '../utils/tool-brands'
import { assetUrl } from '../utils/assets'
import ToolLogos from './ToolLogos.vue'

defineProps<{ table: ToolTable; label: string }>()
</script>

<template>
  <div class="tool-resource-table-wrap overflow-x-auto">
    <table class="table tool-resource-table w-full table-fixed" :aria-label="label">
      <thead>
        <tr><th v-for="header in table.headers" :key="header" scope="col">{{ header }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in table.rows" :key="row.tool">
          <th scope="row">
            <span class="tool-resource-name flex items-center gap-2">
              <ToolLogos :ids="brandsForLabel(row.tool)" compact />
              <a class="link" :href="assetUrl(row.url)" target="_blank" rel="noopener">{{ row.tool }}</a>
            </span>
          </th>
          <td>{{ row.purpose }}</td>
          <td>{{ row.access }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tool-resource-table-wrap { width:100%; align-self:flex-start; }
.slidev-layout .tool-resource-table { font-size:19px; line-height:1.3; letter-spacing:-.015em; }
.slidev-layout .tool-resource-table :is(th,td) { padding:8px 12px; border-bottom:1px solid var(--deck-line); text-align:left; vertical-align:middle; white-space:normal; }
.slidev-layout .tool-resource-table :is(th,td):first-child { padding-left:0; }
.slidev-layout .tool-resource-table :is(th,td):last-child { padding-right:0; }
.slidev-layout .tool-resource-table thead th { color:var(--deck-muted); font-size:17px; font-weight:500; padding-top:0; padding-bottom:12px; }
.tool-resource-table thead th:nth-child(1) { width:28%; }
.tool-resource-table thead th:nth-child(2) { width:34%; }
.tool-resource-table thead th:nth-child(3) { width:38%; }
.tool-resource-table tbody th { font-size:20px; font-weight:650; }
.tool-resource-table tbody td:last-child { color:var(--deck-muted); }
.tool-resource-table tbody tr:last-child :is(th,td) { border-bottom:0; }
.tool-resource-name :deep(.tool-logo) { width:24px; height:24px; padding:2px; border-radius:4px; }
@media print { .tool-resource-table-wrap { overflow:visible; } }
</style>
