<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ScreenshotResult } from '../../utils/deck'
import { assetUrl } from '../../utils/assets'

type GalleryItem = ScreenshotResult & { width?: number; height?: number }
const props = defineProps<{ items: GalleryItem[] }>()
const gallery = ref<HTMLElement>()
const bounds = ref({ width: 1152, height: 520 })
const naturalSizes = ref<Record<string, { width: number; height: number }>>({})
const gutter = 16
const labelHeight = 24
let observer: ResizeObserver | undefined

function rememberSize(item: GalleryItem, event: Event) {
  const image = event.target as HTMLImageElement
  if (image.naturalWidth && image.naturalHeight) {
    naturalSizes.value = {
      ...naturalSizes.value,
      [item.src]: { width: image.naturalWidth, height: image.naturalHeight },
    }
  }
}

const layout = computed(() => {
  const count = props.items.length
  const columnCount = count <= 3 ? Math.max(1, count) : count <= 6 ? 3 : count <= 10 ? 4 : 6
  const columnWidth = Math.max(1, (bounds.value.width - gutter * (columnCount - 1)) / columnCount)
  const columns = Array.from({ length: columnCount }, () => ({ items: [] as GalleryItem[], imageHeight: 0 }))
  for (const item of props.items) {
    const size = item.width && item.height ? item : naturalSizes.value[item.src]
    const ratio = size?.width && size?.height ? size.height / size.width : .75
    const shortest = columns.reduce((best, column) => {
      const height = (candidate: typeof column) => candidate.imageHeight + candidate.items.length * (labelHeight + gutter)
      return height(column) < height(best) ? column : best
    })
    shortest.items.push(item)
    shortest.imageHeight += columnWidth * ratio
  }
  // Shrink the complete screenshots together when their natural heights would
  // exceed the slide. Their aspect ratios and all visible source content remain intact.
  const scale = Math.max(0, Math.min(1, ...columns.filter(column => column.items.length).map(column => {
    const fixedHeight = column.items.length * labelHeight + (column.items.length - 1) * gutter
    return (bounds.value.height - fixedHeight) / column.imageHeight
  })))
  return { columns, itemWidth: columnWidth * scale }
})

onMounted(() => {
  if (!gallery.value) return
  observer = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width && entry.contentRect.height) {
      bounds.value = { width: entry.contentRect.width, height: entry.contentRect.height }
    }
  })
  observer.observe(gallery.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="gallery" class="screenshot-results grid gap-4 md:gap-4" :style="{ gridTemplateColumns: `repeat(${layout.columns.length}, minmax(0, 1fr))` }" aria-label="Claude results from the original slide prompts">
    <div v-for="(column, index) in layout.columns" :key="index" class="masonry-column">
      <figure v-for="item in column.items" :key="item.label" class="screenshot-result" :style="{ width: `${layout.itemWidth}px` }">
        <figcaption class="command-token" :title="item.label">{{ item.label }}</figcaption>
        <a class="link screenshot-image" :href="assetUrl(item.src)" target="_blank" rel="noopener" :aria-label="`Open full-size ${item.label} screenshot`" @click.stop>
          <img :src="assetUrl(item.src)" :alt="item.alt" :width="item.width" :height="item.height" @load="rememberSize(item, $event)" />
        </a>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.screenshot-results { width:100%; height:100%; min-width:0; min-height:0; align-self:stretch; align-items:start; }
.masonry-column { display:flex; flex-direction:column; align-items:center; gap:16px; min-width:0; }
.screenshot-result { min-width:0; max-width:100%; }
.slidev-layout .screenshot-results .screenshot-result figcaption { height:24px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; line-height:18px; }
.screenshot-image { display:block; }
.screenshot-image img { display:block; width:100%; height:auto; }
</style>
