/**
 * RouterCollector - Debug collector for Vue Router state
 *
 * Displays current routing information:
 * - Current route (name, path, params, query, meta)
 * - Navigation history (recent route changes)
 * - All registered routes
 *
 * @example
 * const collector = new RouterCollector()
 * collector.install(ctx)
 */

import { Collector, type CollectorContext, type CollectorEntry, type CollectorOptions } from './Collector'
import { computeSemanticBreadcrumb } from '../../composables/useSemanticBreadcrumb'
import type { Router, RouteLocationNormalized, RouteRecordNormalized } from 'vue-router'
import type { ActiveStack, StackLevel } from '../../chain/ActiveStack'
import type { StackHydrator, HydratedLevel } from '../../chain/StackHydrator'

/**
 * Serialized route info
 */
export interface SerializedRoute {
  name: string
  path: string
  fullPath: string
  params: Record<string, string | string[]>
  query: Record<string, string | string[] | null>
  hash: string
  meta: Record<string, unknown>
  matched: Array<{
    name: string | null
    path: string
    meta: Record<string, unknown>
  }>
}

/**
 * Navigation history entry
 */
export interface NavigationEntry extends CollectorEntry {
  id: number
  to: SerializedRoute
  from: SerializedRoute | null
  seen: boolean
}

/**
 * Route list entry
 */
export interface RouteListEntry {
  name: string
  path: string
  meta: Record<string, unknown>
  hasComponent: boolean
  children: number
}

/**
 * Active stack debug info
 */
export interface ActiveStackInfo {
  levels: Array<{
    entity: string
    param: string
    foreignKey: string | null
    id: string | null
    hydrated: boolean
    loading: boolean
    label: string | null
    hasData: boolean
  }>
  depth: number
  current: StackLevel | null
  parent: StackLevel | null
}

/**
 * RouterCollector options
 */
export interface RouterCollectorOptions extends CollectorOptions {
  maxHistory?: number
}

/**
 * Extended context for router collector
 */
interface RouterCollectorContext extends CollectorContext {
  router?: Router
  activeStack?: ActiveStack
  stackHydrator?: StackHydrator
}

/**
 * Collector for Vue Router state visualization
 */
export class RouterCollector extends Collector<NavigationEntry> {
  /**
   * Collector name identifier
   */
  static override collectorName = 'router'

  /**
   * This collector records navigation events
   */
  static override records = true

  private _history: NavigationEntry[] = []
  private _maxHistory: number
  private _removeGuard: (() => void) | null = null
  private _guardInstalled: boolean = false
  private _activeStack: ActiveStack | null = null
  private _stackHydrator: StackHydrator | null = null

  constructor(options: RouterCollectorOptions = {}) {
    super(options)
    this._maxHistory = options.maxHistory ?? 20
  }

  /**
   * Get router lazily (router might not exist at install time)
   * @private
   */
  private get _router(): Router | undefined {
    return (this._ctx as RouterCollectorContext)?.router
  }

  /**
   * Internal install - store context (router is accessed lazily)
   * @protected
   */
  protected override _doInstall(ctx: CollectorContext): void {
    this._ctx = ctx
    const routerCtx = ctx as RouterCollectorContext
    this._activeStack = routerCtx.activeStack ?? null
    this._stackHydrator = routerCtx.stackHydrator ?? null
    // Router guard will be installed lazily when router becomes available
  }

  /**
   * Ensure router guard is installed (called lazily)
   * @private
   */
  private _ensureGuard(): void {
    if (this._guardInstalled || !this._router) return

    // Track navigation with afterEach
    this._removeGuard = this._router.afterEach((to, from) => {
      this._addNavigation(to, from)
    })
    this._guardInstalled = true

    // Add initial route if not on home
    const current = this._router.currentRoute?.value
    if (current && current.path !== '/') {
      this._history.unshift({
        timestamp: Date.now(),
        id: Date.now(),
        to: this._serializeRoute(current),
        from: null,
        seen: false
      })
    }
  }

  /**
   * Add navigation event to history
   * @private
   */
  private _addNavigation(to: RouteLocationNormalized, from: RouteLocationNormalized): void {
    const entry: NavigationEntry = {
      timestamp: Date.now(),
      id: Date.now(),
      to: this._serializeRoute(to),
      from: from?.name ? this._serializeRoute(from) : null,
      seen: false
    }

    // Create new array reference for Vue reactivity
    this._history = [entry, ...this._history.slice(0, this._maxHistory - 1)]

    this.notifyChange()
  }

