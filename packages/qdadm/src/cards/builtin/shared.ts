/**
 * What qdadm's generic cards share (#5339): numbers in the app's language,
 * the line of a series.
 */

/** A number as the app's locale writes it, with a unit when given */
export function formatNumber(value: number, locale: string, { decimals, unit }: { decimals?: number; unit?: string } = {}): string {
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 2,
  }).format(value)
  if (!unit) return text
  // "12 %", "412 k€": a narrow no-break space, as French writes it; "%"-led units stay glued in English
  return /^[%‰]$/.test(unit) && locale.startsWith('en') ? `${text}${unit}` : `${text}\u202f${unit}`
}

/** A signed change: "+4", "−1,3" */
export function formatDelta(value: number, locale: string, decimals?: number): string {
  const text = formatNumber(Math.abs(value), locale, { decimals })
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}

/** Points of a series in a box of width × height, the y axis going down */
export function seriesPoints(series: number[], width: number, height: number, pad = 2): Array<[number, number]> {
  if (series.length === 0) return []
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const step = series.length > 1 ? width / (series.length - 1) : 0
  return series.map((v, i) => [i * step, pad + (height - 2 * pad) * (1 - (v - min) / span)])
}

/** The line and the area under it, as SVG paths */
export function seriesPaths(series: number[], width: number, height: number): { line: string; area: string } {
  const pts = seriesPoints(series, width, height)
  if (pts.length === 0) return { line: '', area: '' }
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1]![0].toFixed(2)},${height} L0,${height} Z`
  return { line, area }
}

/** Whether a change is good news, given which way is better */
export function deltaTone(value: number, higherIs: 'better' | 'worse' | 'neutral' = 'better'): 'good' | 'critical' | 'neutral' {
  if (value === 0 || higherIs === 'neutral') return 'neutral'
  return (value > 0) === (higherIs === 'better') ? 'good' : 'critical'
}

/** "3 minutes ago", "yesterday": a moment against now, in the app's language */
export function relativeTime(at: string | number | Date, locale: string, now = Date.now()): string | null {
  const date = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(date.getTime())) return null
  const seconds = Math.round((date.getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 45) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
}
