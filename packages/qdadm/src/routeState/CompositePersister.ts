/**
 * One state, several media (#2146).
 *
 * The seam's signature was chosen so composition would be expressible without
 * changing it, and this is the case that needed it: qdadm's own default.
 * Filters, search and the page belong in a link; rows-per-page does not — it
 * is a comfort setting somebody chose once, and putting it in the URL would
 * mean a link imposing the sender's row count on the reader.
 *
 * So the default routes by key: everything to the URL, `pageSize` to the
 * cookie it has always lived in.
 *
 * ```js
 * new CompositePersister({
 *   fallback: new UrlPersister({ router, route }),
 *   keys: { pageSize: { persister: new CookiePersister(), scope: 'app' } },
 * })
 * ```
 *
 * A ROUTED KEY MAY PIN ITS OWN SCOPE. `pageSize` is remembered once for the
 * whole app rather than per list — that is what the year-long
 * `qdadm_pageSize` cookie already did, and expressing it here makes it a
 * visible decision instead of an accident of where the code happened to live.
 */
import type { RouteStatePersister } from './RouteStatePersister'

export interface RoutedKey {
  persister: RouteStatePersister
  /**
   * Remember this key under a fixed scope instead of the caller's.
   *
   * For state that is one setting across the whole app rather than one per
   * screen. Leave it out and the key follows the scope like everything else.
   */
  scope?: string
}

export interface CompositePersisterOptions {
  /** Where anything unrouted goes. */
  fallback: RouteStatePersister
  /** Keys that live somewhere else. */
  keys?: Record<string, RoutedKey | RouteStatePersister>
}

export class CompositePersister implements RouteStatePersister {
  readonly name: string

  private readonly _fallback: RouteStatePersister
  private readonly _keys: Map<string, RoutedKey>

  constructor(options: CompositePersisterOptions) {
    this._fallback = options.fallback
    this._keys = new Map(
      Object.entries(options.keys ?? {}).map(([key, routed]) => [
        key,
        'persister' in routed ? routed : { persister: routed },
      ])
    )

    const media = new Set([
      this._fallback.name,
      ...[...this._keys.values()].map((routed) => routed.persister.name),
    ])
    this.name = `composite(${[...media].join('+')})`
  }

  /**
   * The fallback's state, with each routed key overlaid from its own medium.
   *
   * Order matters: a routed key wins even if the fallback happens to hold one
   * under the same name — a stale `?pageSize=50` left in somebody's URL must
   * not beat the cookie that owns the setting.
   */
  read(scope: string): Record<string, unknown> | null {
    const base = this._fallback.read(scope)
    const state: Record<string, unknown> = base ? { ...base } : {}
    let found = base !== null

    // Read each medium once, however many keys it owns.
    for (const [medium, keys] of this._byMedium()) {
      const stored = medium.persister.read(medium.scope ?? scope)
      if (!stored) continue
      for (const key of keys) {
        if (stored[key] === undefined) continue
        found = true
        state[key] = stored[key]
      }
    }

    return found ? state : null
  }

  /**
   * Split the state by owner and write each medium once.
   *
   * A routed key ABSENT from `state` is still passed on as absent, so the
   * empty-means-removed rule reaches the medium that owns it — otherwise
   * clearing a filter would leave it behind in whichever store it lived in.
   */
  write(scope: string, state: Record<string, unknown>): void {
    const forFallback: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(state)) {
      if (this._keys.has(key)) continue
      forFallback[key] = value
    }
    this._fallback.write(scope, forFallback)

    for (const [medium, keys] of this._byMedium()) {
      const slice: Record<string, unknown> = {}
      for (const key of keys) slice[key] = state[key]
      medium.persister.write(medium.scope ?? scope, slice)
    }
  }

  /**
   * Clear the fallback, and any routed key that follows the caller's scope.
   *
   * A key PINNED to its own scope is deliberately left alone: `pageSize` is
   * an app-wide setting somebody chose, and "clear this list's filters" is
   * not a request to reset it. Clearing it here would make one list's clear
   * button change every other list's row count.
   */
  clear(scope: string): void {
    this._fallback.clear(scope)
    for (const [medium, keys] of this._byMedium()) {
      if (medium.scope !== undefined) continue
      const slice: Record<string, unknown> = {}
      for (const key of keys) slice[key] = null
      medium.persister.write(scope, slice)
    }
  }

  /** Group routed keys by the (persister, scope) pair that owns them. */
  private _byMedium(): Map<RoutedKey, string[]> {
    const grouped = new Map<string, { medium: RoutedKey; keys: string[] }>()
    for (const [key, routed] of this._keys) {
      const id = `${routed.persister.name} ${routed.scope ?? ''}`
      const existing = grouped.get(id)
      if (existing) existing.keys.push(key)
      else grouped.set(id, { medium: routed, keys: [key] })
    }
    return new Map([...grouped.values()].map(({ medium, keys }) => [medium, keys]))
  }
}
