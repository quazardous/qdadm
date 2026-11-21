<script setup lang="ts">
/**
 * viz block (#5414): a small chart, Munin-like, in light SVG.
 *
 * Lines, areas, grouped or stacked bars; one series or several; the band of
 * normal and the points outside it; the warning and critical thresholds as
 * dashed lines. Small (`compact`, the default at size s): a sparkline, no
 * axis. Larger: the time axis, the y range, a legend for several series,
 * and a tooltip per column, on hover or with the arrow keys once focused.
 * A screen reader hears each series' last, lowest and highest value.
 */
import { computed, inject, ref, watchEffect } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { formatNumber } from '../builtin/shared'
import { vizGeometry, timeTicks, periodOf, normalizeSeries, builtinChart } from './viz'
import { getChart, toneColor, CHART_MODE, type ChartProps } from './charts'
import type { VizBlock } from './types'
import type { CardSize } from '../types'

const props = defineProps<{ block: VizBlock; size: CardSize }>()
const { t, locale } = useI18n()

const compact = computed(() => props.block.compact ?? props.size === 's')
const H = computed(() => (compact.value ? 28 : 40))
const geo = computed(() => vizGeometry(props.block, H.value))
const series = computed(() => normalizeSeries(props.block.series))

// The app's chart (#5441): a name it registered draws with its component;
// a name nobody registered, the line
const mode = inject(CHART_MODE, null)
const kind = computed(() => builtinChart(props.block.chart))
const barred = computed(() => kind.value === 'bars' || kind.value === 'stacked')
const appChart = computed(() => (props.block.chart && props.block.chart !== kind.value ? getChart(props.block.chart) : null))
const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true
watchEffect(() => {
  if (!isDev) return
  const name = props.block.chart
  if (name && name !== kind.value && !appChart.value) console.warn(`[qdadm] viz: no chart is named '${name}'; it draws a line. Register it with registerChart('${name}', Component).`)
  if (props.block.stacked && !appChart.value && kind.value === 'line') console.warn('[qdadm] viz: lines do not stack; stacked applies to areas and bars')
})
const chartProps = computed<ChartProps>(() => ({
  series: series.value,
  stacked: !!props.block.stacked || props.block.chart === 'stacked',
  compact: compact.value,
  height: H.value,
  unit: props.block.unit,
  decimals: props.block.decimals,
  warning: props.block.warning,
  critical: props.block.critical,
  normal: props.block.normal,
  label: props.block.label,
  dot: !!props.block.dot,
  colors: series.value.map((s) => toneColor(String(s.tone))),
  mode: mode?.value ?? null,
}))
const fmt = (v: number) => formatNumber(v, locale.value, { decimals: props.block.decimals, unit: props.block.unit })
const pct = (y: number) => `${(y / H.value) * 100}%`

// The time span, its period, its ticks
const span = computed(() => {
  const cols = geo.value.columns.filter((c) => c.t !== null)
  if (!geo.value.timed || cols.length < 2) return null
  const ts = cols.map((c) => c.t as number)
  return { min: Math.min(...ts), max: Math.max(...ts) }
})
const period = computed(() => props.block.period ?? (span.value ? periodOf(span.value.max - span.value.min) : null))
const ticks = computed(() => {
  if (compact.value || !span.value) return []
  const raw = timeTicks(span.value.min, span.value.max, locale.value, period.value ?? undefined)
  // Bars sit in columns: a tick goes to its column's centre
  if (barred.value) {
    const cols = geo.value.columns
    return raw.map((tk) => {
      let best = cols[0]!
      for (const c of cols) if (Math.abs((c.t ?? 0) - tk.t) < Math.abs((best.t ?? 0) - tk.t)) best = c
      return { ...tk, x: best.x }
    })
  }
  return raw
})

const whenFmt = computed(() => {
  if (period.value === '24h') return new Intl.DateTimeFormat(locale.value, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'short' })
})
const when = (tm: number | null, i: number) => (tm === null ? `#${i + 1}` : whenFmt.value.format(new Date(tm)))

/** What a screen reader hears */
const summary = computed(() => {
  const parts = series.value.map((s) => {
    const vs = s.points.map((p) => p.v)
    if (!vs.length) return ''
    return t('core.cards.viz.series', {
      label: s.label || props.block.label || '',
      last: fmt(vs[vs.length - 1]!),
      min: fmt(Math.min(...vs)),
      max: fmt(Math.max(...vs)),
    })
  })
  const head = props.block.label ? `${props.block.label}. ` : ''
  const per = period.value ? ` ${t(`core.cards.viz.period.${period.value}`)}.` : ''
  return `${head}${parts.filter(Boolean).join('; ')}.${per}`
})

// The tooltip: one column at a time, by pointer or by keyboard
const active = ref<number | null>(null)
const keyboard = ref(false)
const plot = ref<HTMLElement | null>(null)
function onMove(e: MouseEvent): void {
  const el = plot.value
  if (!el || !geo.value.columns.length) return
  const r = el.getBoundingClientRect()
  const x = ((e.clientX - r.left) / (r.width || 1)) * 100
  let best = 0
  geo.value.columns.forEach((c, i) => {
    if (Math.abs(c.x - x) < Math.abs(geo.value.columns[best]!.x - x)) best = i
  })
  keyboard.value = false
  active.value = best
}
function onKey(e: KeyboardEvent): void {
  const n = geo.value.columns.length
  if (!n) return
  const at = active.value ?? n - 1
  const next = e.key === 'ArrowLeft' ? Math.max(0, at - 1) : e.key === 'ArrowRight' ? Math.min(n - 1, at + 1) : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : e.key === 'Escape' ? null : undefined
  if (next === undefined) return
  e.preventDefault()
  keyboard.value = true
  active.value = next
}
const column = computed(() => (active.value === null ? null : geo.value.columns[active.value] ?? null))
const tipText = computed(() => {
  const c = column.value
  if (!c) return ''
  const vals = c.values.filter((v) => v.v !== null).map((v) => `${v.label ? `${v.label} ` : ''}${fmt(v.v!)}`)
  return `${when(c.t, active.value!)}: ${vals.join(', ')}`
})
const tipSide = computed(() => (column.value && column.value.x > 60 ? 'left' : 'right'))
</script>

