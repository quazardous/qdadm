/**
 * The pill form of the generic cards (#5389): the one figure the domain bar
 * keeps of each, and the count its badge shows.
 */
import type { CardPill } from '../types'
import { formatNumber } from './shared'

type Opts = Record<string, unknown>
const fmt = (n: number, o: Opts, locale: string): string =>
  formatNumber(n, locale, { decimals: typeof o.decimals === 'number' ? o.decimals : undefined, unit: typeof o.unit === 'string' ? o.unit : undefined })
const count = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null)

export const PILLS: Record<string, (data: unknown, options: Opts, locale: string) => CardPill> = {
  metric: (d, o, l) => {
    const v = (d as { value: number }).value
    return { value: fmt(v, o, l), count: count(v) }
  },
  queue: (d, _o, l) => {
    const q = d as { total?: number; items: unknown[] }
    const n = q.total ?? q.items.length
    return { value: formatNumber(n, l), count: n }
  },
  goal: (d, o, l) => {
    const g = d as { value: number; target: number }
    return { value: `${fmt(g.value, o, l)} / ${fmt(g.target, o, l)}`, count: null }
  },
  compare: (d, o, l) => {
    const v = (d as { now: { value: number } }).now.value
    return { value: fmt(v, o, l), count: null }
  },
  split: (d, o, l) => {
    const s = d as { total?: number; parts: Array<{ value: number }> }
    const n = s.total ?? s.parts.reduce((sum, p) => sum + p.value, 0)
    return { value: fmt(n, o, l), count: count(n) }
  },
}
