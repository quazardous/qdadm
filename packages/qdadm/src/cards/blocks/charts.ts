/**
 * The app's own charts (#5441): a chart registered under a name draws every
 * `chart: '<name>'`, in a viz block, a metric card and its domain bar pill.
 * qdadm keeps no charting library: the app wraps the one it likes.
 */
import { markRaw, type Component, type InjectionKey, type Ref } from 'vue'
import type { CardPillMode } from '../types'
import type { NormalSeries } from './viz'

/** qdadm's own charts; a name the app cannot take */
export const BUILTIN_CHARTS = ['line', 'area', 'bars', 'stacked'] as const
export type BuiltinChart = (typeof BUILTIN_CHARTS)[number]

/** What an app's chart receives */
export interface ChartProps {
  /** The series, each point read: `{ t, v, low, high }`, `t` a timestamp or null */
  series: NormalSeries[]
  /** Stack the series */
  stacked: boolean
  /** A sparkline: no axis, no legend, no tooltip */
  compact: boolean
  /** Its height in pixels, as qdadm's own chart would take */
  height: number
  unit?: string
  decimals?: number
  warning?: number
  critical?: number
  normal?: { low: number; high: number }
  /** What the chart is: "errors a day" */
  label?: string
  /** Mark the last point */
  dot: boolean
  /**
   * Each series' colour, by its tone, as a CSS value (`var(--qd-cat-1)`):
   * read it with getComputedStyle when the library wants a colour
   */
  colors: string[]
  /** In a domain bar: its mode; null elsewhere */
  mode: CardPillMode | null
}

const charts = new Map<string, Component>()

/** Register the app's chart under a name: `chart: '<name>'` then draws with it */
export function registerChart(name: string, component: Component): void {
  if (!name) throw new Error('[qdadm] registerChart: a chart needs a name')
  if ((BUILTIN_CHARTS as readonly string[]).includes(name)) throw new Error(`[qdadm] registerChart('${name}'): qdadm draws '${name}' itself; give your chart another name`)
  if (charts.has(name)) console.warn(`[qdadm] registerChart('${name}'): replaces the chart already registered`)
  charts.set(name, markRaw(component))
}

export function getChart(name: string): Component | null {
  return charts.get(name) ?? null
}

export function listCharts(): string[] {
  return [...charts.keys()]
}

/** Tests only */
export function resetCharts(): void {
  charts.clear()
}

/** The CSS colour of a tone: a status, a palette rank, or the lead */
export function toneColor(tone: string): string {
  if (tone === 'lead') return 'var(--qd-lead)'
  if (/^[1-6]$/.test(tone)) return `var(--qd-cat-${tone})`
  return `var(--qd-tone-${tone})`
}

/** The domain bar tells the charts in it its mode */
export const CHART_MODE: InjectionKey<Ref<CardPillMode>> = Symbol('qdChartMode')
