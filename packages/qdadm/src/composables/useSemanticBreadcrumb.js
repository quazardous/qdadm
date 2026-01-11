import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Action segments mapping to entity kinds
 */
const ACTION_MAP = {
  edit: 'entity-edit',
  create: 'entity-create',
  new: 'entity-create',
  show: 'entity-show',
  view: 'entity-show',
  delete: 'entity-delete'
}

/**
 * Compute semantic breadcrumb from route path and routes list
 *
 * Pure function that can be used both in Vue composables and outside components.
 *
 * If the matched route has `meta.breadcrumb`, that array is used directly.
 * This allows routes to define a custom breadcrumb structure.
 *
 * @param {string} path - Current route path (e.g., '/books/1/edit')
 * @param {Array} routes - List of all registered routes from router.getRoutes()
 * @param {object} [currentRoute] - Current route object (optional, for meta.breadcrumb support)
 * @returns {Array} Semantic breadcrumb items
 */
export function computeSemanticBreadcrumb(path, routes, currentRoute = null) {
  if (!path) return []

  // Check if route defines a custom breadcrumb
  if (currentRoute?.meta?.breadcrumb) {
    return currentRoute.meta.breadcrumb
  }

  const items = []

  // Filter out catch-all and not-found routes
  const validRoutes = routes.filter(r =>
    r.name !== 'not-found' &&
    !r.path.includes('*') &&
    !r.path.includes(':pathMatch')
  )

  // Note: Home is NOT included in semantic breadcrumb
  // It's a display concern - add it in useBreadcrumb if needed

  const segments = path.split('/').filter(Boolean)
  let currentPath = ''
  let lastEntity = null
  let pendingId = null // Track unmatched segments that could be IDs

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const nextSegment = segments[i + 1]
    currentPath += `/${segment}`

    // Check if this is an action segment
    const actionKind = ACTION_MAP[segment.toLowerCase()]
    if (actionKind && lastEntity) {
      // If we have a pending ID, add a new entity item with action kind
      if (pendingId) {
        items.push({ kind: actionKind, entity: lastEntity, id: pendingId })
        pendingId = null
      } else {
        // No pending ID - update last item's kind (e.g., /books/create)
        const lastItem = items[items.length - 1]
        if (lastItem && lastItem.kind.startsWith('entity-') && !lastItem.id) {
          lastItem.kind = actionKind
        }
      }
      continue
    }

    // Find matching route
    const matchedRoute = validRoutes.find(r => {
      if (r.path === currentPath) return true
      const routeSegs = r.path.split('/').filter(Boolean)
      const pathSegs = currentPath.split('/').filter(Boolean)
      if (routeSegs.length !== pathSegs.length) return false
      return routeSegs.every((rs, idx) => rs.startsWith(':') || rs === pathSegs[idx])
    })

    if (!matchedRoute) {
      // No route found - this segment could be an ID (e.g., /books/1 when route is /books/:id/edit)
      if (lastEntity) {
        pendingId = segment
      }
      continue
    }

    const entity = matchedRoute.meta?.entity || null
    const isParam = matchedRoute.path.split('/').filter(Boolean).some((s, idx) => {
      const pathSegs = currentPath.split('/').filter(Boolean)
      return s.startsWith(':') && idx === pathSegs.length - 1
    })

    if (entity) {
      lastEntity = entity
      pendingId = null // Clear pending ID when we match a route
      if (isParam) {
        // Entity instance - get param value (the ID)
        const paramValue = segment
        // Determine kind based on next segment or route name
        let kind = 'entity-show'
        if (nextSegment && ACTION_MAP[nextSegment.toLowerCase()]) {
          kind = ACTION_MAP[nextSegment.toLowerCase()]
        } else if (matchedRoute.name?.includes('edit')) {
          kind = 'entity-edit'
        }
        items.push({ kind, entity, id: paramValue, route: matchedRoute.name })
      } else {
        // Entity list - include route name for child routes (e.g., 'bot-command' vs 'commands')
        items.push({ kind: 'entity-list', entity, route: matchedRoute.name })
      }
    } else {
      // Generic route
      items.push({ kind: 'route', route: matchedRoute.name || segment })
    }
  }

  return items
}

/**
 * useSemanticBreadcrumb - Vue composable for semantic breadcrumb
 *
 * Returns semantic objects per level - adapters resolve labels/paths for display.
 *
 * Kinds:
 * - route: Generic route (e.g., home, dashboard)
 * - entity-list: Entity collection (e.g., /books)
 * - entity-show: Entity instance view (e.g., /books/1)
 * - entity-edit: Entity instance edit (e.g., /books/1/edit)
 * - entity-create: Entity creation (e.g., /books/create)
 *
 * @example
 * const { breadcrumb } = useSemanticBreadcrumb()
 * // For /books/1/edit returns:
 * // [
 * //   { kind: 'route', route: 'home' },
 * //   { kind: 'entity-list', entity: 'books' },
 * //   { kind: 'entity-edit', entity: 'books', id: '1' }
 * // ]
 */
export function useSemanticBreadcrumb() {
  const route = useRoute()
  const router = useRouter()

  const breadcrumb = computed(() => {
    return computeSemanticBreadcrumb(route.path, router.getRoutes(), route)
  })

  /**
   * Check if an entity is active (present in current breadcrumb)
   * Useful for menu highlighting
   *
   * @param {string} entity - Entity name to check
   * @returns {boolean}
   */
  function isEntityActive(entity) {
    return breadcrumb.value.some(item =>
      item.kind.startsWith('entity-') && item.entity === entity
    )
  }

  /**
   * Get the active entity from breadcrumb (first entity found)
   * @returns {string|null}
   */
  const activeEntity = computed(() => {
    const entityItem = breadcrumb.value.find(item => item.kind.startsWith('entity-'))
    return entityItem?.entity || null
  })

  return {
    breadcrumb,
    isEntityActive,
    activeEntity
  }
}
