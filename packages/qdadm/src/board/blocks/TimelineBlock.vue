<script setup lang="ts">
/**
 * timeline (#5352): the volume over time. One bar per day (or hour), the
 * latest marked; the total over the period and its change against the one
 * before, signed and in words. Each bar's title gives its date and count.
 */
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber, formatDelta, deltaTone } from '../../cards/builtin/shared'

const props = defineProps<{
  data: {
    points: Array<{ at: string | number; value: number }>
    bucket?: 'day' | 'hour'
    label?: string
    previous?: number
    higherIs?: 'better' | 'worse' | 'neutral'
  }
}>()
const { t, locale } = useI18n()

const total = computed(() => props.data.points.reduce((sum, p) => sum + p.value, 0))
const max = computed(() => Math.max(0, ...props.data.points.map((p) => p.value)))
const when = (at: string | number) => {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return String(at)
  return props.data.bucket === 'hour'
    ? d.toLocaleString(locale.value, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale.value, { weekday: 'short', day: 'numeric', month: 'short' })
}
const bars = computed(() =>
  props.data.points.map((p, i) => ({
    height: max.value ? Math.max(2, (p.value / max.value) * 100) : 2,
    latest: i === props.data.points.length - 1,
    title: `${when(p.at)}: ${formatNumber(p.value, locale.value)}${props.data.label ? ` ${props.data.label}` : ''}`,
  }))
)
const change = computed(() => {
  if (props.data.previous === undefined) return null
  const delta = total.value - props.data.previous
  if (delta === 0) return { text: t('core.board.same'), tone: 'neutral' }
  return { text: t('core.board.change', { change: formatDelta(delta, locale.value) }), tone: deltaTone(delta, props.data.higherIs ?? 'neutral') }
})
const first = computed(() => (props.data.points[0] ? when(props.data.points[0].at) : ''))
const last = computed(() => (props.data.points.length ? when(props.data.points[props.data.points.length - 1]!.at) : ''))
</script>

<template>
  <div class="qd-board-timeline">
    <div class="qd-board-timeline-head">
      <span class="qd-board-kpi-value">{{ formatNumber(total, locale) }}</span>
      <span v-if="data.label" class="qd-board-timeline-label">{{ data.label }}</span>
      <span v-if="change" class="qd-card-delta" :class="`qd-tone--${change.tone}`">{{ change.text }}</span>
    </div>
    <ol class="qd-board-timeline-bars" :aria-label="t('core.board.timelineBars', { from: first, to: last })">
      <li v-for="(b, i) in bars" :key="i" :class="{ 'qd-board-timeline-latest': b.latest }" :title="b.title">
        <span class="qd-board-timeline-bar" :style="{ height: `${b.height}%` }"></span>
        <span class="qd-cards-sr">{{ b.title }}</span>
      </li>
    </ol>
    <div class="qd-board-timeline-axis" aria-hidden="true"><span>{{ first }}</span><span>{{ last }}</span></div>
  </div>
</template>
