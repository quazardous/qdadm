/**
 * Slugs to persisters (#2146).
 *
 * Mirrors what `entity/storage/factory.ts` does for storages — an instance, or
 * a name the framework knows — so a consumer meets one convention rather than
 * two.
 *
 * | Slug | Medium | Reach for it when |
 * |---|---|---|
 * | `url` | query string | the state is worth sending someone (the default) |
 * | `local_storage` | `localStorage` | worth keeping, not worth linking |
 * | `session_storage` | `sessionStorage` | worth keeping until the tab closes |
 * | `cookie` | one cookie per scope | the SERVER needs to read it |
 * | `memory` | a shared Map | survives navigation, not a reload |
 * | `none` | nowhere | this screen forgets, and says so |
 */
import type { RouteStatePersister, RouteStatePersisterFactory } from './RouteStatePersister'
import { UrlPersister, type UrlPersisterRoute, type UrlPersisterRouter } from './UrlPersister'
import { WebStoragePersister, type RouteStateStorage } from './WebStoragePersister'
import { CookiePersister, type CookieJar } from './CookiePersister'
import { MemoryPersister } from './MemoryPersister'
import { NullPersister } from './NullPersister'

export interface RouteStateFactoryContext {
  router: UrlPersisterRouter
  route: UrlPersisterRoute
  /**
   * Overrides for the browser globals the storage-backed slugs reach for.
   *
   * Only needed off a browser — SSR, or a test that would rather not share
   * one `localStorage` between cases. Left alone, each slug uses the real
   * thing, resolved AT BUILD TIME rather than captured here, so a factory
   * created before the app mounts still works.
   */
  localStorage?: RouteStateStorage
  sessionStorage?: RouteStateStorage
  cookieJar?: CookieJar
}

/**
 * The built-in factory.
 *
 * Returns null for a slug it does not know — the CALLER throws, with the name
 * in the message. Returning a default here would make an unknown slug behave
 * like `url` and say nothing, which is the failure ADR 0011 forbids and the
 * one this seam is cleaning up after.
 */
export function createRouteStatePersisterFactory(
  context: RouteStateFactoryContext
): RouteStatePersisterFactory {
  return (slug: string): RouteStatePersister | null => {
    switch (slug) {
      case 'url':
        return new UrlPersister(context)
      case 'local_storage':
        return new WebStoragePersister({
          storage: context.localStorage ?? globalThis.localStorage,
          name: 'local_storage',
        })
      case 'session_storage':
        return new WebStoragePersister({
          storage: context.sessionStorage ?? globalThis.sessionStorage,
          name: 'session_storage',
        })
      case 'cookie':
        return new CookiePersister(context.cookieJar ? { jar: context.cookieJar } : {})
      case 'memory':
        return new MemoryPersister()
      case 'none':
        return new NullPersister()
      default:
        return null
    }
  }
}
