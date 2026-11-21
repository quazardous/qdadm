/**
 * Keeping a page's domain from page to page (#5412).
 *
 * A page placed by its address (`?domain=`) hands its domain on to the pages
 * of the same record chain: its list, its records, their edit and create
 * pages, their children. The kernel's guard adds `?domain=<name>` to such a
 * navigation, so a link, a reload or a shared address keeps the domain. The
 * side menu leaves it: a click there goes out. A domain the app's resolver
 * chose is not written in the address: the resolver decides on each page.
 *
 * `withDomain(to)` (or `useDomainLink().withDomain`) does the same on an
 * app's own link to elsewhere.
 */
import { inject } from 'vue'
import type { LocationQueryRaw, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { ActiveStack } from '../chain/ActiveStack'
import { DOMAIN_QUERY } from './registry'

// The side menu says the next navigation leaves the domain
let leaving = false

/** The next navigation leaves the current domain (the side menu calls it) */
export function leaveDomain(): void {
  leaving = true
}

/** Read and reset the mark (the kernel's guard) */
export function takeLeaveDomain(): boolean {
  const was = leaving
  leaving = false
  return was
}

type RouteMetaLike = Pick<RouteLocationNormalized, 'meta'>
interface ParentMeta {
  entity: string
  parent?: ParentMeta
}

/** The entities a route stands on: its own, then its parents' */
export function entitiesOfRoute(route: RouteMetaLike): Set<string> {
  const out = new Set<string>()
  const meta = route.meta ?? {}
  if (typeof meta.entity === 'string') out.add(meta.entity)
  let parent = meta.parent as ParentMeta | undefined
  while (parent) {
    if (typeof parent.entity === 'string') out.add(parent.entity)
    parent = parent.parent
  }
  return out
}

/**
 * The domain a navigation keeps, or null: the page we leave was placed by
 * `?domain=`, the next one stands on one of its entities,
 * says nothing of a domain itself, and was not reached from the side menu.
 */
export function keptDomain(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  current: { name: string; source: string } | null,
  leavingNow: boolean
): string | null {
  if (leavingNow || !current || current.source !== 'query') return null
  if (to.query?.[DOMAIN_QUERY] !== undefined) return null
  if (to.meta?.domain !== undefined) return null
  const here = entitiesOfRoute(from)
  if (!here.size) return null
  for (const e of entitiesOfRoute(to)) if (here.has(e)) return current.name
  return null
}

/** `to`, with `?domain=<name>`; unchanged without a domain */
export function withDomain(to: RouteLocationRaw, domain: string | null | undefined): RouteLocationRaw {
  if (!domain) return to
  if (typeof to === 'string') {
    const [path, search = ''] = to.split('?') as [string, string?]
    const query: LocationQueryRaw = Object.fromEntries(new URLSearchParams(search))
    return { path, query: { ...query, [DOMAIN_QUERY]: domain } }
  }
  const query = ('query' in to && to.query ? to.query : {}) as LocationQueryRaw
  return { ...to, query: { ...query, [DOMAIN_QUERY]: domain } } as RouteLocationRaw
}

/** `withDomain` with the page's current domain, from the active stack */
export function useDomainLink(): { withDomain: (to: RouteLocationRaw) => RouteLocationRaw; domain: () => string | null } {
  const stack = inject<ActiveStack | null>('qdadmActiveStack', null)
  const domain = () => stack?.getDomain()?.name ?? null
  return { withDomain: (to) => withDomain(to, domain()), domain }
}
