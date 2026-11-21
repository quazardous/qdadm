<script setup lang="ts">
/**
 * split - where does it come from? (#5355)
 *
 * The total, one bar split in parts, and the legend with each part's name and
 * value. The colours come from a fixed palette by rank, never from the data;
 * the parts past `maxParts` go into a grey "others". Everything the colour
 * says is also written. See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): value (the total), parts.
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

interface Part {
  label: string
  value: number
  to?: RouteLocationRaw
}
const props = defineProps<{ data: { total?: number; parts: Part[] }; options: { maxParts?: number; unit?: string }; size: CardSize }>()

const blocks = computed<CardBlock[]>(() => {
  const { data: d, options: o } = props
  const total = d.total ?? d.parts.reduce((s, p) => s + p.value, 0)
  return [
    { kind: 'value', value: total, unit: o.unit },
    { kind: 'parts', parts: d.parts, max: o.maxParts ?? 4 },
  ]
})
</script>

<template>
  <div class="qd-split"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
