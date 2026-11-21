/**
 * The viz block's geometry (#5414): series to SVG paths and bars in a
 * 100 × H box (the y axis going down), the band of normal, the thresholds,
 * the points outside the band, the columns the tooltip reads, the time ticks.
 * Pure functions: the component draws, the tests measure.
 */
import type { VizBlock, VizPoint, VizSeries, BlockTone } from './types'

export interface NormalPoint {
  /** A time in ms, or null when the series has none */
  t: number | null
  v: number
  low?: number
  high?: number
}

export interface NormalSeries {
  label: string
  tone: BlockTone | string
  points: NormalPoint[]
}

/** A time: an ISO string, or a timestamp in ms; a small number is no time */
function toTime(t: unknown): number | null {
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof t === 'number' && t > 1e11) return t
  return null
}

function toPoint(p: VizPoint): NormalPoint {
  if (typeof p === 'number') return { t: null, v: p }
  if (Array.isArray(p)) return { t: toTime(p[0]), v: Number(p[1]) }
  return { t: toTime(p.t), v: p.v, ...(p.low !== undefined ? { low: p.low } : {}), ...(p.high !== undefined ? { high: p.high } : {}) }
}

/** The block's series, each point read; a list of numbers is one series */
export function normalizeSeries(series: VizBlock['series']): NormalSeries[] {
  if (series.length && series.every((s) => typeof s === 'number')) {
    return [{ label: '', tone: 'lead', points: (series as number[]).map((v) => ({ t: null, v })) }]
  }
  return (series as VizSeries[]).map((s, i) => ({
    label: s.label ?? '',
    tone: s.tone !== undefined ? String(s.tone) : series.length > 1 ? String(i + 1) : 'lead',
    points: s.points.map(toPoint),
  }))
}

export interface VizColumn {
  /** Its x in the box (0 to 100) */
  x: number
  t: number | null
  values: Array<{ label: string; tone: string; v: number | null }>
}

export interface VizGeometry {
  width: number
  height: number
  min: number
  max: number
  timed: boolean
  y: (v: number) => number
  lines: Array<{ tone: string; line: string; area: string }>
  bars: Array<{ tone: string; x: number; y: number; w: number; h: number }>
  band: string
  thresholds: Array<{ level: 'warning' | 'critical'; value: number; y: number }>
  outside: Array<{ x: number; y: number; v: number }>
  columns: VizColumn[]
  last: { x: number; y: number } | null
}

const f = (n: number) => n.toFixed(2)

