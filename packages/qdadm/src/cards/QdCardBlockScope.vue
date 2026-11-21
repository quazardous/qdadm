<script setup lang="ts">
/**
 * Gives a dashboard block's `card.links` (#5405) to the card it draws: the
 * card's foot shows them beside its own.
 */
import { provide, toRef } from 'vue'
import { CARD_BLOCK_LINKS } from './blockLinks'
import type { CardLink } from './types'

const props = withDefaults(defineProps<{ links?: CardLink[] }>(), { links: () => [] })
provide(CARD_BLOCK_LINKS, toRef(props, 'links'))
</script>

<template>
  <slot></slot>
</template>
