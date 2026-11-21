<script setup lang="ts">
/**
 * queue - what do I have to do? (#5339)
 *
 * How many wait, then one line per item, each with its gesture. The
 * background under a line advances with its age against the promised delay,
 * warmer as it nears it; the age is written too, so warmth is never alone.
 * See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): value (how many), list (queue).
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

interface QueueItem {
  label: string
  age?: number
  due?: number
  to?: RouteLocationRaw
  action?: { verb: string; to: RouteLocationRaw }
}
interface QueueData {
  total?: number
  note?: string
  items: QueueItem[]
}

const props = defineProps<{ data: QueueData; options: { ageUnit?: 'min' | 'h' | 'd'; maxItems?: number }; size: CardSize }>()

const blocks = computed<CardBlock[]>(() => [
  { kind: 'value', value: props.data.total ?? props.data.items.length, label: props.data.note },
  { kind: 'list', look: 'queue', items: props.data.items, max: props.options.maxItems ?? 3, ageUnit: props.options.ageUnit ?? 'd' },
])
</script>

<template>
  <div class="qd-queue"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
