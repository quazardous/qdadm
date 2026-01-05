/**
 * useNavContext - Route-aware navigation context for breadcrumb and navlinks
 *
 * Uses semantic breadcrumb as the source of truth for navigation structure.
 * Semantic breadcrumb is computed from route path and registered routes.
 *
 * Semantic breadcrumb kinds:
 *   - entity-list: Entity collection (e.g., /books)
 *   - entity-show: Entity instance view (e.g., /books/1)
 *   - entity-edit: Entity instance edit (e.g., /books/1/edit)
 *   - entity-create: Entity creation (e.g., /books/create)
 *   - route: Generic route (e.g., /settings)
 *
 * Examples:
 *   Path: /books              → [{ kind: 'entity-list', entity: 'books' }]
 *   Path: /books/1/edit       → [{ kind: 'entity-list', entity: 'books' }, { kind: 'entity-edit', entity: 'books', id: '1' }]
 *   Path: /books/stats        → [{ kind: 'entity-list', entity: 'books' }, { kind: 'route', route: 'book-stats' }]
 */
import { ref, computed, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSiblingRoutes } from '../module/moduleRegistry.js'
import { useSemanticBreadcrumb } from './useSemanticBreadcrumb.js'

export function useNavContext(options = {}) {
  const route = useRoute()
  const router = useRouter()

  // Semantic breadcrumb as source of truth
  const { breadcrumb: semanticBreadcrumb } = useSemanticBreadcrumb()

  // Injected dependencies
  const orchestrator = inject('qdadmOrchestrator', null)
  const homeRouteName = inject('qdadmHomeRoute', null)

  // Breadcrumb entity data - multi-level Map from AppLayout
  // Updated by pages via setBreadcrumbEntity(data, level)
  // Can be passed directly (for layout component that provides AND uses breadcrumb)
  // or injected from parent (for child pages)
  const breadcrumbEntities = options.breadcrumbEntities ?? inject('qdadmBreadcrumbEntities', null)

  function getManager(entityName) {
    return orchestrator?.get(entityName)
  }

  function routeExists(name) {
    return router.getRoutes().some(r => r.name === name)
  }

  /**
   * Convert semantic breadcrumb to navigation chain format
   * Maps semantic kinds to chain types for compatibility
   */
  function semanticToNavChain(semantic) {
    const chain = []

    for (const item of semantic) {
      if (item.kind === 'entity-list') {
        const manager = getManager(item.entity)
        chain.push({
          type: 'list',
          entity: item.entity,
          manager,
          label: manager?.labelPlural || item.entity,
          routeName: manager?.routePrefix || item.entity.slice(0, -1)
        })
      } else if (item.kind.startsWith('entity-') && item.id) {
        // entity-show, entity-edit, entity-delete
        const manager = getManager(item.entity)
        chain.push({
          type: 'item',
          entity: item.entity,
          manager,
          id: item.id,
          routeName: manager ? `${manager.routePrefix}-edit` : null
        })
      } else if (item.kind === 'entity-create') {
        // Create page - treat as special list
        const manager = getManager(item.entity)
        chain.push({
          type: 'create',
          entity: item.entity,
          manager,
          label: 'Create',
          routeName: manager ? `${manager.routePrefix}-create` : null
        })
      } else if (item.kind === 'route') {
        // Generic route (like /books/stats)
        // Use label from semantic item if provided (custom breadcrumb), else lookup route
        const routeRecord = router.getRoutes().find(r => r.name === item.route)
        chain.push({
          type: 'route',
          route: item.route,
          label: item.label || routeRecord?.meta?.navLabel || routeRecord?.meta?.title || item.route,
          routeName: item.route
        })
      }
    }

    return chain
  }

  // ============================================================================
  // COMPUTED NAVIGATION CHAIN
  // ============================================================================

  /**
   * Navigation chain built from semantic breadcrumb
   */
  const navChain = computed(() => {
    return semanticToNavChain(semanticBreadcrumb.value)
  })

  // ============================================================================
  // ENTITY DATA FETCHING
  // ============================================================================

  const chainData = ref(new Map())  // Map: chainIndex -> entityData

  /**
   * Fetch entity data for all 'item' segments in the chain
   *
   * For the LAST item (current entity):
   * - Uses entityData if provided by the page via setCurrentEntity()
   * - Does NOT fetch automatically - page is responsible for providing data
   * - Breadcrumb shows "..." until page provides the data
   *
   * For PARENT items: always fetches from manager
   */
  // Watch navChain and breadcrumbEntities to populate chainData
  // breadcrumbEntities is a ref to Map: level -> entityData (set by pages via setBreadcrumbEntity)
  // Note: watch ref directly, not () => ref.value, for proper reactivity tracking
  watch([navChain, breadcrumbEntities], async ([chain, entitiesMap]) => {
    // Build new Map (reassignment triggers Vue reactivity, Map.set() doesn't)
    const newChainData = new Map()

    // Count item segments to determine their level (1-based)
    let itemLevel = 0

    for (let i = 0; i < chain.length; i++) {
      const segment = chain[i]
      if (segment.type !== 'item') continue

      itemLevel++
      const isLastItem = !chain.slice(i + 1).some(s => s.type === 'item')

      // Check if page provided data for this level via setBreadcrumbEntity
      const providedData = entitiesMap?.get(itemLevel)
      if (providedData) {
        newChainData.set(i, providedData)
        continue
      }

      // For items without provided data:
      // - Last item: show "..." (page should call setBreadcrumbEntity)
      // - Parent items: fetch from manager
      if (!isLastItem) {
        try {
          const data = await segment.manager.get(segment.id)
          newChainData.set(i, data)
        } catch (e) {
          console.warn(`[useNavContext] Failed to fetch ${segment.entity}:${segment.id}`, e)
        }
      }
      // Last item without data will show "..." in breadcrumb
    }

    // Assign new Map to trigger reactivity
    chainData.value = newChainData
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
          to: isLast ? null : (segment.routeName && routeExists(segment.routeName) ? { name: segment.routeName } : null)
        })
      } else if (segment.type === 'item') {
        const data = chainData.value.get(i)
        const label = data && segment.manager ? segment.manager.getEntityLabel(data) : '...'

        items.push({
          label,
          to: isLast ? null : (segment.routeName && routeExists(segment.routeName) ? { name: segment.routeName, params: { id: segment.id } } : null)
        })
      } else if (segment.type === 'create') {
        items.push({
          label: segment.label
        })
      } else if (segment.type === 'route') {
        // Generic route (e.g., /books/stats)
        items.push({
          label: segment.label,
          to: isLast ? null : (segment.routeName && routeExists(segment.routeName) ? { name: segment.routeName } : null)
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
    navChain,
    semanticBreadcrumb,

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
