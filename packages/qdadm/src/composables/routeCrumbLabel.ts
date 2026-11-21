/**
 * A route crumb's label (#5443): the one given, the route's `meta.navLabel`
 * or `meta.title`, or the catalogue's `breadcrumb.<route name>`. Nothing
 * names it: null, the crumb is left out (a raw route name is no label), with
 * a warning in development naming the route.
 */
import type { Router } from 'vue-router'

const isDev = (): boolean => (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true
const warned = new Set<string>()

export function routeCrumbLabel(
  routeName: string,
  router: Pick<Router, 'getRoutes'>,
  tOr: (key: string, fallback: string) => string,
  given?: string | null
): string | null {
  if (given) return given
  const meta = router.getRoutes().find((r) => r.name === routeName)?.meta
  const own = (meta?.navLabel as string | undefined) || (meta?.title as string | undefined)
  if (own) return own
  const listed = tOr(`breadcrumb.${routeName}`, '')
  if (listed) return listed
  if (isDev() && !warned.has(routeName)) {
    warned.add(routeName)
    console.warn(
      `[qdadm] breadcrumb: the route '${routeName}' has no label, so its crumb is left out. ` +
        `Give it one: meta.navLabel (or meta.title) on the route, or 'breadcrumb.${routeName}' in the catalogue.`
    )
  }
  return null
}

/** Tests only */
export function resetRouteCrumbWarnings(): void {
  warned.clear()
}
