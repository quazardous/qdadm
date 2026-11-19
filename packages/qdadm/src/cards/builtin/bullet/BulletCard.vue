<script setup lang="ts">
/**
 * bullet - good, fair or poor, and how far from the target? (#5339)
 *
 * Few's bullet graph: the dark bar is the value, the upright tick the
 * target, the background ranges poor / fair / good, cut at the thresholds
 * written under the axis. The range the value falls in is written too.
 * See meta.json for the sheet.
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
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

const fmt = (v: number) => formatNumber(v, locale.value, { decimals: props.options.decimals, unit: props.options.unit })
const cuts = computed(() => [...props.data.thresholds].sort((a, b) => a - b))
const min = computed(() => props.data.min ?? 0)
const max = computed(() => {
  if (props.data.max !== undefined) return props.data.max
  const top = Math.max(props.data.value, props.data.target ?? -Infinity, ...cuts.value)
  return top + (top - min.value) * 0.15
})
const at = (v: number) => `${Math.min(Math.max((v - min.value) / (max.value - min.value || 1), 0), 1) * 100}%`

/** The ranges, low to high, each with its word */
const ranges = computed(() => {
  const bounds = [min.value, ...cuts.value, max.value]
  const words = cuts.value.length === 1 ? ['poor', 'good'] : ['poor', 'fair', 'good']
  const ordered = props.options.higherIs === 'worse' ? [...words].reverse() : words
  return bounds.slice(0, -1).map((from, i) => ({ from, to: bounds[i + 1]!, word: ordered[i]! }))
})
const verdict = computed(() => ranges.value.find((r, i) => props.data.value < r.to || i === ranges.value.length - 1)?.word ?? 'fair')
</script>

<template>
  <div class="qd-bullet">
    <div class="qd-metric-line">
      <span class="qd-card-value">{{ fmt(data.value) }}</span>
      <span v-if="data.target !== undefined" class="qd-card-unit">{{ t('core.cards.bullet.target', { target: fmt(data.target) }) }}</span>
    </div>
    <div
      class="qd-bullet-graph"
      role="img"
      :aria-label="t('core.cards.bullet.aria', { value: fmt(data.value), range: t(`core.cards.bullet.${verdict}`) })"
    >
      <span
        v-for="(r, i) in ranges"
        :key="i"
        class="qd-bullet-range"
        :data-range="r.word"
        :style="{ left: at(r.from), width: `calc(${at(r.to)} - ${at(r.from)})` }"
      ></span>
      <span class="qd-bullet-value" :style="{ width: at(data.value) }"></span>
      <span v-if="data.target !== undefined" class="qd-bullet-target" :style="{ left: at(data.target) }"></span>
    </div>
    <div class="qd-bullet-axis" aria-hidden="true">
      <span :style="{ left: '0%' }">{{ fmt(min) }}</span>
      <span v-for="c in cuts" :key="c" :style="{ left: at(c) }">{{ fmt(c) }}</span>
      <span :style="{ left: '100%' }">{{ fmt(max) }}</span>
    </div>
    <p class="qd-card-note">
      <strong class="qd-bullet-verdict" :data-range="verdict">{{ t(`core.cards.bullet.${verdict}`) }}</strong>
    </p>
  </div>
</template>
