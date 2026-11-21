<script setup lang="ts">
/**
 * feed - what happened? (#5355)
 *
 * The latest events first, with when (a time for today, else a day), each
 * opening its item; a status as a side mark and a word. See meta.json for
 * the sheet.
 *
 * An assembly of blocks (#5414): list (feed).
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize, CardStatus } from '../../types'

const props = defineProps<{
  data: { now?: string | number; items: Array<{ at: string | number; label: string; to?: RouteLocationRaw; status?: CardStatus }> }
  options: { maxItems?: number }
  size: CardSize
}>()

const blocks = computed<CardBlock[]>(() => [
  { kind: 'list', look: 'feed', items: props.data.items, max: props.options.maxItems ?? 4, ...(props.data.now !== undefined ? { now: props.data.now } : {}) },
])
</script>

<template>
  <div class="qd-blocks"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
