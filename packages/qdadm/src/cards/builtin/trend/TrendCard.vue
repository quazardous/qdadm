<script setup lang="ts">
/**
 * trend - is this normal? (#5355)
 *
 * The curve, the band of normal (one for the whole curve, or one per point),
 * and the points outside it marked and counted in words. The last value is
 * written. See meta.json for the sheet.
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber } from '../shared'
import type { CardSize } from '../../types'

interface Point {
  value: number
  at?: string | number
  low?: number
  high?: number
}
const props = defineProps<{
  data: { series: Point[]; normal?: { low: number; high: number }; label?: string }
  options: { unit?: string; decimals?: number }
  size: CardSize
}>()
const { t, locale } = useI18n()

const W = 100
const H = 40
const PAD = 3
const bands = computed(() => props.data.series.map((p) => ({ low: p.low ?? props.data.normal?.low, high: p.high ?? props.data.normal?.high })))
const range = computed(() => {
  const all = props.data.series.flatMap((p, i) => [p.value, bands.value[i]!.low, bands.value[i]!.high]).filter((v): v is number => typeof v === 'number')
  const min = Math.min(...all)
  const max = Math.max(...all)
  return { min, span: max - min || 1 }
})
const x = (i: number) => (props.data.series.length > 1 ? (i / (props.data.series.length - 1)) * W : W / 2)
const y = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - range.value.min) / range.value.span)
const line = computed(() => props.data.series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' '))
const band = computed(() => {
  const pts = bands.value.map((b, i) => ({ i, b })).filter(({ b }) => b.low !== undefined && b.high !== undefined)
  if (pts.length < 2) return ''
  const top = pts.map(({ i, b }, k) => `${k ? 'L' : 'M'}${x(i).toFixed(2)},${y(b.high!).toFixed(2)}`).join(' ')
  const bottom = [...pts].reverse().map(({ i, b }) => `L${x(i).toFixed(2)},${y(b.low!).toFixed(2)}`).join(' ')
  return `${top} ${bottom} Z`
})
const outside = computed(() =>
  props.data.series
    .map((p, i) => ({ i, p, b: bands.value[i]! }))
    .filter(({ p, b }) => (b.low !== undefined && p.value < b.low) || (b.high !== undefined && p.value > b.high))
    .map(({ i, p }) => ({ left: `${x(i)}%`, top: `${(y(p.value) / H) * 100}%`, value: p.value }))
)
const last = computed(() => props.data.series[props.data.series.length - 1])
const fmt = (v: number) => formatNumber(v, locale.value, { decimals: props.options.decimals, unit: props.options.unit })
const hasBand = computed(() => bands.value.some((b) => b.low !== undefined && b.high !== undefined))
</script>

<template>
  <div class="qd-trend">
    <div v-if="last" class="qd-metric-line">
      <span class="qd-card-value">{{ fmt(last.value) }}</span>
      <span v-if="data.label" class="qd-card-unit">{{ data.label }}</span>
    </div>
    <div class="qd-trend-chart" aria-hidden="true">
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
        <path v-if="band" :d="band" class="qd-trend-band" />
        <path :d="line" class="qd-spark-line" vector-effect="non-scaling-stroke" />
      </svg>
      <span v-for="(o, i) in outside" :key="i" class="qd-trend-out" :style="{ left: o.left, top: o.top }"></span>
    </div>
    <p v-if="hasBand" class="qd-trend-reading" :class="outside.length ? 'qd-tone-text--watch' : null">
      {{ outside.length ? t('core.cards.trend.outside', { count: outside.length }) : t('core.cards.trend.within') }}
    </p>
  </div>
</template>
