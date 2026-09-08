/**
 * Where a route's state is remembered (#2146).
 *
 * Not "list state": the list is one CONSUMER of routing state, not the
 * subject. A detail page's active tab, a dashboard's date range and a child
 * page's own state are the same problem, and each would invent its own answer
 * if this seam did not exist — which is exactly how qdadm ended up with five
 * unrelated persistence sites, one of them a year-long cookie.
 *
 * The state is opaque on purpose. Every consumer has its own shape, and a
 * fixed one here would only fit whichever consumer was written first.
 *
 * NOT for chrome preferences. A collapsed sidebar belongs to the person, not
 * to the route: sending someone a link must not fold their menu. The line is
 * *what I am looking at* versus *how I like my interface*.
 */
export interface RouteStatePersister {
  /** Everything remembered under this scope, or null when nothing is. */
  read(scope: string): Record<string, unknown> | null
  /**
   * Remember this state under this scope.
   *
   * A key whose value is `null`, `undefined` or `''` is REMOVED rather than
   * stored empty — so a pristine screen leaves no trace, and a shared link
   * carries only what was actually chosen.
   */
  write(scope: string, state: Record<string, unknown>): void
  clear(scope: string): void
  /** For diagnostics: which persister answered. */
  readonly name: string
}

/**
 * How a consumer names itself.
 *
 * The scope is what makes two lists on one route stop fighting over `page` —
 * the collision `page-compositions.md` currently tells people to avoid by
 * switching persistence off entirely.
 */
export type RouteStateScope = string

/** A handler as the bootstrap declares it: a slug, or an instance. */
export type RouteStatePersisterSpec = string | RouteStatePersister

/** Anything that can build a persister from a slug. */
export type RouteStatePersisterFactory = (slug: string) => RouteStatePersister | null

/** An instance, duck-typed — the same test the storage factory applies. */
export function isRouteStatePersister(value: unknown): value is RouteStatePersister {
  if (!value || typeof value !== 'object') return false
  const candidate = value as RouteStatePersister
  return (
    typeof candidate.read === 'function' &&
    typeof candidate.write === 'function' &&
    typeof candidate.clear === 'function'
  )
}

/**
 * Turn a spec into a persister.
 *
 * An unknown slug THROWS. It does not fall back to the URL: a persistence
 * choice that silently does something else is the exact failure
 * [ADR 0011](../../docs/adr/0011-no-silent-no-ops.md) exists to forbid, and
 * the one this seam is cleaning up after.
 */
export function resolveRouteStatePersister(
  spec: RouteStatePersisterSpec,
  factory: RouteStatePersisterFactory
): RouteStatePersister {
  if (isRouteStatePersister(spec)) return spec

  if (typeof spec === 'string') {
    const built = factory(spec)
    if (built) return built
    throw new Error(
      `[qdadm] Unknown route-state persister "${spec}". ` +
        `Pass a known slug, or an object with read/write/clear.`
    )
  }

  throw new Error(
    `[qdadm] Invalid route-state persister: ${typeof spec}. ` +
      `Expected a slug or an object with read/write/clear.`
  )
}
