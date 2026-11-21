/**
 * The home page (#5365): what `homeRoute` declares, as routes under the layout.
 *
 * - a string names a route a module declares: `/` redirects to it;
 * - `{ name, component, path }` mounts the page on its own `path`, and `/`
 *   redirects to it, so the page keeps an address when the home changes;
 * - `{ name, component }` without `path` mounts the page on `/` only: it has
 *   no address of its own, and a link to it breaks the day the home changes.
 *   Kept as it was, with a warning in development.
 */
import type { RouteRecordRaw } from 'vue-router'
import type { HomeRoute } from './Kernel.types'

/** The name of the route the home is, whatever form `homeRoute` takes */
export function homeRouteName(homeRoute: HomeRoute | undefined | null): string {
  if (homeRoute && typeof homeRoute === 'object') {
    if (homeRoute.name) return homeRoute.name
    return homeRoute.component && !homeRoute.path ? '_home' : 'home'
  }
  return homeRoute || 'home'
}

const isDev = (): boolean => (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

/** What the app sets on its home page's route (#5443): meta, props */
function own(homeRoute: Exclude<HomeRoute, string>): Partial<RouteRecordRaw> {
  return {
    ...(homeRoute.meta ? { meta: homeRoute.meta } : {}),
    ...(homeRoute.props !== undefined ? { props: homeRoute.props } : {}),
  } as Partial<RouteRecordRaw>
}

/** The routes, under the layout, that `homeRoute` declares */
export function homeRouteRecords(homeRoute: HomeRoute | undefined | null, warn: (m: string) => void = console.warn): RouteRecordRaw[] {
  const name = homeRouteName(homeRoute)
  if (homeRoute && typeof homeRoute === 'object' && homeRoute.component) {
    const path = (homeRoute.path ?? '').replace(/^\/+/, '')
    if (!path) {
      if (isDev()) {
        warn(
          `[qdadm] homeRoute { component } has no path: the page '${name}' exists on '/' only, so a link to it breaks the day the home changes. ` +
            `Give it one (homeRoute: { name, component, path: 'welcome' }), or name a module's route (homeRoute: 'books').`
        )
      }
      return [{ path: '', name, component: homeRoute.component, ...own(homeRoute) } as RouteRecordRaw]
    }
    return [
      { path: '', name: '_home', redirect: { name } },
      { path, name, component: homeRoute.component, ...own(homeRoute) } as RouteRecordRaw,
    ]
  }
  return [{ path: '', name: '_home', redirect: { name } }]
}
