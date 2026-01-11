/**
 * ZonesCollector - Debug collector for Zone Registry visualization
 *
 * This collector provides real-time visibility into the zone system:
 * - All defined zones
 * - Blocks registered in each zone
 * - Wrapper chains
 * - Visual highlighting of zones on the page
 *
 * Unlike event collectors, this shows current state rather than historical events.
 *
 * @example
 * const collector = new ZonesCollector()
 * collector.install(ctx)
 * collector.getZoneInfo() // { zones: [...], totalBlocks: n }
 */

import { Collector } from './Collector.js'

/**
 * Collector for Zone Registry state visualization
 */
export class ZonesCollector extends Collector {
  /**
   * Collector name identifier
   * @type {string}
   */
  static name = 'zones'

  /**
   * This collector shows state, not events
   * @type {boolean}
   */
  static records = false

  constructor(options = {}) {
    super(options)
    this._registry = null
    this._ctx = null
    this._highlightedZone = null
    this._overlays = new Map()
    this._showCurrentPageOnly = options.showCurrentPageOnly ?? true
    this._showInternalZones = options.showInternalZones ?? false
    this._routerCleanup = null
  }

  /**
   * Internal install - get zone registry reference and subscribe to navigation
   * @param {object} ctx - Context object
   * @protected
   */
  _doInstall(ctx) {
    this._ctx = ctx
    this._registry = ctx.zones
    if (!this._registry) {
      console.warn('[ZonesCollector] No zone registry found in context')
    }
    this._setupRouterListener()
  }

  /**
   * Setup router listener for navigation changes
   * @private
   */
  _setupRouterListener() {
    const router = this._ctx?.router
    if (!router) {
      setTimeout(() => this._setupRouterListener(), 100)
      return
    }

    // Listen to route changes - zones on page may differ
    this._routerCleanup = router.afterEach(() => {
      // Small delay to let DOM update
      setTimeout(() => this.notifyChange(), 50)
    })
  }

  /**
   * Internal uninstall - cleanup highlights and router listener
   * @protected
   */
  _doUninstall() {
    this.clearHighlights()
    if (this._routerCleanup) {
      this._routerCleanup()
      this._routerCleanup = null
    }
    this._registry = null
    this._ctx = null
  }

  /**
   * Check if a zone is rendered on the current page
   * @param {string} zoneName - Zone name to check
   * @returns {boolean}
   *
   * Note: Internal zones (prefixed with _) are currently considered always on page
   * since they're typically global (app:debug, app:toasts). If contextual internal
   * zones are needed later, consider using a different prefix convention (e.g. `__`
   * for global, `_` for contextual) or adding a `global` flag to zone config.
   */
  isZoneOnPage(zoneName) {
    // Internal zones are global, always considered "on page"
    // TODO: revisit if contextual internal zones are needed
    if (zoneName.startsWith('_')) {
      return true
    }
    const escapedName = CSS.escape(zoneName)
    return document.querySelector(`[data-zone="${zoneName}"], .zone-${escapedName}`) !== null
  }

  /**
   * Get/set filter for current page zones only
   * @type {boolean}
   */
  get showCurrentPageOnly() {
    return this._showCurrentPageOnly
  }

  set showCurrentPageOnly(value) {
    this._showCurrentPageOnly = value
  }

  /**
   * Toggle current page filter
   * @returns {boolean} New filter state
   */
  toggleFilter() {
    this._showCurrentPageOnly = !this._showCurrentPageOnly
    return this._showCurrentPageOnly
  }

  /**
   * Get/set filter for internal zones (prefixed with _)
   * @type {boolean}
   */
  get showInternalZones() {
    return this._showInternalZones
  }

  set showInternalZones(value) {
    this._showInternalZones = value
  }

  /**
   * Toggle internal zones filter
   * @returns {boolean} New filter state
   */
  toggleInternalFilter() {
    this._showInternalZones = !this._showInternalZones
    return this._showInternalZones
  }

