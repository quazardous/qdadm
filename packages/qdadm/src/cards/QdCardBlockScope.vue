<script setup lang="ts">
/**
 * Gives a dashboard block's `card.links` (#5405) to the card it draws: the
 * card's foot shows them beside its own; and its `card.blocks` (#5414), drawn
 * under the card's body.
 */
import { computed, provide, toRef } from 'vue'
import { CARD_BLOCK_LINKS, CARD_BLOCK_BLOCKS, CARD_SLOT_SIZE } from './blockLinks'
import type { CardLink } from './types'
import type { CardBlock } from './blocks/types'

const props = withDefaults(defineProps<{ links?: CardLink[]; blocks?: CardBlock[]; size?: string | null }>(), { links: () => [], blocks: () => [], size: null })
provide(CARD_BLOCK_LINKS, toRef(props, 'links'))
// And its blocks (#5414), drawn under the card's body
provide(CARD_BLOCK_BLOCKS, toRef(props, 'blocks'))
// And the slot's size (#5503), width × height
provide(
  CARD_SLOT_SIZE,
  computed(() => {
    const [w, h] = (props.size ?? '').split('x').map(Number)
    return w && h ? { w, h } : null
  })
)
</script>

<template>
  <slot></slot>
</template>
