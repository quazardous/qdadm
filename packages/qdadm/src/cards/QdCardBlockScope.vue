<script setup lang="ts">
/**
 * Gives a dashboard block's `card.links` (#5405) to the card it draws: the
 * card's foot shows them beside its own; and its `card.blocks` (#5414), drawn
 * under the card's body.
 */
import { provide, toRef } from 'vue'
import { CARD_BLOCK_LINKS, CARD_BLOCK_BLOCKS } from './blockLinks'
import type { CardLink } from './types'
import type { CardBlock } from './blocks/types'

const props = withDefaults(defineProps<{ links?: CardLink[]; blocks?: CardBlock[] }>(), { links: () => [], blocks: () => [] })
provide(CARD_BLOCK_LINKS, toRef(props, 'links'))
// And its blocks (#5414), drawn under the card's body
provide(CARD_BLOCK_BLOCKS, toRef(props, 'blocks'))
</script>

<template>
  <slot></slot>
</template>
