<script setup lang="ts">
/**
 * trend - is this normal? (#5355)
 *
 * The curve, the band of normal (one for the whole curve, or one per point),
 * and the points outside it marked and counted in words. The last value is
 * written. See meta.json for the sheet.
 *
 * An assembly of blocks (#5414): value (the last), viz (the curve and its
 * band), text (the reading).
 */
import { computed } from 'vue'
import { useI18n } from '../../../i18n/useI18n'
import QdCardBlocks from '../../blocks/QdCardBlocks.vue'
import type { CardBlock } from '../../blocks/types'
import type { CardSize } from '../../types'

interface Point {
  value: number
  at?: string | number
  low?: number
  high?: number
}
const props = defineProps<{
  data: { series: Point[]; normal?: { low: number; high: number }; label?: string }
  options: { unit?: string; decimals?: number; chart?: string }
  size: CardSize
}>()
const { t } = useI18n()

const blocks = computed<CardBlock[]>(() => {
  const { data: d, options: o } = props
  const out: CardBlock[] = []
  const last = d.series[d.series.length - 1]
  if (last) out.push({ kind: 'value', value: last.value, label: d.label, unit: o.unit, decimals: o.decimals })
  out.push({
    kind: 'viz',
    // line (default), area, or a chart the app registered (#5441)
    chart: typeof o.chart === 'string' && o.chart ? o.chart : 'line',
    series: [{ points: d.series.map((p) => ({ ...(p.at !== undefined ? { t: p.at } : {}), v: p.value, ...(p.low !== undefined ? { low: p.low } : {}), ...(p.high !== undefined ? { high: p.high } : {}) })) }],
    ...(d.normal ? { normal: d.normal } : {}),
    unit: o.unit,
    decimals: o.decimals,
    label: d.label,
  })
  // The reading: how many points fall outside their band
  const band = (p: Point) => ({ low: p.low ?? d.normal?.low, high: p.high ?? d.normal?.high })
  const hasBand = d.series.some((p) => band(p).low !== undefined && band(p).high !== undefined)
  if (hasBand) {
    const outside = d.series.filter((p) => {
      const b = band(p)
      return (b.low !== undefined && p.value < b.low) || (b.high !== undefined && p.value > b.high)
    }).length
    out.push(outside ? { kind: 'text', look: 'reading', text: t('core.cards.trend.outside', { count: outside }), tone: 'watch' } : { kind: 'text', look: 'reading', text: t('core.cards.trend.within') })
  }
  return out
})
</script>

<template>
  <div class="qd-trend"><QdCardBlocks :blocks="blocks" :size="size" /></div>
</template>
