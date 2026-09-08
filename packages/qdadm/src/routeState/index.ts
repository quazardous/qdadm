/**
 * Route-state persistence (#2146).
 *
 * The seam that decides WHERE a route remembers what it is showing. The list
 * is one consumer; a detail page's active tab and a dashboard's date range
 * are the same problem.
 */
export type {
  RouteStatePersister,
  RouteStateScope,
  RouteStatePersisterSpec,
  RouteStatePersisterFactory,
} from './RouteStatePersister'
export { isRouteStatePersister, resolveRouteStatePersister } from './RouteStatePersister'
export { UrlPersister } from './UrlPersister'
export type { UrlPersisterOptions, UrlPersisterRouter, UrlPersisterRoute } from './UrlPersister'
export { createRouteStatePersisterFactory } from './factory'
export { dottedKeyLocator, namespacedKeyLocator } from './keyLocator'
export type { RouteStateKeyLocator } from './keyLocator'
export { WebStoragePersister } from './WebStoragePersister'
export type { WebStoragePersisterOptions, RouteStateStorage } from './WebStoragePersister'
export { CookiePersister } from './CookiePersister'
export type { CookiePersisterOptions, CookieJar } from './CookiePersister'
export { MemoryPersister, clearRouteStateMemory } from './MemoryPersister'
export type { MemoryPersisterOptions, RouteStateMemoryStore } from './MemoryPersister'
export { NullPersister } from './NullPersister'
export { underscoreScopeLocator } from './keyLocator'
export type { RouteStateScopeLocator } from './keyLocator'
export type { RouteStateFactoryContext } from './factory'
