/**
 * Route state in the query string — the default (#2146).
 *
 * The default because it is the only medium where "what I am looking at" is
 * also "what I can send you". A list URL that does not carry its page is a
 * link that shows the recipient something else.
 *
 * CLEAN AROUND THE EXISTING ROUTER: this goes through the `router` the app
 * already has, with `replace`, and touches no route declaration. Paging is
 * not a history step of its own — but the URL must carry the state at the
 * moment the user leaves, so that coming back restores it.
 *
 * Keys are namespaced by scope (`offers.page=2`), which is what stops two
 * lists on one route from fighting over `page` — the collision
 * `page-compositions.md` currently tells people to avoid by switching
 * persistence off.
 */
import type { RouteStatePersister } from './RouteStatePersister'

/** The bits of vue-router this needs, so tests need no real router. */
export interface UrlPersisterRouter {
  replace(to: { query: Record<string, unknown> }): unknown
}
export interface UrlPersisterRoute {
  query: Record<string, unknown>
}

export interface UrlPersisterOptions {
  router: UrlPersisterRouter
  /** Live route — read at call time, never captured. */
  route: UrlPersisterRoute
}

export class UrlPersister implements RouteStatePersister {
  readonly name = 'url'

  private readonly _router: UrlPersisterRouter
  private readonly _route: UrlPersisterRoute

  constructor(options: UrlPersisterOptions) {
    this._router = options.router
    this._route = options.route
  }

  read(scope: string): Record<string, unknown> | null {
    const prefix = `${scope}.`
    const state: Record<string, unknown> = {}
    let found = false

    for (const [key, raw] of Object.entries(this._route.query)) {
      if (!key.startsWith(prefix)) continue
      found = true
      state[key.slice(prefix.length)] = decodeValue(raw)
    }

    return found ? state : null
  }

  write(scope: string, state: Record<string, unknown>): void {
    const prefix = `${scope}.`
    const query = { ...this._route.query }

    for (const [key, value] of Object.entries(state)) {
      const param = prefix + key
      // Absent, not stored empty: a pristine screen leaves a clean link.
      if (value === null || value === undefined || value === '') delete query[param]
      else query[param] = encodeValue(value)
    }

    this._router.replace({ query })
  }

  clear(scope: string): void {
    const prefix = `${scope}.`
    const query = { ...this._route.query }
    for (const key of Object.keys(query)) {
      if (key.startsWith(prefix)) delete query[key]
    }
    this._router.replace({ query })
  }
}

/**
 * A value on its way into a URL.
 *
 * Primitives stay readable — `page=2`, not `page=%222%22` — because a query
 * string people paste into tickets is worth more than perfect round-tripping.
 * Objects and arrays are JSON, which `decodeValue` recognises by its opening
 * brace.
 */
function encodeValue(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * And on its way back out.
 *
 * The coercion is deliberately the one `restoreFilters` already applied to
 * query params, so behaviour does not shift underneath anyone: `'true'`
 * becomes a boolean, a numeric string becomes a number.
 *
 * It follows that a filter whose value is the STRING `'42'` comes back as the
 * NUMBER 42. That was already true before this seam existed; it is written
 * down here rather than left to be rediscovered.
 */
function decodeValue(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw.map(decodeValue)
  if (typeof raw !== 'string') return raw

  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw)

  const first = raw[0]
  if (first === '{' || first === '[') {
    try {
      return JSON.parse(raw)
    } catch {
      // Not JSON after all — a filter value that merely starts with a brace.
      return raw
    }
  }

  return raw
}
