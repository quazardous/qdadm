/**
 * The blocks a card is made of (#5414): a card is a few blocks in the order
 * the app gives, its foot the shared CTA zone. qdadm's card types are
 * ready-made assemblies of them; an app composes its own.
 */
import type { RouteLocationRaw } from 'vue-router'
import type { CardStatus } from '../types'

export type BlockTone = CardStatus | 'neutral'
export type HigherIs = 'better' | 'worse' | 'neutral'

/** The number, its unit, a short word, its change; or now against then */
export interface ValueBlock {
  kind: 'value'
  value: number
  unit?: string
  decimals?: number
  /** After the value: what is counted ("orders"), "of 100"… */
  label?: string
  /** A short word beside it, in the card's status tone: "5 urgent" */
  badge?: string
  /** The change over the period, signed */
  delta?: { value: number; period?: string }
  /** Which way is good news, for the change's tone */
  higherIs?: HigherIs
  /** A value to compare with: drawn beside, the change computed from it */
  then?: { value: number; label?: string }
  /** The change against `then`: in the unit's points (default) or in percent */
  changeAs?: 'points' | 'percent'
}

/** One point: a value, `[time, value]`, or `{ t, v, low, high }` */
export type VizPoint = number | [string | number, number] | { t?: string | number; v: number; low?: number; high?: number }

export interface VizSeries {
  label?: string
  points: VizPoint[]
  /** A status tone, or a palette rank (1 to 6); default by rank */
  tone?: BlockTone | 1 | 2 | 3 | 4 | 5 | 6
}

/** A small chart, Munin-like */
export interface VizBlock {
  kind: 'viz'
  /**
   * line (default), area, bars (grouped), stacked (bars); or the name of a
   * chart the app registered (#5441), drawn by its component
   */
  chart?: 'line' | 'area' | 'bars' | 'stacked' | (string & {})
  /** Stack the series (#5441): areas, each on the one below, or bars */
  stacked?: boolean
  /** Its series, as many as it takes; a list of numbers is one series */
  series: VizSeries[] | number[]
  /** The time it covers, for the axis: computed from the points when left out */
  period?: '24h' | '7d' | '30d'
  /** Munin's thresholds: a dashed line each, in its tone */
  warning?: number
  critical?: number
  /** A band of normal for the whole chart (a point may carry its own low/high) */
  normal?: { low: number; high: number }
  unit?: string
  decimals?: number
  /** A sparkline: no axis, no legend, no tooltip (default: at size s) */
  compact?: boolean
  /** Mark the last point (a sparkline's dot) */
  dot?: boolean
  /** What the chart is, for screen readers and its tooltip: "errors a day" */
  label?: string
}

export interface ListItem {
  label: string
  to?: RouteLocationRaw
  /** A short word on the right, its tone */
  tag?: string
  tagStatus?: CardStatus
  /** feed: when it happened; and its status */
  at?: string | number
  status?: CardStatus
  /** ranking: its value */
  value?: number
  /** queue: its age against the promised delay, and its gesture */
  age?: number
  due?: number
  action?: { verb: string; to: RouteLocationRaw }
}

/** Lines: hot lines, a queue, a feed, a ranking */
export interface ListBlock {
  kind: 'list'
  /** hot (default): label and tag; queue: age and gesture; feed: when and status; ranking: rank, value, bar */
  look?: 'hot' | 'queue' | 'feed' | 'ranking'
  items: ListItem[]
  /** How many are shown */
  max?: number
  /** "N more" under them, when some are not shown */
  more?: boolean
  /** feed: the moment the times are read against */
  now?: string | number
  /** queue: the unit of the ages */
  ageUnit?: 'min' | 'h' | 'd'
  /** ranking: the values' unit; a bar per line */
  unit?: string
  bars?: boolean
}

/** A short text, its tone; a word in bold after it */
export interface TextBlock {
  kind: 'text'
  text: string
  /** note (default): a paragraph; reading: one tight line under a chart */
  look?: 'note' | 'reading'
  tone?: BlockTone
  strong?: string
}

/** A value against a target: goal (the pace) or bullet (poor / fair / good) */
export interface ProgressBlock {
  kind: 'progress'
  look?: 'goal' | 'bullet'
  value: number
  target?: number
  /** goal: the period, for the expected pace */
  start?: string
  due?: string
  now?: string
  /** bullet: the cuts between poor, fair and good; its scale */
  thresholds?: number[]
  min?: number
  max?: number
  higherIs?: 'better' | 'worse'
  unit?: string
  decimals?: number
}

/** A whole in parts: one split bar and its legend */
export interface PartsBlock {
  kind: 'parts'
  parts: Array<{ label: string; value: number; to?: RouteLocationRaw }>
  /** Past this many, the rest is "others" */
  max?: number
  unit?: string
}

export type FlashLevel = 'info' | 'warning' | 'critical'

export interface FlashMessage {
  level: FlashLevel
  text: string
  /** Where the line leads */
  to?: RouteLocationRaw
}

/**
 * A "flash info" banner: an urgent word about the card (a source down, a
 * threshold crossed). Its place in the card, whatever its place in the list
 */
export interface FlashBlock {
  kind: 'flash'
  /** top (default): under the header; bottom: above the foot */
  place?: 'top' | 'bottom'
  messages?: FlashMessage[]
  /** One message, short */
  level?: FlashLevel
  text?: string
  to?: RouteLocationRaw
  /** A × that hides it until the card is drawn again */
  dismissible?: boolean
  /** With dismissible: hidden for the browser session */
  id?: string
}

export type CardBlock = ValueBlock | VizBlock | ListBlock | TextBlock | ProgressBlock | PartsBlock | FlashBlock
export type CardBlockKind = CardBlock['kind']
