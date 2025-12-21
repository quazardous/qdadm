/**
 * useNavContext - Route-aware navigation context for breadcrumb and navlinks
 *
 * Builds navigation from route path pattern analysis (not heuristics).
 *
 * The route path pattern defines the navigation structure:
 *   - Static segments (e.g., 'books') → entity list
 *   - Param segments (e.g., ':id', ':bookId') → entity item
 *   - Action segments (e.g., 'edit', 'create') → ignored
 *
 * Route meta configuration:
 *   - meta.entity: Entity managed by this route (required)
 *   - meta.parent: Parent entity config for nested routes
 *     - parent.entity: Parent entity name
 *     - parent.param: Route param for parent ID
 *
 * Examples:
 *   Path: /books              meta: { entity: 'books' }
 *   → Home > Books
 *
 *   Path: /books/:id/edit     meta: { entity: 'books' }
 *   → Home > Books > "Le Petit Prince"
 *
 *   Path: /books/:bookId/loans   meta: { entity: 'loans', parent: { entity: 'books', param: 'bookId' } }
 *   → Home > Books > "Le Petit Prince" > Loans
 *
 *   Path: /books/:bookId/loans/:id/edit   meta: { entity: 'loans', parent: { entity: 'books', param: 'bookId' } }
 *   → Home > Books > "Le Petit Prince" > Loans > "Loan #abc123"
 */
import { ref, computed, watch, inject, unref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSiblingRoutes } from '../module/moduleRegistry.js'

// Action segments that don't appear in breadcrumb
const ACTION_SEGMENTS = ['edit', 'create', 'new', 'show', 'view', 'delete']

