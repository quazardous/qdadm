/**
 * A block of QdDomainBoard, as the app declares it (#5352).
 */
import type { RouteLocationRaw } from 'vue-router'

export interface BoardBlock {
  /** kpi, breakdown, top, timeline, or a type the app registered */
  type: string
  /** Its key (default its index) */
  id?: string
  /** Its heading; a kpi carries its own label */
  title?: string
  /** Columns of 12; default the type's */
  span?: number
  /** The data, when the app has it already */
  data?: unknown
  /** Or how to read it: the block waits alone, and says when it failed */
  load?: () => unknown | Promise<unknown>
  /** "All 69 →": the full list */
  more?: { label: string; to: RouteLocationRaw }
  /** What to say when there is nothing */
  emptyText?: string
}

/** Where the board's data comes from, and how fresh it is */
export interface BoardSource {
  label: string
  /** When it was read: a Date, an ISO string or a timestamp */
  freshness?: string | number | Date
  /** The source itself (an internal route or an outside address) */
  to?: RouteLocationRaw
}