  /**
   * Serialize route to plain object
   * @private
   */
  private _serializeRoute(route: RouteLocationNormalized): SerializedRoute {
    return {
      name: (route.name as string) || '(unnamed)',
      path: route.path,
      fullPath: route.fullPath,
      params: { ...route.params } as Record<string, string | string[]>,
      query: { ...route.query } as Record<string, string | string[] | null>,
      hash: route.hash,
      meta: { ...route.meta },
      // Matched routes with their individual metas
      matched: route.matched?.map(m => ({
        name: (m.name as string) || null,
        path: m.path,
        meta: { ...m.meta }
      })) ?? []
    }
  }

  /**
   * Internal uninstall - cleanup
   * @protected
   */
  protected override _doUninstall(): void {
    if (this._removeGuard) {
      this._removeGuard()
      this._removeGuard = null
    }
    this._guardInstalled = false
    this._ctx = null
    this._history = []
  }

  /**
   * Get badge - count of unseen navigations
   */
  override getBadge(): number {
    return this._history.filter(h => !h.seen).length
  }

  /**
   * Mark all history as seen
   */
  markSeen(): void {
    for (const item of this._history) {
      item.seen = true
    }
  }

  /**
   * Get current route info
   */
  getCurrentRoute(): SerializedRoute | null {
    this._ensureGuard()
    const router = this._router
    if (!router) return null
    const current = router.currentRoute?.value
    if (!current) return null
    return this._serializeRoute(current)
  }

  /**
   * Get navigation history
   */
  getHistory(): NavigationEntry[] {
    return this._history
  }

  /**
   * Get all registered routes
   */
  getRoutes(): RouteListEntry[] {
    this._ensureGuard()
    if (!this._router) return []

    const routes = this._router.getRoutes()
    return routes.map((route: RouteRecordNormalized) => ({
      name: (route.name as string) || '(unnamed)',
      path: route.path,
      meta: { ...route.meta },
      hasComponent: !!route.components?.default,
      children: route.children?.length || 0
    })).sort((a, b) => a.path.localeCompare(b.path))
  }

  /**
   * Get computed breadcrumb for current route
   * Returns semantic objects per level - adapters resolve labels/paths
   *
   * Uses shared computeSemanticBreadcrumb function from composables.
   *
   * Kinds:
   * - route: Generic route (e.g., home)
   * - entity-list: Entity collection (e.g., /books)
   * - entity-show: Entity instance view
   * - entity-edit: Entity instance edit
   * - entity-create: Entity creation
   */
  getBreadcrumb(): unknown[] {
    this._ensureGuard()
    const current = this._router?.currentRoute?.value
    if (!current) return []

    return computeSemanticBreadcrumb(current.path, this._router!.getRoutes(), current)
  }

  /**
   * Get entries for display (implements Collector interface)
   */
  override getEntries(): NavigationEntry[] {
    return this._history
  }

  /**
   * Clear navigation history
   */
  override clear(): void {
    this._history = []
    this.notifyChange()
  }

  /**
   * Get activeStack state for debugging
   * Combines sync stack (config) with hydrator (async data)
   */
  getActiveStack(): ActiveStackInfo | null {
    if (!this._activeStack) return null

    const syncLevels = this._activeStack.getLevels()
    const hydratorLevels = this._stackHydrator?.getLevels() ?? []

    return {
      levels: syncLevels.map((level, idx) => {
        const hydrated = hydratorLevels[idx] as HydratedLevel | undefined
        return {
          // Sync (from ActiveStack)
          entity: level.entity,
          param: level.param,
          foreignKey: level.foreignKey,
          id: level.id,
          // Async (from StackHydrator)
          hydrated: hydrated?.hydrated ?? false,
          loading: hydrated?.loading ?? false,
          label: hydrated?.label ?? null,
          hasData: !!hydrated?.data,
        }
      }),
      depth: syncLevels.length,
      current: this._activeStack.getCurrent(),
      parent: this._activeStack.getParent(),
    }
  }

  /**
   * Navigate to a path
   * @param path - Path to navigate to
   */
  async navigate(path: string): Promise<void> {
    if (!this._router) return
    await this._router.push(path)
  }
}
