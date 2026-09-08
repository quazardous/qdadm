/**
 * What a list uses when nobody chose (#2146).
 *
 * Not simply `UrlPersister`, because not all list state wants the same
 * medium. Filters, search and the page belong in a link — that is the whole
 * argument for the URL being the default. Rows-per-page does not: it is a
 * comfort setting somebody picked once, and a link carrying it would impose
 * the sender's row count on the reader.
 *
 * So the default is a composition, and it says out loud what qdadm was
 * already doing by accident:
 *
 * | State | Medium | Scope |
 * |---|---|---|
 * | filters, search, page | query string | the list |
 * | `pageSize` | cookie, a year | the app |
 * | `sort` | `sessionStorage` | the list |
 *
 * **Sort stays in the session** — decided on #2146 rather than moved to the
 * URL. Moving it would make a list link carry its ordering, which is a real
 * gain; it would also mean the sort no longer survives opening a clean
 * `/offers`, which it has always done. Between a gain nobody asked for and a
 * loss every existing user would feel, the seam is worth having without the
 * behaviour change: this expresses today's arrangement rather than replacing
 * it.
 */
import { CompositePersister } from './CompositePersister'
import { CookiePersister, type CookieJar } from './CookiePersister'
import { WebStoragePersister, type RouteStateStorage } from './WebStoragePersister'
import { UrlPersister, type UrlPersisterRoute, type UrlPersisterRouter } from './UrlPersister'
import type { RouteStatePersister } from './RouteStatePersister'

export interface DefaultRouteStateOptions {
  router: UrlPersisterRouter
  route: UrlPersisterRoute
  /** Stand-in for `document`, for a test or an environment without one. */
  cookieJar?: CookieJar
  /** Stand-in for `sessionStorage`, same reason. */
  sessionStorage?: RouteStateStorage
}

/** The scope `pageSize` is remembered under: one setting for the whole app. */
export const APP_ROUTE_STATE_SCOPE = 'app'

export function createDefaultRouteStatePersister(
  options: DefaultRouteStateOptions
): RouteStatePersister {
  const session = new WebStoragePersister({
    storage: options.sessionStorage ?? globalThis.sessionStorage,
    name: 'session_storage',
  })

  return new CompositePersister({
    fallback: new UrlPersister(options),
    keys: {
      pageSize: {
        persister: new CookiePersister(options.cookieJar ? { jar: options.cookieJar } : {}),
        scope: APP_ROUTE_STATE_SCOPE,
      },
      // Per-list, unlike pageSize: an ordering belongs to the screen you were
      // looking at, not to the whole app.
      sort: { persister: session },
      sortOrder: { persister: session },
    },
  })
}
