/**
 * Who may open a route: one rule for the router guard, the menu and PageNav
 * (#4962), so the three cannot drift apart.
 *
 * - Every matched record's `meta.permission` must be granted (#4332): a
 *   parent's covers its children.
 * - The route's entity must allow the action it declares: `list` for a list
 *   route, `read` for anything else (#2497). The entity is `meta.entity`, or,
 *   for a child page that has none of its own, the parent's
 *   (`meta.parent.entity`): a page on an item is governed by that item.
 *
 * An app without a security checker checks no permission; an entity that is
 * not registered (yet) is not checked.
 */

/** The part of a resolved route this reads */
export interface RouteLike {
  meta?: Record<string, unknown>
  matched?: Array<{ meta?: Record<string, unknown> }>
}

export interface RouteAccessDeps {
  orchestrator?: {
    isRegistered?: (name: string) => boolean
    get: (name: string) => unknown
  } | null
  checker?: { isGranted: (attribute: string, subject?: unknown) => boolean } | null
}

interface ManagerAccess {
  canList?: () => boolean
  canRead?: () => boolean
  labelPlural?: string
}

/** Why a route is refused, or null when it may be opened */
export type RouteDenial =
  | { kind: 'permission'; permission: string }
  | { kind: 'entity'; entity: string; action: 'list' | 'read'; manager: ManagerAccess }

/** Every permission the route's matched records require */
export function routePermissions(route: RouteLike): string[] {
  const records = route.matched?.length ? route.matched : [{ meta: route.meta }]
  return records.flatMap((record) => {
    const p = record.meta?.permission
    return (Array.isArray(p) ? p : [p]).filter((x): x is string => typeof x === 'string' && x !== '')
  })
}

/** The entity governing the route: its own, else its parent item's */
export function routeEntity(route: RouteLike): string | undefined {
  const own = route.meta?.entity
  if (typeof own === 'string' && own) return own
  const parent = (route.meta?.parent as { entity?: unknown } | undefined)?.entity
  return typeof parent === 'string' && parent ? parent : undefined
}

/** The action the route performs: `list` when it declares it, `read` otherwise */
export function routeAction(route: RouteLike): 'list' | 'read' {
  // A child page runs on an item: `read` of the parent, whatever it declares
  if (!route.meta?.entity) return 'read'
  return route.meta?.entityAction === 'list' ? 'list' : 'read'
}

/** The permission check alone: the first one missing, or null */
export function missingPermission(route: RouteLike, deps: RouteAccessDeps): string | null {
  if (!deps.checker) return null
  return routePermissions(route).find((p) => !deps.checker!.isGranted(p)) ?? null
}

/** The entity check alone: the denial, or null */
export function entityDenial(route: RouteLike, deps: RouteAccessDeps): Extract<RouteDenial, { kind: 'entity' }> | null {
  const entity = routeEntity(route)
  const orchestrator = deps.orchestrator
  if (!entity || !orchestrator) return null
  if (orchestrator.isRegistered && !orchestrator.isRegistered(entity)) return null
  const manager = orchestrator.get(entity) as ManagerAccess | null | undefined
  if (!manager) return null
  const action = routeAction(route)
  const allowed = action === 'list' && manager.canList ? manager.canList() : manager.canRead ? manager.canRead() : true
  return allowed ? null : { kind: 'entity', entity, action, manager }
}

/** Why the route is refused, or null when it may be opened */
export function routeDenial(route: RouteLike, deps: RouteAccessDeps): RouteDenial | null {
  const permission = missingPermission(route, deps)
  if (permission !== null) return { kind: 'permission', permission }
  return entityDenial(route, deps)
}

/** Whether the route may be opened */
export function canOpenRoute(route: RouteLike, deps: RouteAccessDeps): boolean {
  return routeDenial(route, deps) === null
}
