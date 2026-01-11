/**
 * useNavContext - Route-aware navigation context for breadcrumb and navlinks
 *
 * Uses semantic breadcrumb as the source of truth for navigation structure.
 * Entity data comes from activeStack (set by useEntityItemPage/useForm).
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
import { useStackHydrator } from '../chain/useStackHydrator.js'

export function useNavContext(options = {}) {
  const route = useRoute()
  const router = useRouter()

  // Semantic breadcrumb as source of truth
  const { breadcrumb: semanticBreadcrumb } = useSemanticBreadcrumb()

  // Injected dependencies
  const orchestrator = inject('qdadmOrchestrator', null)
  const homeRouteName = inject('qdadmHomeRoute', null)

  // Stack hydrator for entity data (has async-loaded data and labels)
  const hydrator = useStackHydrator()

  function getManager(entityName) {
    return orchestrator?.get(entityName)
  }

  function routeExists(name) {
    return router.getRoutes().some(r => r.name === name)
  }

  /**
   * Get default item route for an entity manager
   * - Read-only entities: use -show suffix
   * - Editable entities: use -edit suffix
   * @param {EntityManager} manager
   * @returns {string} Route name
   */
  function getDefaultItemRoute(manager) {
    if (!manager) return null
    const suffix = manager.readOnly ? '-show' : '-edit'
    return `${manager.routePrefix}${suffix}`
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
        // For child routes, prefer route's navLabel over manager's labelPlural
        const routeRecord = item.route ? router.getRoutes().find(r => r.name === item.route) : null
        const label = routeRecord?.meta?.navLabel || manager?.labelPlural || item.entity
        chain.push({
          type: 'list',
          entity: item.entity,
          manager,
          label,
          routeName: item.route || manager?.routePrefix || item.entity.slice(0, -1)
        })
      } else if (item.kind.startsWith('entity-') && item.id) {
        // entity-show, entity-edit, entity-delete
        const manager = getManager(item.entity)
        chain.push({
          type: 'item',
          entity: item.entity,
          manager,
          id: item.id,
          routeName: getDefaultItemRoute(manager)
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
  // ENTITY DATA FROM ACTIVESTACK
  // ============================================================================

  const chainData = ref(new Map())  // Map: chainIndex -> entityData

  /**
   * Build chainData from stackHydrator levels
   *
   * StackHydrator fetches entity data asynchronously and provides labels.
   * Each hydrated level has .data and .label fields when loaded.
   */
  watch([navChain, hydrator.levels], ([chain, levels]) => {
    // Build new Map (reassignment triggers Vue reactivity)
    const newChainData = new Map()

    for (let i = 0; i < chain.length; i++) {
      const segment = chain[i]
      if (segment.type !== 'item') continue

      // Find matching data in hydrator by entity name and id
      const hydratedLevel = levels.find(l => l.entity === segment.entity && String(l.id) === String(segment.id))
      if (hydratedLevel?.data) {
        newChainData.set(i, hydratedLevel.data)
      }
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
        const idField = segment.manager?.idField || 'id'

        // Only create link if we have a valid id
        const canLink = !isLast && segment.id && segment.routeName && routeExists(segment.routeName)
        items.push({
          label,
          to: canLink ? { name: segment.routeName, params: { [idField]: segment.id } } : null
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

    // Guard: need valid manager and parentId to build links
    if (!parentManager || !parentId.value) return []

    const parentRouteName = itemRoute || getDefaultItemRoute(parentManager)
    const isOnParent = route.name === parentRouteName

    // Details link - use manager's idField for param name
    const links = [{
      label: 'Details',
      to: { name: parentRouteName, params: { [parentManager.idField]: parentId.value } },
      active: isOnParent
    }]

    // Sibling routes - only include list routes (not create/edit/show)
    // List routes are navigable tabs, while create/edit/show are accessed via the list
    const siblings = getSiblingRoutes(parentEntity, param)
      .filter(sibling => sibling.meta?.layout === 'list')
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
