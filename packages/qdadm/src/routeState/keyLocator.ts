/**
 * How a (scope, key) pair becomes a stored key — and back (#2146).
 *
 * Hard-coding `offers.page` inside the URL persister would make the naming
 * scheme a property of qdadm rather than of the app. An app that wants
 * `o_page`, or a single packed parameter, or a `[]`-suffixed convention its
 * backend already understands, must be able to say so — the same way it can
 * already override how a storage is resolved.
 *
 * ONE PER PERSISTER TYPE, because the right scheme differs by medium: dots
 * read well in a query string, colons are the convention in `localStorage`,
 * and a cookie has its own constraints entirely.
 *
 * `decode` returns null for a key that is not ours. That is what lets a
 * persister pick its own entries out of a medium it shares with everything
 * else — the whole reason the scope exists.
 */
export interface RouteStateKeyLocator {
  encode(scope: string, key: string): string
  /** The bare key, or null when this stored key belongs to someone else. */
  decode(scope: string, storedKey: string): string | null
  /**
   * Whether this key carries a scope at all — ANY scope, not just one.
   *
   * A legacy-compatibility reader needs this: `offers.page` and `jobs.page`
   * both belong to somebody, and treating them as unscoped leftovers would
   * hand one list the other's state. Only a key that is scoped by nobody can
   * be read as pre-scope state.
   */
  looksScoped(storedKey: string): boolean
  readonly name: string
}

/** `offers` + `page` → `offers.page`. The default in a query string. */
export const dottedKeyLocator: RouteStateKeyLocator = {
  name: 'dotted',
  encode: (scope, key) => (scope ? `${scope}.${key}` : key),
  decode: (scope, storedKey) => {
    if (!scope) return storedKey
    const prefix = `${scope}.`
    return storedKey.startsWith(prefix) ? storedKey.slice(prefix.length) : null
  },
  looksScoped: (storedKey) => storedKey.includes('.'),
}

/** `offers` + `page` → `qdadm:offers:page`. The default in web storage. */
export const namespacedKeyLocator: RouteStateKeyLocator = {
  name: 'namespaced',
  encode: (scope, key) => `qdadm:${scope}:${key}`,
  decode: (scope, storedKey) => {
    const prefix = `qdadm:${scope}:`
    return storedKey.startsWith(prefix) ? storedKey.slice(prefix.length) : null
  },
  looksScoped: (storedKey) => storedKey.startsWith('qdadm:'),
}

/**
 * How a SCOPE becomes a stored name, for media that keep one entry per scope.
 *
 * The cookie jar is the case: a cookie rides on every request, so a scope
 * gets one cookie holding a blob rather than one per key. There is no key
 * half to encode, which is why this is its own small interface rather than
 * `RouteStateKeyLocator` called with a key nobody uses.
 */
export interface RouteStateScopeLocator {
  encode(scope: string): string
  /** The bare scope, or null when this stored name belongs to someone else. */
  decode(storedName: string): string | null
  readonly name: string
}

/**
 * `offers` → `qdadm_offers`. The default in a cookie jar.
 *
 * Underscores rather than the colons web storage uses: a cookie NAME is an
 * RFC 6265 token, and `:` is a separator there. `qdadm:offers` is not a
 * cookie name a server is obliged to accept.
 */
export const underscoreScopeLocator: RouteStateScopeLocator = {
  name: 'underscore',
  encode: (scope) => `qdadm_${scope}`,
  decode: (storedName) =>
    storedName.startsWith('qdadm_') ? storedName.slice('qdadm_'.length) : null,
}
