<script setup lang="ts">
/**
 * compare - better or worse than before? (#5355)
 *
 * The two values side by side with their labels, and the change, signed, in
 * points or in percent, toned by `higherIs`. See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): value (now, against then).
 */
import { computed } from 'vue'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

const props = defineProps<{
  data: { now: { value: number; label?: string }; then: { value: number; label?: string } }
  options: { unit?: string; decimals?: number; higherIs?: 'better' | 'worse' | 'neutral'; changeAs?: 'points' | 'percent' }
  size: CardSize
}>()

const blocks = computed<CardBlock[]>(() => {
  const { data: d, options: o } = props
  return [{ kind: 'value', value: d.now.value, label: d.now.label, then: d.then, unit: o.unit, decimals: o.decimals ?? 1, higherIs: o.higherIs, changeAs: o.changeAs }]
})
</script>

<template>
  <div class="qd-blocks"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
