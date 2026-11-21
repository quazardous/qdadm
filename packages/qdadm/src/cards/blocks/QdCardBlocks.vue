<script setup lang="ts">
/**
 * QdCardBlocks (#5414): a card's blocks, in order, at the card's size. A
 * block that does not fit its kind is drawn as a short problem, the others
 * as usual.
 *
 *   <QdCardBlocks :blocks="[{ kind: 'value', value: 12 }, { kind: 'viz', series: [3, 5, 4] }]" size="s" />
 */
import { computed, inject, onBeforeUnmount, watchEffect, type Component } from 'vue'
import ValueBlock from './ValueBlock.vue'
import VizBlock from './VizBlock.vue'
import ListBlock from './ListBlock.vue'
import TextBlock from './TextBlock.vue'
import ProgressBlock from './ProgressBlock.vue'
import PartsBlock from './PartsBlock.vue'
import FlashBlock from './FlashBlock.vue'
import { CARD_FLASHES } from './flash'
import { checkBlock } from './schema'
import type { CardBlock, FlashBlock as Flash } from './types'
import type { CardSize } from '../types'

const props = withDefaults(defineProps<{ blocks: CardBlock[]; size?: CardSize; check?: boolean }>(), { size: 's', check: false })

const COMPONENTS: Record<string, Component> = {
  value: ValueBlock,
  viz: VizBlock,
  list: ListBlock,
  text: TextBlock,
  progress: ProgressBlock,
  parts: PartsBlock,
  flash: FlashBlock,
}

// Inside a card, the flash blocks go to their place there; alone, they stay here
const flashes = inject(CARD_FLASHES, null)
const owner = Symbol('blocks')
const fits = (block: CardBlock, i: number) => !props.check || checkBlock(block, `blocks[${i}]`).length === 0
if (flashes) {
  watchEffect(() => flashes.set(owner, props.blocks.filter((b, i): b is Flash => b.kind === 'flash' && fits(b, i))))
  onBeforeUnmount(() => flashes.drop(owner))
}

const items = computed(() =>
  props.blocks.flatMap((block, i) => {
    if (flashes && block.kind === 'flash' && fits(block, i)) return []
    const problems = props.check ? checkBlock(block, `blocks[${i}]`) : []
    return [{ block, problems, component: problems.length ? null : COMPONENTS[block.kind] ?? null }]
  })
)
</script>

<template>
  <template v-for="(item, i) in items" :key="i">
    <component :is="item.component" v-if="item.component" :block="item.block" :size="size" />
    <p v-else class="qd-card-note qd-card-block qd-card-block--invalid" data-block="invalid">
      <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
      {{ item.problems[0]?.path ?? `blocks[${i}]` }}: {{ item.problems[0]?.message ?? `no block kind '${(item.block as { kind?: string }).kind}'` }}
    </p>
  </template>
</template>
