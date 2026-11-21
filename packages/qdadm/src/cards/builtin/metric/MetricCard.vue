<script setup lang="ts">
/**
 * metric - how many, and is it going up? (#5339)
 *
 * The value, its change over the period (sign + tone from `higherIs`), the
 * recent curve with its last point, and the hot lines behind the number,
 * each opening its item. See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): value, viz (a sparkline), list (hot).
 */
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize, CardStatus } from '../../types'
import { metricViz, type MetricSeries } from './viz'

interface MetricData {
  value: number
  label?: string
  badge?: string
  delta?: { value: number; period?: string }
  /** One series (a list of numbers) or several, `{ label, points, tone }` (#5441) */
  series?: MetricSeries
  hot?: Array<{ label: string; tag?: string; tagStatus?: CardStatus; to?: RouteLocationRaw }>
}
interface MetricOptions {
  unit?: string
  decimals?: number
  higherIs?: 'better' | 'worse' | 'neutral'
  hotCount?: number
  /** line (default), area, bars, or a chart the app registered (#5441) */
  chart?: string
  stacked?: boolean
}

const props = defineProps<{ data: MetricData; options: MetricOptions; size: CardSize }>()

const blocks = computed<CardBlock[]>(() => {
  const { data: d, options: o } = props
  const out: CardBlock[] = [{ kind: 'value', value: d.value, label: d.label, badge: d.badge, delta: d.delta, unit: o.unit, decimals: o.decimals, higherIs: o.higherIs }]
  // Several series in a larger card: the full chart, its legend and tooltip (#5441)
  const several = !!d.series?.length && typeof d.series[0] !== 'number' && d.series.length > 1
  const viz = metricViz(d.series, o as Record<string, unknown>, !(several && props.size !== 's'))
  if (viz) out.push(viz)
  if (d.hot?.length) out.push({ kind: 'list', look: 'hot', items: d.hot, max: o.hotCount ?? 2 })
  return out
})
</script>

<template>
  <div class="qd-metric"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
