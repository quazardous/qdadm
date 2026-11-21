/**
 * The card contract (#5339): what qdadm draws (the envelope), what a card
 * type draws (the body), and the sheet each type ships so a person or an
 * agent can choose it without a screen.
 */
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { RunInit } from '../run/run'
import type { CardSchema } from './validate'

/** How things stand: a hue, a side bar and a word, never the hue alone */
export type CardStatus = 'critical' | 'watch' | 'good' | 'info'

/** 1, 2 or 3 columns of the grid */
export type CardSize = 's' | 'm' | 'l'

/** What the envelope draws instead of the body, or `ready` */
export type CardState = 'ready' | 'loading' | 'unreachable' | 'empty' | 'invalid'

/**
 * The main action: a verb with its count, one gesture.
 * `mode: 'next'` opens the most urgent item, `'list'` the filtered list.
 */
export interface CardAction {
  /** The button's words, e.g. "Traiter la 1re" */
  verb: string
  count?: number
  mode?: 'next' | 'list'
  to?: RouteLocationRaw
  /** `mode: 'next'`: the items behind the card, walked one after the other with the run bar (#5343) */
  run?: RunInit
  /** A gesture of the app's own, instead of a route or a run */
  onClick?: () => void | Promise<void>
}

/** What the envelope shows around the body */
export interface CardEnvelope {
  title: string
  /** An icon class beside the title (`pi pi-star`); default the type's own, `null` for none */
  icon?: string | null
  status?: CardStatus
  /** Where the data comes from ("boutique") */
  source?: string
  /** When it was read: a Date, an ISO string or a timestamp */
  freshness?: string | number | Date
  /** The surface: opens the domain's board */
  to?: RouteLocationRaw
  action?: CardAction
  state?: CardState
  size?: CardSize
  /** `unreachable`: why */
  error?: string
  /** `empty`: what to say instead of "Nothing to report" */
  emptyText?: string
}

/** One declared option of a card type */
export interface CardOptionSheet extends CardSchema {
  description: string
}

/** A card type's sheet: read by the gallery, the index and the bestiary */
export interface CardMeta {
  type: string
  /** A short name, "Metric" */
  title: string
  /** The question it answers */
  question: string
  /** The icon its cards show beside their title, unless the envelope says otherwise */
  icon?: string
  /** What each visual channel says */
  readings: string[]
  strengths: string[]
  /** When to choose another card */
  avoid: string[]
  sizes: CardSize[]
  options: Record<string, CardOptionSheet>
  /** The typical main action */
  action: string
  /** A complete example: envelope, data and options */
  example: {
    envelope: CardEnvelope
    data: unknown
    options?: Record<string, unknown>
  }
}

/**
 * A card reduced to a pill (#5389): what the domain bar shows of it. `count`
 * is the badge's number, `null` when the card counts nothing.
 */
export interface CardPill {
  /** The value as written: "14", "68 / 100" */
  value: string
  count: number | null
}

/** A card type, as registerCard takes it */
export interface CardDefinition {
  type: string
  /** The body: props `data`, `options`, `size` */
  component: Component
  meta: CardMeta
  /** The JSON Schema of `data` */
  schema: CardSchema
  /** Its pill form, for the domain bar (#5389); without it, the type is not offered there */
  pill?: (data: unknown, options: Record<string, unknown>, locale: string) => CardPill
}

/** What a body receives */
export interface CardBodyProps<D = unknown, O = Record<string, unknown>> {
  data: D
  options: O
  size: CardSize
}
