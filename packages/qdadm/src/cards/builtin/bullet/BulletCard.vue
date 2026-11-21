<script setup lang="ts">
/**
 * bullet - good, fair or poor, and how far from the target? (#5339)
 *
 * Few's bullet graph: the dark bar is the value, the upright tick the
 * target, the background ranges poor / fair / good, cut at the thresholds
 * written under the axis. The range the value falls in is written too.
 * See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): value ("target …"), progress (bullet).
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

interface BulletData {
  value: number
  target?: number
  thresholds: number[]
  min?: number
  max?: number
}

const props = defineProps<{ data: BulletData; options: { unit?: string; decimals?: number; higherIs?: 'better' | 'worse' }; size: CardSize }>()
const { t, locale } = useI18n()

const blocks = computed<CardBlock[]>(() => {
  const { data: d, options: o } = props
  const fmt = (v: number) => formatNumber(v, locale.value, { decimals: o.decimals, unit: o.unit })
  return [
    { kind: 'value', value: d.value, unit: o.unit, decimals: o.decimals, ...(d.target !== undefined ? { label: t('core.cards.bullet.target', { target: fmt(d.target) }) } : {}) },
    { kind: 'progress', look: 'bullet', value: d.value, target: d.target, thresholds: d.thresholds, min: d.min, max: d.max, higherIs: o.higherIs, unit: o.unit, decimals: o.decimals },
  ]
})
</script>

<template>
  <div class="qd-bullet"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
