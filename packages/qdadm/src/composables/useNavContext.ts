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
import { ref, computed, watch, inject, type Ref, type ComputedRef } from 'vue'
import { useRoute, useRouter, type RouteParamsRawGeneric } from 'vue-router'
import { getSiblingRoutes } from '../module/moduleRegistry'
import { useSemanticBreadcrumb, type SemanticBreadcrumbItem } from './useSemanticBreadcrumb'
import { useStackHydrator, type HydratedLevel } from '../chain/useStackHydrator'

/**
 * Navigation chain segment types
 */
export type NavChainType = 'list' | 'item' | 'create' | 'route' | 'child-list'

/**
 * Navigation chain segment
 */
export interface NavChainSegment {
  type: NavChainType
  entity?: string
  manager?: EntityManager | null
  id?: string
  label?: string
  routeName?: string | null
  navLabel?: string
  route?: string
}

/**
 * Entity manager interface
 */
interface EntityManager {
  routePrefix?: string
  labelPlural?: string
  idField?: string
  readOnly?: boolean
  getEntityLabel: (data: unknown) => string
}

/**
 * Orchestrator interface
 */
interface Orchestrator {
  get: (entityName: string) => EntityManager | null
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string
  to?: { name: string; params?: RouteParamsRawGeneric } | null
  icon?: string
}

/**
 * Nav link item
 */
export interface NavLinkItem {
  label: string
  to: { name: string; params?: RouteParamsRawGeneric }
  active: boolean
}

/**
 * Parent config from route meta
 */
interface ParentConfig {
  entity: string
  param: string
  itemRoute?: string
}

/**
 * Options for useNavContext
 */
export interface UseNavContextOptions {
  [key: string]: unknown
}

/**
 * Return type for useNavContext
 */
export interface UseNavContextReturn {
  // Analysis
  navChain: ComputedRef<NavChainSegment[]>
  semanticBreadcrumb: ComputedRef<SemanticBreadcrumbItem[]>

  // Data
  entityData: ComputedRef<unknown | null>
  parentData: ComputedRef<unknown | null>
  chainData: Ref<Map<number, unknown>>

  // Navigation
  breadcrumb: ComputedRef<BreadcrumbItem[]>
  navlinks: ComputedRef<NavLinkItem[]>

  // Helpers
  parentConfig: ComputedRef<ParentConfig | undefined>
  parentId: ComputedRef<unknown | null>
}

