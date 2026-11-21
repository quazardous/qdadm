<script setup lang="ts">
/**
 * ranking - what works? (#5355)
 *
 * The first N, ranked, with their values; a bar per line when asked, scaled
 * to the first. Each line opens its item. See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): list (ranking).
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

const props = defineProps<{
  data: { items: Array<{ label: string; value: number; to?: RouteLocationRaw }> }
  options: { maxItems?: number; unit?: string; bars?: boolean }
  size: CardSize
}>()

const blocks = computed<CardBlock[]>(() => [
  { kind: 'list', look: 'ranking', items: props.data.items, max: props.options.maxItems ?? 5, unit: props.options.unit, bars: !!props.options.bars },
])
</script>

<template>
  <div class="qd-blocks"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
