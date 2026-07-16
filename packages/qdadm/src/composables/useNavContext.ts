/**
 * useNavContext - Route-aware navigation context for breadcrumb and navlinks
 *
 * Uses semantic breadcrumb as the source of truth for navigation structure.
 * Entity data comes from activeStack (set by useEntityItemPage/useEntityItemFormPage).
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
import { useI18n } from '../i18n/useI18n'
import type { EntityManagerLike, OrchestratorLike } from '../entity/EntityManager.interface'

// #1191 — shared minimal structural views (was: local redeclarations)
type EntityManager = EntityManagerLike
type Orchestrator = OrchestratorLike


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

/**
 * Orchestrator interface
 */

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string
  to?: { name: string; params?: RouteParamsRawGeneric } | null
  icon?: string
}

/**
 * View↔Edit toggle for the breadcrumb terminal (#1332)
 *
 * Non-null only when the current route is an entity item mode
 * (`entity-show` / `entity-edit`), the twin-mode route exists
 * (`${routePrefix}-edit` / `-show` + `router.hasRoute`), and — for the
 * Edit affordance — `manager.canUpdate()` allows it. The permission check
 * passes the hydrated entity when available, so ownership-conditional
 * permissions are honored once the item is loaded.
 */
export interface BreadcrumbModeToggle {
  /** Mode of the current route — absent on child pages (#1353), where the
   *  page is in neither mode of the parent item */
  current?: 'show' | 'edit'
  /** Mode the link navigates to */
  target: 'show' | 'edit'
  /** Twin-route location — a plain router.push; any dirty-form protection
   *  comes from the form page's own onBeforeRouteLeave guard */
  to: { name: string; params: RouteParamsRawGeneric }
  /** Locale-reactive label: i18n `breadcrumb.view` / `breadcrumb.edit`,
   *  falling back to "View" / "Edit" */
  label: string
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
  modeToggle: ComputedRef<BreadcrumbModeToggle | null>
  modeLinks: ComputedRef<BreadcrumbModeToggle[]>

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

  // i18n for the mode-toggle labels (no-op shim outside a kernel)
  const { i18n: kernelI18n, locale: i18nLocale } = useI18n()

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
        const label = (data && segment.manager ? segment.manager.getEntityLabel(data) : null) ?? '...'
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
    void i18nLocale.value // "Details" label re-resolves on locale change

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
        label: breadcrumbLabel('details', 'Details'),
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

  // ============================================================================
  // MODE TOGGLE / MODE LINKS (#1332, #1353)
  // ============================================================================

  /** Resolve a `breadcrumb.*` label from the i18n catalog, with fallback. */
  function breadcrumbLabel(key: string, fallback: string): string {
    const trace = kernelI18n?.resolve(`breadcrumb.${key}`)
    if (trace?.hit) return trace.result
    return fallback
  }

  function toggleLabel(target: 'show' | 'edit'): string {
    return target === 'edit'
      ? breadcrumbLabel('edit', 'Edit')
      : breadcrumbLabel('view', 'View')
  }

  /** Build one mode link if its route exists and (for edit) permission allows. */
  function buildModeLink(
    manager: EntityManager,
    target: 'show' | 'edit',
    id: unknown,
    permissionEntity: unknown
  ): BreadcrumbModeToggle | null {
    const routeName = `${manager.routePrefix}-${target}`
    if (!router.hasRoute(routeName)) return null
    if (target === 'edit' && !manager.canUpdate(permissionEntity ?? undefined)) return null
    return {
      target,
      to: { name: routeName, params: { [manager.idField || 'id']: id as string } },
      label: toggleLabel(target),
    }
  }

  // Item pages (#1332): the terminal is entity-show/entity-edit — offer the
  // OPPOSITE mode (getDefaultItemRoute's edit-preference is a landing
  // default, not a toggle).
  const modeToggle = computed<BreadcrumbModeToggle | null>(() => {
    void i18nLocale.value // label re-resolves on locale change

    const semantic = semanticBreadcrumb.value
    const terminal = semantic[semantic.length - 1]
    if (!terminal?.entity || !terminal.id) return null
    if (terminal.kind !== 'entity-show' && terminal.kind !== 'entity-edit') return null

    const manager = getManager(terminal.entity)
    if (!manager?.routePrefix) return null

    const current = terminal.kind === 'entity-edit' ? 'edit' : 'show'
    const target = current === 'edit' ? 'show' : 'edit'
    const link = buildModeLink(manager, target, terminal.id, entityData.value)
    return link ? { ...link, current } : null
  })

  // Uniform list for rendering (#1353). Item pages: the single opposite-mode
  // entry (modeToggle). Child pages (route carries meta.parent): the PARENT
  // item's applicable pair — the page is in neither mode, so both View and
  // Edit are offered, each under the same existence/permission rules. On a
  // child page, `entityData` resolves to the parent item (last item segment
  // of the chain), so the canUpdate gate is ownership-aware once hydrated.
  const modeLinks = computed<BreadcrumbModeToggle[]>(() => {
    const itemToggle = modeToggle.value
    if (itemToggle) return [itemToggle]

    void i18nLocale.value
    if (!parentConfig.value || parentId.value == null) return []
    const manager = getManager(parentConfig.value.entity)
    if (!manager?.routePrefix) return []

    return (['show', 'edit'] as const)
      .map((target) => buildModeLink(manager, target, parentId.value, entityData.value))
      .filter((link): link is BreadcrumbModeToggle => link !== null)
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
    modeToggle,
    modeLinks,

    // Helpers
    parentConfig,
    parentId,
  }
}
