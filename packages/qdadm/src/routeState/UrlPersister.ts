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
import { dottedKeyLocator, type RouteStateKeyLocator } from './keyLocator'

/** The bits of vue-router this needs, so tests need no real router. */
/** One query value, shaped as vue-router accepts them. */
export type UrlPersisterQueryValue = string | number | null | undefined

export interface UrlPersisterRouter {
  // Values are narrowed to what vue-router's own query type accepts, so the
  // real router satisfies this without a cast — and so does a two-line fake
  // in a test.
  replace(to: { query: Record<string, UrlPersisterQueryValue> }): unknown
}
export interface UrlPersisterRoute {
  query: Record<string, unknown>
}

export interface UrlPersisterOptions {
  router: UrlPersisterRouter
  /** Live route — read at call time, never captured. */
  route: UrlPersisterRoute
  /**
   * How a (scope, key) pair becomes a query parameter. Defaults to
   * `offers.page`; override to impose your own scheme.
   */
  keyLocator?: RouteStateKeyLocator
  /**
   * Also read UNPREFIXED keys when the scope has none of its own.
   *
   * Transitional, and on by default: qdadm wrote `?page=2` flat before this
   * seam existed, so links people bookmarked or pasted into tickets carry
   * that shape. Without this they would silently resolve to page 1 — the
   * reader would see a wrong screen and no error.
   *
   * Writes are always prefixed, so a link refreshes itself the first time
   * anyone touches the list. Set false to drop the compatibility, and expect
   * to remove it here in a later version.
   */
  readFlatFallback?: boolean
}

export class UrlPersister implements RouteStatePersister {
  readonly name = 'url'

  private readonly _router: UrlPersisterRouter
  private readonly _route: UrlPersisterRoute
  private readonly _keys: RouteStateKeyLocator
  private readonly _readFlatFallback: boolean

  constructor(options: UrlPersisterOptions) {
    this._router = options.router
    this._route = options.route
    this._keys = options.keyLocator ?? dottedKeyLocator
    this._readFlatFallback = options.readFlatFallback ?? true
  }

  read(scope: string): Record<string, unknown> | null {
    const state: Record<string, unknown> = {}
    let found = false

    for (const [storedKey, raw] of Object.entries(this._route.query)) {
      const key = this._keys.decode(scope, storedKey)
      if (key === null) continue
      found = true
      state[key] = decodeValue(raw)
    }

    if (found || !this._readFlatFallback) return found ? state : null

    // Nothing under this scope: possibly a link written before the seam
    // existed. Read it flat rather than showing the wrong screen without a
    // word — but ONLY keys nobody has scoped. `jobs.page` belongs to the jobs
    // list, and handing it to this one would be worse than ignoring it.
    const flat: Record<string, unknown> = {}
    for (const [storedKey, raw] of Object.entries(this._route.query)) {
      if (this._keys.looksScoped(storedKey)) continue
      flat[storedKey] = decodeValue(raw)
    }
    return Object.keys(flat).length ? flat : null
  }

  write(scope: string, state: Record<string, unknown>): void {
    const query: Record<string, UrlPersisterQueryValue> = { ...toQuery(this._route.query) }

    for (const [key, value] of Object.entries(state)) {
      const param = this._keys.encode(scope, key)
      // A flat key left by an older link would shadow the prefixed one on the
      // next read, so writing a scope also retires its legacy twin.
      if (this._readFlatFallback && param !== key) delete query[key]
      // Absent, not stored empty: a pristine screen leaves a clean link.
      if (value === null || value === undefined || value === '') delete query[param]
      else query[param] = encodeValue(value)
    }

    this._router.replace({ query })
  }

  clear(scope: string): void {
    const query: Record<string, UrlPersisterQueryValue> = { ...toQuery(this._route.query) }
    let scoped = false
    for (const storedKey of Object.keys(query)) {
      if (this._keys.decode(scope, storedKey) === null) continue
      scoped = true
      delete query[storedKey]
    }

    // Clear what read() would have READ, or the URL starts lying: arrive on a
    // pre-scope `?page=4` link, clear the filters, and the list shows page 1
    // under an address still claiming page 4 — and a refresh would restore
    // the state that was just cleared.
    if (!scoped && this._readFlatFallback) {
      for (const storedKey of Object.keys(query)) {
        if (!this._keys.looksScoped(storedKey)) delete query[storedKey]
      }
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
 *
 * BUT ONLY WHEN NOTHING IS LOST (#2147). `'007'` is not the number 7 and
 * `'9876667194123456789'` is not the float it would become — those are text
 * that merely looks numeric, and coercing them hands the app a value the user
 * never typed. So the coercion happens only when it round-trips exactly, and
 * anything else stays the string it was. Reference numbers, invoice ids and
 * phone numbers all live in that gap, and a search box is full of them.
 */
function decodeValue(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw.map(decodeValue)
  if (typeof raw !== 'string') return raw

  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if (raw !== '' && !Number.isNaN(Number(raw))) {
    const asNumber = Number(raw)
    // The round-trip test IS the rule: if the number cannot be written back
    // as the exact same text, the text was never a number.
    if (String(asNumber) === raw) return asNumber
    return raw
  }

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

/** The live route's query, narrowed to what we may hand back to the router. */
function toQuery(query: Record<string, unknown>): Record<string, UrlPersisterQueryValue> {
  const out: Record<string, UrlPersisterQueryValue> = {}
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    // An array param is one vue-router supports and we do not produce; keep
    // its first value rather than dropping the key entirely.
    out[key] = Array.isArray(value) ? (value[0] as UrlPersisterQueryValue) : (String(value) as string)
  }
  return out
}
