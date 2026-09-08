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
 * already doing by accident: everything in the query string, `pageSize` in
 * the year-long cookie it has always lived in, under one app-wide scope
 * rather than one per list — because that is what a global cookie meant.
 */
import { CompositePersister } from './CompositePersister'
import { CookiePersister, type CookieJar } from './CookiePersister'
import { UrlPersister, type UrlPersisterRoute, type UrlPersisterRouter } from './UrlPersister'
import type { RouteStatePersister } from './RouteStatePersister'

export interface DefaultRouteStateOptions {
  router: UrlPersisterRouter
  route: UrlPersisterRoute
  /** Stand-in for `document`, for a test or an environment without one. */
  cookieJar?: CookieJar
}

/** The scope `pageSize` is remembered under: one setting for the whole app. */
export const APP_ROUTE_STATE_SCOPE = 'app'

export function createDefaultRouteStatePersister(
  options: DefaultRouteStateOptions
): RouteStatePersister {
  return new CompositePersister({
    fallback: new UrlPersister(options),
    keys: {
      pageSize: {
        persister: new CookiePersister(options.cookieJar ? { jar: options.cookieJar } : {}),
        scope: APP_ROUTE_STATE_SCOPE,
      },
    },
  })
}