  /**
   * Get badge - show number of zones (filtered if filter active)
   * @returns {number}
   */
  getBadge() {
    if (!this._registry) return 0
    let count = 0
    for (const [name] of this._registry._zones) {
      // Skip internal zones (prefixed with _) unless showing them
      if (name.startsWith('_') && !this._showInternalZones) continue
      // Apply page filter if enabled
      if (this._showCurrentPageOnly && !this.isZoneOnPage(name)) continue
      count++
    }
    return count
  }

  /**
   * Get all zone information for display
   * @param {boolean} [forceAll=false] - If true, ignore filter and return all zones
   * @returns {Array<object>} Zone info array
   */
  getEntries(forceAll = false) {
    if (!this._registry) return []

    const zones = []
    for (const [name, config] of this._registry._zones) {
      // Skip internal zones (prefixed with _) unless showing them
      if (name.startsWith('_') && !this._showInternalZones) {
        continue
      }

      // Apply filter if enabled
      const isOnPage = this.isZoneOnPage(name)
      if (!forceAll && this._showCurrentPageOnly && !isOnPage) {
        continue
      }

      const blocks = this._registry.getBlocks(name)
      zones.push({
        name,
        isOnPage,
        hasDefault: !!config.default,
        defaultName: config.default?.name || config.default?.__name || null,
        blocksCount: blocks.length,
        blocks: blocks.map(b => ({
          id: b.id || '(anonymous)',
          weight: b.weight,
          component: b.component?.name || b.component?.__name || 'Component',
          hasWrappers: !!(b.wrappers && b.wrappers.length),
          wrappersCount: b.wrappers?.length || 0,
          wrappers: b.wrappers?.map(w => ({
            component: w.component?.name || w.component?.__name || 'Wrapper',
            weight: w.weight
          })) || []
        }))
      })
    }
    return zones.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Highlight a zone on the page
   * Creates a visual overlay around zone elements
   * @param {string} zoneName - Zone name to highlight
   */
  highlightZone(zoneName) {
    this.clearHighlights()
    this._highlightedZone = zoneName

    // Find zone elements by data attribute
    // Note: CSS.escape() handles special characters like colons in zone names
    const escapedName = CSS.escape(zoneName)
    const elements = document.querySelectorAll(`[data-zone="${zoneName}"], .zone-${escapedName}`)

    elements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect()
      const overlay = document.createElement('div')
      overlay.className = 'qdadm-zone-overlay'
      overlay.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border: 2px dashed #8b5cf6;
        background: rgba(139, 92, 246, 0.1);
        pointer-events: none;
        z-index: 99998;
        transition: all 0.2s;
      `

      // Label
      const label = document.createElement('div')
      label.style.cssText = `
        position: absolute;
        top: -20px;
        left: 0;
        background: #8b5cf6;
        color: white;
        padding: 2px 6px;
        font-size: 10px;
        font-family: system-ui, sans-serif;
        border-radius: 2px;
        white-space: nowrap;
      `
      label.textContent = zoneName
      overlay.appendChild(label)

      document.body.appendChild(overlay)
      this._overlays.set(`${zoneName}-${idx}`, overlay)
    })
  }

  /**
   * Clear all zone highlights
   */
  clearHighlights() {
    this._overlays.forEach(overlay => overlay.remove())
    this._overlays.clear()
    this._highlightedZone = null
  }

  /**
   * Get currently highlighted zone
   * @returns {string|null}
   */
  getHighlightedZone() {
    return this._highlightedZone
  }

  /**
   * Toggle zone highlight
   * @param {string} zoneName - Zone name
   * @returns {boolean} Whether zone is now highlighted
   */
  toggleHighlight(zoneName) {
    if (this._highlightedZone === zoneName) {
      this.clearHighlights()
      return false
    } else {
      this.highlightZone(zoneName)
      return true
    }
  }
}
