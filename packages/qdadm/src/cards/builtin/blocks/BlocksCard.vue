<script setup lang="ts">
/**
 * blocks - a card of the app's own making (#5414)
 *
 * The blocks it is given, in their order: a value, a chart, lines, a text, a
 * progress bar, a whole in parts. See meta.json for the sheet; each block's
 * fields are in cards.md, "Blocks".
 */
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

defineProps<{ data: { blocks: CardBlock[] }; options: Record<string, unknown>; size: CardSize }>()
</script>

<template>
  <div class="qd-blocks"><QdCardBlocks :blocks="data.blocks" :size="size" /></div>
</template>