export function vizGeometry(block: VizBlock, height: number, pad = 3): VizGeometry {
  const W = 100
  const H = height
  const chart = block.chart ?? 'line'
  const series = normalizeSeries(block.series)
  const n = Math.max(0, ...series.map((s) => s.points.length))
  const timed = series.length > 0 && series.every((s) => s.points.length > 0 && s.points.every((p) => p.t !== null))
  const barred = chart === 'bars' || chart === 'stacked'

  // The x of point i of a series: by time when every point has one, else by rank
  const times = timed ? series.flatMap((s) => s.points.map((p) => p.t as number)) : []
  const tMin = timed ? Math.min(...times) : 0
  const tSpan = timed ? Math.max(...times) - tMin || 1 : 1
  const band = n ? W / n : W
  const xAt = (p: NormalPoint, i: number): number => {
    if (barred) return band * (i + 0.5)
    if (timed) return ((p.t! - tMin) / tSpan) * W
    return n > 1 ? (i / (n - 1)) * W : W / 2
  }

  // The bands of normal: the point's own, else the block's
  const lows = (p: NormalPoint) => p.low ?? block.normal?.low
  const highs = (p: NormalPoint) => p.high ?? block.normal?.high

  // The range: values (sums when stacked), bands, thresholds; bars start at 0
  const values: number[] = []
  if (chart === 'stacked') {
    for (let i = 0; i < n; i++) values.push(series.reduce((sum, s) => sum + (s.points[i]?.v ?? 0), 0))
  } else {
    for (const s of series) for (const p of s.points) values.push(p.v)
  }
  for (const s of series) for (const p of s.points) {
    const lo = lows(p)
    const hi = highs(p)
    if (lo !== undefined) values.push(lo)
    if (hi !== undefined) values.push(hi)
  }
  if (block.warning !== undefined) values.push(block.warning)
  if (block.critical !== undefined) values.push(block.critical)
  if (barred) values.push(0)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const span = max - min || 1
  const y = (v: number) => pad + (H - 2 * pad) * (1 - (v - min) / span)

  const lines: VizGeometry['lines'] = []
  const bars: VizGeometry['bars'] = []
  if (!barred) {
    for (const s of series) {
      if (!s.points.length) continue
      const pts = s.points.map((p, i) => [xAt(p, i), y(p.v)] as const)
      const line = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${f(x)},${f(yy)}`).join(' ')
      const area = chart === 'area' ? `${line} L${f(pts[pts.length - 1]![0])},${H} L${f(pts[0]![0])},${H} Z` : ''
      lines.push({ tone: s.tone, line, area })
    }
  } else {
    const group = band * 0.7
    const zero = y(Math.max(min, 0))
    for (let i = 0; i < n; i++) {
      const left = band * i + (band - group) / 2
      if (chart === 'stacked') {
        let acc = 0
        for (const s of series) {
          const v = s.points[i]?.v ?? 0
          const top = y(acc + v)
          const bottom = y(acc)
          bars.push({ tone: s.tone, x: left, y: Math.min(top, bottom), w: group, h: Math.abs(bottom - top) })
          acc += v
        }
      } else {
        const w = group / (series.length || 1)
        series.forEach((s, k) => {
          const v = s.points[i]?.v
          if (v === undefined) return
          const top = y(v)
          bars.push({ tone: s.tone, x: left + w * k, y: Math.min(top, zero), w, h: Math.abs(zero - top) })
        })
      }
    }
  }

  // The band of normal, along the first series
  let bandPath = ''
  const first = series[0]
  if (first) {
    const pts = first.points.map((p, i) => ({ i, p, lo: lows(p), hi: highs(p) })).filter((q) => q.lo !== undefined && q.hi !== undefined)
    if (pts.length >= 2) {
      const top = pts.map((q, k) => `${k ? 'L' : 'M'}${f(xAt(q.p, q.i))},${f(y(q.hi!))}`).join(' ')
      const bottom = [...pts].reverse().map((q) => `L${f(xAt(q.p, q.i))},${f(y(q.lo!))}`).join(' ')
      bandPath = `${top} ${bottom} Z`
    }
  }

  const outside: VizGeometry['outside'] = []
  if (first && !barred) {
    first.points.forEach((p, i) => {
      const lo = lows(p)
      const hi = highs(p)
      if ((lo !== undefined && p.v < lo) || (hi !== undefined && p.v > hi)) outside.push({ x: xAt(p, i), y: y(p.v), v: p.v })
    })
  }

  const thresholds: VizGeometry['thresholds'] = []
  if (block.warning !== undefined) thresholds.push({ level: 'warning', value: block.warning, y: y(block.warning) })
  if (block.critical !== undefined) thresholds.push({ level: 'critical', value: block.critical, y: y(block.critical) })

  const columns: VizColumn[] = []
  for (let i = 0; i < n; i++) {
    const ref = series.find((s) => s.points[i])!.points[i]!
    columns.push({ x: xAt(ref, i), t: ref.t, values: series.map((s) => ({ label: s.label, tone: s.tone, v: s.points[i]?.v ?? null })) })
  }

  const lastPoint = first?.points.at(-1)
  const last = lastPoint && !barred ? { x: xAt(lastPoint, first!.points.length - 1), y: y(lastPoint.v) } : null

  return { width: W, height: H, min, max, timed, y, lines, bars, band: bandPath, thresholds, outside, columns, last }
}

export type VizPeriod = '24h' | '7d' | '30d'

/** The period a span of time reads best in */
export function periodOf(spanMs: number): VizPeriod {
  const day = 86_400_000
  if (spanMs <= 1.5 * day) return '24h'
  if (spanMs <= 10 * day) return '7d'
  return '30d'
}

/**
 * The time axis: a few readable ticks between two times, at their x (0 to
 * 100). 24h: every 6 hours, "14:00"; 7d: every day, "Mon"; 30d: every week,
 * "12 Nov". Local time.
 */
export function timeTicks(tMin: number, tMax: number, locale: string, period?: VizPeriod): Array<{ x: number; label: string; t: number }> {
  if (!(tMax > tMin)) return []
  const p = period ?? periodOf(tMax - tMin)
  const ticks: Array<{ x: number; label: string; t: number }> = []
  const start = new Date(tMin)
  let fmt: Intl.DateTimeFormat
  let next: (d: Date) => void
  if (p === '24h') {
    start.setMinutes(0, 0, 0)
    if (start.getTime() < tMin) start.setHours(start.getHours() + 1)
    while (start.getHours() % 6 !== 0) start.setHours(start.getHours() + 1)
    fmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
    next = (d) => d.setHours(d.getHours() + 6)
  } else {
    start.setHours(0, 0, 0, 0)
    if (start.getTime() < tMin) start.setDate(start.getDate() + 1)
    fmt = p === '7d' ? new Intl.DateTimeFormat(locale, { weekday: 'short' }) : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    next = p === '7d' ? (d) => d.setDate(d.getDate() + 1) : (d) => d.setDate(d.getDate() + 7)
  }
  for (const d = start; d.getTime() <= tMax && ticks.length < 40; next(d)) {
    ticks.push({ x: ((d.getTime() - tMin) / (tMax - tMin)) * 100, label: fmt.format(d), t: d.getTime() })
  }
  // At most 8 labels: every other one past that
  while (ticks.length > 8) {
    for (let i = ticks.length - 1; i > 0; i -= 2) ticks.splice(i, 1)
  }
  return ticks
}
