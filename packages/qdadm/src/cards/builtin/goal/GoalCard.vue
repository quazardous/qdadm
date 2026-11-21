<script setup lang="ts">
/**
 * goal - am I on time? (#5339)
 *
 * The value against the target, the bar's length for the share reached, a
 * tick for where the expected pace says it should be today, and the words
 * (share, expected share, ahead or behind), so nothing rests on colour.
 * See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): value ("of target"), progress (goal).
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

interface GoalData {
  value: number
  target: number
  start?: string
  due?: string
  now?: string
}

const props = defineProps<{ data: GoalData; options: { unit?: string; decimals?: number }; size: CardSize }>()
const { t, locale } = useI18n()

const blocks = computed<CardBlock[]>(() => {
  const { data: d, options: o } = props
  const target = formatNumber(d.target, locale.value, { decimals: o.decimals, unit: o.unit })
  return [
    { kind: 'value', value: d.value, unit: o.unit, decimals: o.decimals, label: t('core.cards.goal.of', { target }) },
    { kind: 'progress', look: 'goal', value: d.value, target: d.target, start: d.start, due: d.due, now: d.now, unit: o.unit, decimals: o.decimals },
  ]
})
</script>

<template>
  <div class="qd-goal"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
