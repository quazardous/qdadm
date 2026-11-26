/**
 * Domains (#5389): a part of the app with a bar of its own on top of every
 * one of its pages: its navigation and a row of indicators, mini cards each
 * read from its own source, their counts as badges.
 *
 * A page belongs to a domain:
 * 1. when its route says so (`meta.domain`);
 * 2. when its address says so (`?domain=it`, #5412), a domain declared;
 * 3. when its entity is one the domain lists (`entities`), from any module;
 * 4. when the module that declared the domain declared the route too.
 * Then the app's `features.domainResolver` has the last word (#5412).
 */
import type { Component } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'
import type { CardPillMode, CardStatus } from '../cards/types'
import type { DomainDataSource } from './sources'
import type { CardSchema } from '../cards/validate'

/** An added indicator's parameters (#5526), given to its functions as their last argument */
export type IndicatorParams = Record<string, unknown>

export type { DomainDataSource } from './sources'

/**
 * What an app's own indicator component receives (#5422): its data, how it
 * stands, and the bar's mode, to draw itself as it likes.
 */
export interface DomainIndicatorProps {
  data: unknown
  options: Record<string, unknown>
  status: CardStatus | null
  /** The bar's mode: `full`, or `compact` with why */
  mode: CardPillMode
  title: string
  icon: string | null
  /** `ready`, or `loading`, `unreachable`, `invalid` */
  state: 'loading' | 'unreachable' | 'invalid' | 'ready'
  /** The card's pill value and count, when it names a card */
  value: string
  count: number | null
}

