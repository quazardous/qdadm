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

import { Collector } from './Collector.js'
import { computeSemanticBreadcrumb } from '../composables/useSemanticBreadcrumb.js'

/**
 * Collector for Vue Router state visualization
 */
export class RouterCollector extends Collector {
  /**
   * Collector name identifier
   * @type {string}
   */
  static name = 'router'

  /**
   * This collector records navigation events
   * @type {boolean}
   */
  static records = true

  constructor(options = {}) {
    super(options)
    this._ctx = null
    this._history = [] // Navigation history
    this._maxHistory = options.maxHistory ?? 20
    this._removeGuard = null
    this._guardInstalled = false
  }

  /**
   * Get router lazily (router might not exist at install time)
   * @returns {object|null}
   * @private
   */
  get _router() {
    return this._ctx?.router
  }

  /**
   * Internal install - store context (router is accessed lazily)
   * @param {object} ctx - Context object
   * @protected
   */
  _doInstall(ctx) {
    this._ctx = ctx
    // Router guard will be installed lazily when router becomes available
  }

  /**
   * Ensure router guard is installed (called lazily)
   * @private
   */
  _ensureGuard() {
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
        id: Date.now(),
        timestamp: new Date(),
        to: this._serializeRoute(current),
        from: null,
        seen: false
      })
    }
  }

  /**
   * Add navigation event to history
   * @param {object} to - Destination route
   * @param {object} from - Source route
   * @private
   */
  _addNavigation(to, from) {
    const entry = {
      id: Date.now(),
      timestamp: new Date(),
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
   * @param {object} route - Vue Router route object
   * @returns {object}
   * @private
   */
  _serializeRoute(route) {
    return {
      name: route.name || '(unnamed)',
      path: route.path,
      fullPath: route.fullPath,
      params: { ...route.params },
      query: { ...route.query },
      hash: route.hash,
      meta: { ...route.meta },
      matched: route.matched?.length || 0
    }
  }

  /**
   * Internal uninstall - cleanup
   * @protected
   */
  _doUninstall() {
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
   * @returns {number}
   */
  getBadge() {
    return this._history.filter(h => !h.seen).length
  }

  /**
   * Mark all history as seen
   */
  markSeen() {
    for (const item of this._history) {
      item.seen = true
    }
  }

  /**
   * Get current route info
   * @returns {object|null}
   */
  getCurrentRoute() {
    this._ensureGuard()
    const router = this._router
    if (!router) return null
    const current = router.currentRoute?.value
    if (!current) return null
    return this._serializeRoute(current)
  }

  /**
   * Get navigation history
   * @returns {Array}
   */
  getHistory() {
    return this._history
  }

  /**
   * Get all registered routes
   * @returns {Array}
   */
  getRoutes() {
    this._ensureGuard()
    if (!this._router) return []

    const routes = this._router.getRoutes()
    return routes.map(route => ({
      name: route.name || '(unnamed)',
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
   *
   * @returns {Array<{kind: string, ...props}>}
   */
  getBreadcrumb() {
    this._ensureGuard()
    const current = this._router?.currentRoute?.value
    if (!current) return []

    return computeSemanticBreadcrumb(current.path, this._router.getRoutes(), current)
  }

  /**
   * Get entries for display (implements Collector interface)
   * @returns {Array}
   */
  getEntries() {
    return this._history
  }

  /**
   * Clear navigation history
   */
  clear() {
    this._history = []
    this.notifyChange()
  }
}
