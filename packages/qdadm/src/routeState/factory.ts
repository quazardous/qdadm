/**
 * Slugs to persisters (#2146).
 *
 * Mirrors what `entity/storage/factory.ts` does for storages — an instance, or
 * a name the framework knows — so a consumer meets one convention rather than
 * two. Lot A registers `url` only; the rest arrive with lot C.
 */
import type { RouteStatePersister, RouteStatePersisterFactory } from './RouteStatePersister'
import { UrlPersister, type UrlPersisterRoute, type UrlPersisterRouter } from './UrlPersister'

export interface RouteStateFactoryContext {
  router: UrlPersisterRouter
  route: UrlPersisterRoute
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
      default:
        return null
    }
  }
}
