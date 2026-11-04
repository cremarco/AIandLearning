<script setup lang="ts">
import { computed } from 'vue'
import type { PromptCommand } from '../utils/deck'
const props = defineProps<{ commands: PromptCommand[] }>()
const columns = computed(() => {
  const middle = Math.ceil(props.commands.length / 2)
  return [props.commands.slice(0, middle), props.commands.slice(middle)]
})
</script>

<template>
  <div class="command-tables grid grid-cols-1 md:grid-cols-2" lang="en">
    <div v-for="(rows, index) in columns" :key="index" class="overflow-x-auto">
      <table class="table command-table" :aria-label="`Prompt shortcuts, part ${index + 1}`">
        <thead><tr><th scope="col">Command</th><th scope="col">What you can ask for</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.command">
            <th scope="row"><code>{{ row.command }}</code></th>
            <td>{{ row.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.command-tables { width:100%; gap:36px; align-self:flex-start; }
.slidev-layout .command-table { width:100%; font-size:20px; line-height:1.2; letter-spacing:-.015em; }
.slidev-layout .command-table :is(th,td) { padding:5px 10px; border-bottom:1px solid var(--deck-line); vertical-align:top; text-align:left; }
.slidev-layout .command-table thead th { color:var(--deck-muted); font-size:17px; font-weight:500; padding-top:0; padding-bottom:13px; }
.slidev-layout .command-table tbody th { width:43%; font-weight:600; }
.slidev-layout .command-table code { background:none; color:var(--deck-cyan); padding:0; font-size:18px; white-space:nowrap; }
.slidev-layout .command-table tbody tr:last-child :is(th,td) { border-bottom:0; }
</style>