export function useNavContext(options = {}) {
  const route = useRoute()
  const router = useRouter()

  // Injected dependencies
  const orchestrator = inject('qdadmOrchestrator', null)
  const homeRouteName = inject('qdadmHomeRoute', null)

  // Entity data cache
  const entityDataCache = ref(new Map())

  function getManager(entityName) {
    return orchestrator?.get(entityName)
  }

  function routeExists(name) {
    return router.getRoutes().some(r => r.name === name)
  }

  // ============================================================================
  // PATH PATTERN ANALYSIS
  // ============================================================================

  /**
   * Parse route path pattern into typed segments
   *
   * Input: '/books/:bookId/loans/:id/edit'
   * Output: [
   *   { type: 'static', value: 'books' },
   *   { type: 'param', value: 'bookId' },
   *   { type: 'static', value: 'loans' },
   *   { type: 'param', value: 'id' },
   *   { type: 'action', value: 'edit' }
   * ]
   */
  function parsePathPattern(pathPattern) {
    const segments = []
    const parts = pathPattern.split('/').filter(Boolean)

    for (const part of parts) {
      if (part.startsWith(':')) {
        // Param segment: :id, :bookId
        segments.push({ type: 'param', value: part.slice(1) })
      } else if (ACTION_SEGMENTS.includes(part.toLowerCase())) {
        // Action segment: edit, create, show
        segments.push({ type: 'action', value: part })
      } else {
        // Static segment: books, loans
        segments.push({ type: 'static', value: part })
      }
    }

    return segments
  }

  /**
   * Build navigation chain from parsed path segments + route meta
   *
   * Uses route meta to know which entity each static segment represents.
   * The meta.parent chain declares the entity hierarchy.
   */
  function buildNavChain(pathSegments, routeMeta, routeParams) {
    const chain = []
    const meta = routeMeta || {}

    // Collect all entities in the hierarchy (parent chain + current)
    const entityHierarchy = []

    // Build parent chain (oldest ancestor first)
    function collectParents(parentConfig) {
      if (!parentConfig) return
      const parentManager = getManager(parentConfig.entity)
      if (!parentManager) return

      // Check if this parent has its own parent
      const parentRoute = router.getRoutes().find(r =>
        r.name === `${parentManager.routePrefix}-edit`
      )
      if (parentRoute?.meta?.parent) {
        collectParents(parentRoute.meta.parent)
      }

      entityHierarchy.push({
        entity: parentConfig.entity,
        manager: parentManager,
        idParam: parentConfig.param
      })
    }

    collectParents(meta.parent)

    // Add current entity
    if (meta.entity) {
      const currentManager = getManager(meta.entity)
      if (currentManager) {
        entityHierarchy.push({
          entity: meta.entity,
          manager: currentManager,
          idParam: 'id'  // Standard param for current entity
        })
      }
    }

    // Now build chain from hierarchy
    for (const { entity, manager, idParam } of entityHierarchy) {
      const entityId = routeParams[idParam]

      // Add list segment
      chain.push({
        type: 'list',
        entity,
        manager,
        label: manager.labelPlural || manager.name,
        routeName: manager.routePrefix
      })

      // Add item segment if we have an ID for this entity
      if (entityId) {
        chain.push({
          type: 'item',
          entity,
          manager,
          id: entityId,
          routeName: `${manager.routePrefix}-edit`
        })
      }
    }

    // Handle child-list case: when on a child route without :id
    // The last segment is a child-list, not a regular list
    if (meta.parent && !routeParams.id && chain.length > 0) {
      const lastSegment = chain[chain.length - 1]
      if (lastSegment.type === 'list') {
        lastSegment.type = 'child-list'
        lastSegment.navLabel = meta.navLabel
      }
    }

    return chain
  }

  // ============================================================================
  // COMPUTED NAVIGATION CHAIN
  // ============================================================================

  /**
   * Parsed path segments from current route
   */
  const pathSegments = computed(() => {
    // Get the matched route's path pattern
    const matched = route.matched
    if (!matched.length) return []

    // Use the last matched route's full path
    const lastMatch = matched[matched.length - 1]
    return parsePathPattern(lastMatch.path)
  })

  /**
   * Navigation chain built from path analysis
   */
  const navChain = computed(() => {
    return buildNavChain(pathSegments.value, route.meta, route.params)
  })

  // ============================================================================
  // ENTITY DATA FETCHING
  // ============================================================================

  const chainData = ref(new Map())  // Map: chainIndex -> entityData

  /**
   * Fetch entity data for all 'item' segments in the chain
   */
  watch([navChain, () => options.entityData], async ([chain]) => {
    chainData.value.clear()
    const externalData = unref(options.entityData)

    for (let i = 0; i < chain.length; i++) {
      const segment = chain[i]
      if (segment.type !== 'item') continue

      // For the last item, use external data if provided (from useForm)
      const isLastItem = !chain.slice(i + 1).some(s => s.type === 'item')
      if (isLastItem && externalData) {
        chainData.value.set(i, externalData)
        continue
      }

      // Fetch from manager
      try {
        const data = await segment.manager.get(segment.id)
        chainData.value.set(i, data)
      } catch (e) {
        console.warn(`[useNavContext] Failed to fetch ${segment.entity}:${segment.id}`, e)
      }
    }
  }, { immediate: true, deep: true })

  // ============================================================================
  // BREADCRUMB
  // ============================================================================

  const homeItem = computed(() => {
    if (!homeRouteName || !routeExists(homeRouteName)) return null
    return {
      label: homeRouteName === 'dashboard' ? 'Dashboard' : 'Home',
      to: { name: homeRouteName },
      icon: 'pi pi-home'
    }
  })

  const breadcrumb = computed(() => {
    const items = []
    const chain = navChain.value

    // Home
    if (homeItem.value) {
      items.push(homeItem.value)
    }

    // Build from chain
    for (let i = 0; i < chain.length; i++) {
      const segment = chain[i]
      const isLast = i === chain.length - 1

      if (segment.type === 'list') {
        items.push({
          label: segment.label,
          to: { name: segment.routeName }
        })
      } else if (segment.type === 'item') {
        const data = chainData.value.get(i)
        const label = data ? segment.manager.getEntityLabel(data) : '...'

        items.push({
          label,
          to: isLast ? null : { name: segment.routeName, params: { id: segment.id } }
        })
      } else if (segment.type === 'child-list') {
        items.push({
          label: segment.navLabel || segment.label
        })
      }
    }

    return items
  })

  // ============================================================================
  // NAVLINKS (for child routes)
  // ============================================================================

  const parentConfig = computed(() => route.meta?.parent)

  const parentId = computed(() => {
    if (!parentConfig.value) return null
    return route.params[parentConfig.value.param]
  })

  const navlinks = computed(() => {
    if (!parentConfig.value) return []

    const { entity: parentEntity, param, itemRoute } = parentConfig.value
    const parentManager = getManager(parentEntity)
    if (!parentManager) return []

    const parentRouteName = itemRoute || `${parentManager.routePrefix}-edit`
    const isOnParent = route.name === parentRouteName

    // Details link
    const links = [{
      label: 'Details',
      to: { name: parentRouteName, params: { id: parentId.value } },
      active: isOnParent
    }]

    // Sibling routes
    const siblings = getSiblingRoutes(parentEntity, param)
    for (const sibling of siblings) {
      const sibManager = sibling.meta?.entity ? getManager(sibling.meta.entity) : null
      links.push({
        label: sibling.meta?.navLabel || sibManager?.labelPlural || sibling.name,
        to: { name: sibling.name, params: route.params },
        active: route.name === sibling.name
      })
    }

    return links
  })

  // ============================================================================
  // CONVENIENCE ACCESSORS
  // ============================================================================

  const entityData = computed(() => {
    const chain = navChain.value
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i].type === 'item') {
        return chainData.value.get(i) || null
      }
    }
    return null
  })

  const parentData = computed(() => {
    const chain = navChain.value
    let foundCurrent = false
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i].type === 'item') {
        if (foundCurrent) return chainData.value.get(i) || null
        foundCurrent = true
      }
    }
    return null
  })

  return {
    // Analysis
    pathSegments,
    navChain,

    // Data
    entityData,
    parentData,
    chainData,

    // Navigation
    breadcrumb,
    navlinks,

    // Helpers
    parentConfig,
    parentId
  }
}