export function useNavContext(_options: UseNavContextOptions = {}): UseNavContextReturn {
  const route = useRoute()
  const router = useRouter()

  // Semantic breadcrumb as source of truth
  const { breadcrumb: semanticBreadcrumb } = useSemanticBreadcrumb()

  // Injected dependencies
  const orchestrator = inject<Orchestrator | null>('qdadmOrchestrator', null)
  const homeRouteName = inject<string | null>('qdadmHomeRoute', null)

  // Stack hydrator for entity data (has async-loaded data and labels)
  const hydrator = useStackHydrator()

  function getManager(entityName: string): EntityManager | null {
    return orchestrator?.get(entityName) ?? null
  }

  function routeExists(name: string): boolean {
    return router.getRoutes().some((r) => r.name === name)
  }

  /**
   * Get default item route for an entity manager
   * Checks which routes actually exist and returns the appropriate one:
   * - Prefers -edit if it exists (editable entity)
   * - Falls back to -show if -edit doesn't exist
   * @param manager - Entity manager
   * @returns Route name or null if neither exists
   */
  function getDefaultItemRoute(manager: EntityManager | null): string | null {
    if (!manager) return null

    const editRoute = `${manager.routePrefix}-edit`
    const showRoute = `${manager.routePrefix}-show`

    // Check which routes actually exist and return the first available
    if (router.hasRoute(editRoute)) return editRoute
    if (router.hasRoute(showRoute)) return showRoute

    return null
  }

  /**
   * Convert semantic breadcrumb to navigation chain format
   * Maps semantic kinds to chain types for compatibility
   */
  function semanticToNavChain(semantic: SemanticBreadcrumbItem[]): NavChainSegment[] {
    const chain: NavChainSegment[] = []

    for (const item of semantic) {
      if (item.kind === 'entity-list') {
        const manager = getManager(item.entity!)
        // For child routes, prefer route's navLabel over manager's labelPlural
        const routeRecord = item.route
          ? router.getRoutes().find((r) => r.name === item.route)
          : null
        const label =
          (routeRecord?.meta?.navLabel as string) || manager?.labelPlural || item.entity!
        chain.push({
          type: 'list',
          entity: item.entity,
          manager,
          label,
          routeName: item.route || manager?.routePrefix || item.entity!.slice(0, -1),
        })
      } else if (item.kind?.startsWith('entity-') && item.id) {
        // entity-show, entity-edit, entity-delete
        const manager = getManager(item.entity!)
        chain.push({
          type: 'item',
          entity: item.entity,
          manager,
          id: item.id,
          routeName: getDefaultItemRoute(manager),
        })
      } else if (item.kind === 'entity-create') {
        // Create page - treat as special list
        const manager = getManager(item.entity!)
        chain.push({
          type: 'create',
          entity: item.entity,
          manager,
          label: 'Create',
          routeName: manager ? `${manager.routePrefix}-create` : null,
        })
      } else if (item.kind === 'route') {
        // Generic route (like /books/stats)
        // Use label from semantic item if provided (custom breadcrumb), else lookup route
        const routeRecord = router.getRoutes().find((r) => r.name === item.route)
        chain.push({
          type: 'route',
          route: item.route,
          label:
            item.label ||
            (routeRecord?.meta?.navLabel as string) ||
            (routeRecord?.meta?.title as string) ||
            item.route,
          routeName: item.route,
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

  const chainData = ref<Map<number, unknown>>(new Map()) // Map: chainIndex -> entityData

  /**
   * Build chainData from stackHydrator levels
   *
   * StackHydrator fetches entity data asynchronously and provides labels.
   * Each hydrated level has .data and .label fields when loaded.
   */
  watch(
    [navChain, hydrator.levels],
    ([chain, levels]: [NavChainSegment[], HydratedLevel[]]) => {
      // Build new Map (reassignment triggers Vue reactivity)
      const newChainData = new Map<number, unknown>()

      for (let i = 0; i < chain.length; i++) {
        const segment = chain[i]
        if (!segment || segment.type !== 'item') continue

        // Find matching data in hydrator by entity name and id
        const hydratedLevel = levels.find(
          (l) => l.entity === segment.entity && String(l.id) === String(segment.id)
        )
        if (hydratedLevel?.data) {
          newChainData.set(i, hydratedLevel.data)
        }
      }

      // Assign new Map to trigger reactivity
      chainData.value = newChainData
    },
    { immediate: true, deep: true }
  )

  // ============================================================================
  // BREADCRUMB
  // ============================================================================

  const homeItem = computed(() => {
    if (!homeRouteName || !routeExists(homeRouteName)) return null
    return {
      label: homeRouteName === 'dashboard' ? 'Dashboard' : 'Home',
      to: { name: homeRouteName },
      icon: 'pi pi-home',
    }
  })

  const breadcrumb = computed(() => {
    const items: BreadcrumbItem[] = []
    const chain = navChain.value

    // Home
    if (homeItem.value) {
      items.push(homeItem.value)
    }

    // Build from chain
    for (let i = 0; i < chain.length; i++) {
      const segment = chain[i]
      if (!segment) continue
      const isLast = i === chain.length - 1

      if (segment.type === 'list') {
        items.push({
          label: segment.label!,
          to:
            isLast || !segment.routeName || !routeExists(segment.routeName)
              ? null
              : { name: segment.routeName },
        })
      } else if (segment.type === 'item') {
        const data = chainData.value.get(i)
        const label = data && segment.manager ? segment.manager.getEntityLabel(data) : '...'
        const idField = segment.manager?.idField || 'id'

        // Only create link if we have a valid id
        const canLink = !isLast && segment.id && segment.routeName && routeExists(segment.routeName)
        items.push({
          label,
          to: canLink ? { name: segment.routeName!, params: { [idField]: segment.id } } : null,
        })
      } else if (segment.type === 'create') {
        items.push({
          label: segment.label!,
        })
      } else if (segment.type === 'route') {
        // Generic route (e.g., /books/stats)
        items.push({
          label: segment.label!,
          to:
            isLast || !segment.routeName || !routeExists(segment.routeName)
              ? null
              : { name: segment.routeName },
        })
      } else if (segment.type === 'child-list') {
        items.push({
          label: segment.navLabel || segment.label!,
        })
      }
    }

    return items
  })

  // ============================================================================
  // NAVLINKS (for child routes)
  // ============================================================================

  const parentConfig = computed(() => route.meta?.parent as ParentConfig | undefined)

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
    const links: NavLinkItem[] = [
      {
        label: 'Details',
        to: {
          name: parentRouteName!,
          params: { [parentManager.idField!]: parentId.value as string },
        },
        active: isOnParent,
      },
    ]

    // Sibling routes - only include list routes (not create/edit/show)
    // List routes are navigable tabs, while create/edit/show are accessed via the list
    const siblings = getSiblingRoutes(parentEntity, param).filter(
      (sibling) => sibling.meta?.layout === 'list' || sibling.meta?.layout === 'page'
    )
    for (const sibling of siblings) {
      const sibManager = sibling.meta?.entity ? getManager(sibling.meta.entity as string) : null
      links.push({
        label:
          (sibling.meta?.navLabel as string) || sibManager?.labelPlural || (sibling.name as string),
        to: { name: sibling.name as string, params: route.params as RouteParamsRawGeneric },
        active: route.name === sibling.name,
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
      if (chain[i]?.type === 'item') {
        return chainData.value.get(i) || null
      }
    }
    return null
  })

  const parentData = computed(() => {
    const chain = navChain.value
    let foundCurrent = false
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i]?.type === 'item') {
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
    parentId,
  }
}