<template>
  <!-- The app's own chart (#5441) -->
  <div v-if="appChart" class="qd-viz qd-card-block" :class="{ 'qd-viz--compact': compact }" data-block="viz" :data-chart="block.chart" data-app-chart>
    <component :is="appChart" v-bind="chartProps" />
    <span v-if="compact" class="qd-card-sr">{{ summary }}</span>
  </div>
  <div v-else class="qd-viz qd-card-block" :class="{ 'qd-viz--compact': compact }" data-block="viz" :data-chart="kind" :data-stacked="chartProps.stacked || undefined">
    <div
      ref="plot"
      class="qd-viz-plot"
      :tabindex="compact ? undefined : 0"
      :role="compact ? undefined : 'group'"
      :aria-label="compact ? undefined : summary"
      :aria-hidden="compact ? 'true' : undefined"
      @mousemove="compact ? undefined : onMove($event)"
      @mouseleave="active = null"
      @focus="active = active ?? geo.columns.length - 1"
      @blur="active = null"
      @keydown="compact ? undefined : onKey($event)"
    >
      <svg :viewBox="`0 0 100 ${H}`" preserveAspectRatio="none" aria-hidden="true">
        <path v-if="geo.band" :d="geo.band" class="qd-trend-band" />
        <line
          v-for="th in geo.thresholds"
          :key="th.level"
          x1="0"
          x2="100"
          :y1="th.y"
          :y2="th.y"
          class="qd-viz-threshold"
          :data-level="th.level"
          vector-effect="non-scaling-stroke"
        />
        <template v-for="(l, i) in geo.lines" :key="`l${i}`">
          <path v-if="l.area" :d="l.area" :class="l.tone === 'lead' ? 'qd-spark-area' : 'qd-viz-area'" :data-tone="l.tone" />
          <path :d="l.line" :class="l.tone === 'lead' ? 'qd-spark-line' : 'qd-viz-line'" :data-tone="l.tone" vector-effect="non-scaling-stroke" />
        </template>
        <rect v-for="(b, i) in geo.bars" :key="`b${i}`" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="qd-viz-bar" :data-tone="b.tone" />
      </svg>
      <span v-if="block.dot && geo.last" class="qd-spark-dot" :style="{ left: `${geo.last.x}%`, top: pct(geo.last.y) }"></span>
      <span v-for="(o, i) in geo.outside" :key="`o${i}`" class="qd-trend-out" :style="{ left: `${o.x}%`, top: pct(o.y) }"></span>
      <template v-if="!compact">
        <span v-for="th in geo.thresholds" :key="`t${th.level}`" class="qd-viz-threshold-label" :data-level="th.level" :style="{ top: pct(th.y) }">
          {{ fmt(th.value) }}
        </span>
        <span class="qd-viz-y qd-viz-y--max" aria-hidden="true">{{ fmt(geo.max) }}</span>
        <span class="qd-viz-y qd-viz-y--min" aria-hidden="true">{{ fmt(geo.min) }}</span>
        <template v-if="column">
          <span class="qd-viz-guide" :class="{ 'qd-viz-guide--bar': barred }" :style="{ left: `${column.x}%` }" aria-hidden="true"></span>
          <span class="qd-viz-tip" :data-side="tipSide" :style="{ left: `${column.x}%` }" aria-hidden="true" data-viz-tip>
            <span class="qd-viz-tip-when">{{ when(column.t, active!) }}</span>
            <span v-for="(v, i) in column.values" :key="i" class="qd-viz-tip-row">
              <span class="qd-viz-swatch" :data-tone="v.tone" aria-hidden="true"></span>
              <span v-if="v.label" class="qd-viz-tip-label">{{ v.label }}</span>
              <span class="qd-viz-tip-value">{{ v.v === null ? '—' : fmt(v.v) }}</span>
            </span>
          </span>
        </template>
      </template>
    </div>
    <div v-if="ticks.length" class="qd-viz-ticks" aria-hidden="true">
      <!-- A tick at an edge stays inside the card -->
      <span v-for="tk in ticks" :key="tk.t" :style="{ left: `${tk.x}%` }" :data-edge="tk.x > 92 ? 'end' : tk.x < 8 ? 'start' : undefined">{{ tk.label }}</span>
    </div>
    <ul v-if="!compact && series.length > 1" class="qd-viz-legend">
      <li v-for="(s, i) in series" :key="i">
        <span class="qd-viz-swatch" :data-tone="s.tone" aria-hidden="true"></span>{{ s.label }}
      </li>
    </ul>
    <span v-if="!compact" class="qd-card-sr" aria-live="polite">{{ keyboard ? tipText : '' }}</span>
    <!-- A sparkline of several series: their names and values for screen readers (#5441) -->
    <span v-else-if="series.length > 1" class="qd-card-sr">{{ summary }}</span>
  </div>
</template>