/** One permanent indicator: a card of a registered type, drawn as a pill */
export interface DomainIndicator {
  /** Named by the nav entries that show its badge */
  id: string
  /** The card type (metric, queue, goal, compare, split, or one of the app's); optional with `component` */
  card?: string
  /**
   * The app's own drawing of the pill's inside (#5422), in place of the
   * icon, title and badge; it receives DomainIndicatorProps. With a `card`,
   * the card still checks the data and gives the nav entries their badge.
   */
  component?: Component
  /** When the bar is compact: options merged over `options`, another component */
  compact?: { options?: Record<string, unknown>; component?: Component }
  /** Its name, read beside the pill and by screen readers; or a function of its data (#5438) */
  title: string | ((data: unknown, params?: IndicatorParams) => string | undefined)
  /** An icon class, or a function of its data (#5438) */
  icon?: string | ((data: unknown, params?: IndicatorParams) => string | undefined)
  /** Its name in a layout editor (#5526), where there is no data to read a title from; default its title when a string, else its id */
  label?: string
  /** What it shows, in a layout editor's catalogue (#5526; an i18n key works) */
  description?: string
  /**
   * Added by the app's layout, as many times as wanted, each with its own
   * parameters (#5526): not drawn itself; its instances are, their
   * parameters given to its functions
   */
  repeatable?: boolean
  /** A repeatable indicator's parameters: a JSON Schema in the cards' subset */
  params?: CardSchema
  /** The data, as the card type takes it */
  data?: unknown
  /** Or read it: called at once, then every `refresh` seconds */
  load?: (params?: IndicatorParams) => unknown | Promise<unknown>
  /**
   * Or take it from one of the domain's `sources` (#5461), read once for
   * every indicator that names it; its error is theirs
   */
  source?: string
  /** With `source`: this indicator's part of the source's answer (default: all of it) */
  value?: (data: unknown, params?: IndicatorParams) => unknown
  /** Seconds between two reads (default: none) */
  refresh?: number
  /** The card type's options */
  options?: Record<string, unknown>
  /** How things stand: fixed, or from the data */
  status?: CardStatus | ((data: unknown, params?: IndicatorParams) => CardStatus | undefined | null)
  /** Where the pill leads, or a function of its data (#5438) */
  to?: RouteLocationRaw | ((data: unknown, params?: IndicatorParams) => RouteLocationRaw | undefined)
  /**
   * Drawn or not, once its data is read (#5438): false leaves the slot out,
   * full or compact (a "top N" slot with nothing in it). While it loads, or
   * when its source is unreachable, it is drawn as usual.
   */
  visible?: (data: unknown, params?: IndicatorParams) => boolean
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
  /** The most indicators its bar shows from an app's layout (#5526); default features.domainBar.maxCards, else 8 */
  maxCards?: number
  /**
   * Reads its indicators share (#5461): each read once per refresh, whatever
   * the number of indicators naming it, and again when one of its
   * `entities` changes
   */
  sources?: Record<string, DomainDataSource>
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
    if (!i.card && !i.component) console.warn(`[qdadm] domain('${name}'): the indicator '${i.id}' names no card and no component`)
    if (i.source !== undefined && !config.sources?.[i.source]) console.warn(`[qdadm] domain('${name}'): the indicator '${i.id}' reads the source '${i.source}', which the domain does not declare`)
    if (i.source !== undefined && i.load) console.warn(`[qdadm] domain('${name}'): the indicator '${i.id}' has both a source and a load(); the source is read`)
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

type RouteLike = Pick<RouteLocationNormalizedLoaded, 'meta' | 'matched'> & Partial<Pick<RouteLocationNormalizedLoaded, 'query'>>

const isDev = (): boolean => (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

/** The query parameter that keeps a page in a domain (#5412) */
export const DOMAIN_QUERY = 'domain'

/** Where a page's domain comes from */
export type DomainSource = 'route' | 'query' | 'resolver'

/** The default rule, and what decided it */
function defaultDomain(route: RouteLike): { domain: DomainDefinition | null; source: DomainSource } {
  const none = { domain: null, source: 'route' as const }
  if (domains.size === 0) return none
  const meta = route.meta ?? {}
  if (meta.domain === false) return none
  if (typeof meta.domain === 'string') return { domain: getDomain(meta.domain), source: 'route' }
  const asked = route.query?.[DOMAIN_QUERY]
  if (typeof asked === 'string' && domains.has(asked)) return { domain: getDomain(asked), source: 'query' }
  const entity = typeof meta.entity === 'string' ? meta.entity : null
  if (entity) {
    for (const d of domains.values()) if (d.entities?.includes(entity)) return { domain: d, source: 'route' }
  }
  // The deepest matched route with a module wins (a frame route's children carry theirs)
  const modules = (route.matched ?? []).map((r) => r.meta?.module).filter((m): m is string => typeof m === 'string')
  const module = modules.at(-1) ?? (typeof meta.module === 'string' ? meta.module : null)
  if (module) {
    for (const d of domains.values()) if (d.module === module) return { domain: d, source: 'route' }
  }
  return none
}

/**
 * The domain a route belongs to by the default rule, or null. `meta.domain:
 * false` keeps a page out of its module's domain.
 */
export function domainOfRoute(route: RouteLike | null | undefined): DomainDefinition | null {
  return route ? defaultDomain(route).domain : null
}

/** What the app's resolver is given (#5412) */
export interface DomainResolverContext {
  /** What the default rule found: meta.domain, ?domain=, the entity, the module */
  fallback: DomainDefinition | null
  /** The domain of the page we come from */
  previous: DomainDefinition | null
  /** The page's entity levels (the active stack) */
  stack: ReadonlyArray<{ entity: string; id: string | null }>
  /**
   * The record the page shows (its deepest stack level), once loaded; null
   * before. The resolver is called again when it arrives.
   */
  record: Record<string, unknown> | null
  /** That record is still on its way */
  loading: boolean
  getDomain: (name: string) => DomainDefinition | null
}

/**
 * The app's last word on a page's domain (`features.domainResolver`): a
 * domain's name, `null` for none, `undefined` to keep the fallback.
 */
export type DomainResolver = (route: RouteLocationNormalizedLoaded, ctx: DomainResolverContext) => string | null | undefined

export interface ResolveDomainOptions {
  resolver?: DomainResolver | null
  previous?: DomainDefinition | null
  stack?: DomainResolverContext['stack']
  record?: Record<string, unknown> | null
  loading?: boolean
  /** The domain shown now: kept while the record loads and the resolver says nothing */
  current?: { domain: DomainDefinition | null; source: DomainSource } | null
}

/**
 * A page's domain: the default rule, then the app's resolver (#5412). A
 * resolver that throws, or names a domain nobody declared, leaves the
 * default rule's answer. While the page's record loads, a resolver that says
 * nothing keeps the domain shown (no bar that blinks), until it is called
 * again with the record.
 */
export function resolveDomain(
  route: RouteLocationNormalizedLoaded,
  options: ResolveDomainOptions = {}
): { domain: DomainDefinition | null; source: DomainSource } {
  const found = defaultDomain(route)
  const resolver = options.resolver
  if (typeof resolver !== 'function') return found
  const loading = !!options.loading
  try {
    const name = resolver(route, {
      fallback: found.domain,
      previous: options.previous ?? null,
      stack: options.stack ?? [],
      record: options.record ?? null,
      loading,
      getDomain,
    })
    if (name === undefined) return loading && options.current?.domain ? options.current : found
    if (name === null) return { domain: null, source: 'resolver' }
    const domain = getDomain(name)
    if (domain) return { domain, source: 'resolver' }
    if (isDev()) console.warn(`[qdadm] domainResolver: no domain is named '${name}'; the default rule's answer stands`)
  } catch (e) {
    if (isDev()) console.warn('[qdadm] domainResolver threw; the default rule\'s answer stands', e)
  }
  return found
}

/** The tone of a badge: only bad news is coloured */
export function badgeTone(status: CardStatus | null | undefined): 'critical' | 'watch' | null {
  return status === 'critical' || status === 'watch' ? status : null
}
