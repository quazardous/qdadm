/**
 * The metric's curve (#5441), one builder for the card and its domain bar
 * pill, so a series reads the same in both: one series or several (in, out…),
 * the chart the app picks (a line by default, an area, bars, or a chart it
 * registered), stacked or not. A sparkline, except in a card at size m or
 * l with several series: the time axis, the legend, the tooltip.
 */
import type { VizBlock, VizSeries } from '../../blocks/types'

export type MetricSeries = number[] | VizSeries[]

/** The viz block of a metric's series, or null when there is no curve to draw */
export function metricViz(series: MetricSeries | undefined, options: Record<string, unknown>, compact = true): VizBlock | null {
  if (!series?.length) return null
  const numbers = series.every((s) => typeof s === 'number')
  const drawable = numbers ? series.length > 1 : (series as VizSeries[]).some((s) => s.points.length > 1)
  if (!drawable) return null
  const chart = typeof options.chart === 'string' && options.chart ? options.chart : 'line'
  return {
    kind: 'viz',
    chart,
    ...(options.stacked === true ? { stacked: true } : {}),
    series,
    compact,
    dot: true,
    ...(typeof options.unit === 'string' ? { unit: options.unit } : {}),
    ...(typeof options.decimals === 'number' ? { decimals: options.decimals } : {}),
  }
}
