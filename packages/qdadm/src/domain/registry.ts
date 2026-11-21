/**
 * Domains (#5389): a part of the app with a bar of its own on top of every
 * one of its pages: its navigation and a row of indicators, mini cards each
 * read from its own source, their counts as badges.
 *
 * A page belongs to a domain:
 * 1. when its route says so (`meta.domain`);
 * 2. when its entity is one the domain lists (`entities`), from any module;
 * 3. when the module that declared the domain declared the route too.
 */
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'
import type { CardStatus } from '../cards/types'

/** One permanent indicator: a card of a registered type, drawn as a pill */
export interface DomainIndicator {
  /** Named by the nav entries that show its badge */
  id: string
  /** The card type (metric, queue, goal, compare, split, or one of the app's) */
  card: string
  /** Its name, read beside the pill and by screen readers */
  title: string
  icon?: string
  /** The data, as the card type takes it */
  data?: unknown
  /** Or read it: called at once, then every `refresh` seconds */
  load?: () => unknown | Promise<unknown>
  /** Seconds between two reads (default: none) */
  refresh?: number
  /** The card type's options */
  options?: Record<string, unknown>
  /** How things stand: fixed, or from the data */
  status?: CardStatus | ((data: unknown) => CardStatus | undefined | null)
  /** Where the pill leads */
  to?: RouteLocationRaw
}

/** One entry of the domain's navigation */
export interface DomainNavEntry {
  label: string
  icon?: string
  /** A route name, or `to` */
  route?: string
  to?: RouteLocationRaw
  /** The id of the indicator whose count shows as this entry's badge */
  badge?: string
}

/**
 * How the bar sits (#5400): `toolbox` (the default), one low line glued to the
 * top edge of the content, drawn like the side menu; `card`, a card above the
 * page. `ribbon` (#5396) is withdrawn: it draws the toolbox, with a warning.
 */
export type DomainLook = 'toolbox' | 'card' | 'ribbon'

/** What `ctx.domain(name, …)` declares */
export interface DomainConfig {
  label: string
  icon?: string
  /** Default: the app's `features.domainBar.look`, else `toolbox` */
  look?: DomainLook
  /** Where the domain's title leads (its board) */
  to?: RouteLocationRaw
  nav?: DomainNavEntry[]
  indicators?: DomainIndicator[]
  /** Entities of other modules whose pages join the domain */
  entities?: string[]
}

export interface DomainDefinition extends DomainConfig {
  name: string
  /** The module that declared it: its routes join the domain */
  module: string | null
}

const domains = new Map<string, DomainDefinition>()

export function registerDomain(name: string, config: DomainConfig, module: string | null = null): void {
  if (!name) throw new Error('[qdadm] domain: a domain needs a name')
  if (domains.has(name)) console.warn(`[qdadm] domain('${name}'): replaces the domain already declared`)
  const ids = new Set<string>()
  for (const i of config.indicators ?? []) {
    if (ids.has(i.id)) console.warn(`[qdadm] domain('${name}'): two indicators are named '${i.id}'`)
    ids.add(i.id)
  }
  for (const n of config.nav ?? []) {
    if (n.badge && !ids.has(n.badge)) console.warn(`[qdadm] domain('${name}'): the entry '${n.label}' shows the badge of '${n.badge}', which no indicator is`)
  }
  domains.set(name, { ...config, name, module })
}

export function getDomain(name: string): DomainDefinition | null {
  return domains.get(name) ?? null
}

export function listDomains(): DomainDefinition[] {
  return [...domains.values()]
}

/** Tests only */
export function resetDomains(): void {
  domains.clear()
}

type RouteLike = Pick<RouteLocationNormalizedLoaded, 'meta' | 'matched'>

/**
 * The domain a route belongs to, or null. `meta.domain: false` keeps a page
 * out of its module's domain.
 */
export function domainOfRoute(route: RouteLike | null | undefined): DomainDefinition | null {
  if (!route || domains.size === 0) return null
  const meta = route.meta ?? {}
  if (meta.domain === false) return null
  if (typeof meta.domain === 'string') return getDomain(meta.domain)
  const entity = typeof meta.entity === 'string' ? meta.entity : null
  if (entity) {
    for (const d of domains.values()) if (d.entities?.includes(entity)) return d
  }
  // The deepest matched route with a module wins (a frame route's children carry theirs)
  const modules = (route.matched ?? []).map((r) => r.meta?.module).filter((m): m is string => typeof m === 'string')
  const module = modules.at(-1) ?? (typeof meta.module === 'string' ? meta.module : null)
  if (module) {
    for (const d of domains.values()) if (d.module === module) return d
  }
  return null
}

/** The tone of a badge: only bad news is coloured */
export function badgeTone(status: CardStatus | null | undefined): 'critical' | 'watch' | null {
  return status === 'critical' || status === 'watch' ? status : null
}
