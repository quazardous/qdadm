<script setup lang="ts">
/**
 * metric - how many, and is it going up? (#5339)
 *
 * The value, its change over the period (sign + tone from `higherIs`), the
 * recent curve with its last point, and the hot lines behind the number,
 * each opening its item. See meta.json for the sheet.
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from '../../../i18n/useI18n'
import { formatNumber, formatDelta, seriesPaths, seriesPoints, deltaTone } from '../shared'
import type { CardSize, CardStatus } from '../../types'

interface MetricData {
  value: number
  label?: string
  badge?: string
  delta?: { value: number; period?: string }
  series?: number[]
  hot?: Array<{ label: string; tag?: string; tagStatus?: CardStatus; to?: RouteLocationRaw }>
}
interface MetricOptions {
  unit?: string
  decimals?: number
  higherIs?: 'better' | 'worse' | 'neutral'
  hotCount?: number
}

const props = defineProps<{ data: MetricData; options: MetricOptions; size: CardSize }>()
const { locale } = useI18n()

const W = 100
const H = 28
const value = computed(() => formatNumber(props.data.value, locale.value, { decimals: props.options.decimals, unit: props.options.unit }))
const delta = computed(() => {
  const d = props.data.delta
  if (!d) return null
  return {
    text: formatDelta(d.value, locale.value, props.options.decimals) + (props.options.unit ? `\u202f${props.options.unit}` : ''),
    period: d.period,
    tone: deltaTone(d.value, props.options.higherIs),
  }
})
const paths = computed(() => seriesPaths(props.data.series ?? [], W, H))
const last = computed(() => {
  const pts = seriesPoints(props.data.series ?? [], W, H)
  const p = pts[pts.length - 1]
  return p ? { left: `${p[0]}%`, top: `${(p[1] / H) * 100}%` } : null
})
const hot = computed(() => (props.data.hot ?? []).slice(0, props.options.hotCount ?? 2))
</script>

<template>
  <div class="qd-metric">
    <div class="qd-metric-line">
      <span class="qd-card-value">{{ value }}</span>
      <span v-if="data.label" class="qd-card-unit">{{ data.label }}</span>
      <span v-if="data.badge" class="qd-card-badge">{{ data.badge }}</span>
      <span v-if="delta" class="qd-card-delta" :class="`qd-tone--${delta.tone}`">
        {{ delta.text }}<template v-if="delta.period"> / {{ delta.period }}</template>
      </span>
    </div>

    <div v-if="paths.line" class="qd-metric-spark" aria-hidden="true">
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none">
        <path :d="paths.area" class="qd-spark-area" />
        <path :d="paths.line" class="qd-spark-line" vector-effect="non-scaling-stroke" />
      </svg>
      <span v-if="last" class="qd-spark-dot" :style="last"></span>
    </div>

    <ul v-if="hot.length" class="qd-card-hot">
      <li v-for="(item, i) in hot" :key="i">
        <component :is="item.to ? RouterLink : 'span'" :to="item.to" class="qd-card-hot-line">
          <span class="qd-card-hot-label">{{ item.label }}</span>
          <span v-if="item.tag" class="qd-card-tag" :class="item.tagStatus ? `qd-tone--${item.tagStatus}` : null">{{ item.tag }}</span>
        </component>
      </li>
    </ul>
  </div>
</template>
