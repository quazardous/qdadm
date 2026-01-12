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

import { Collector, type CollectorContext, type CollectorEntry, type CollectorOptions } from './Collector'
import type { ZoneRegistry } from '../../zones/ZoneRegistry'
import type { Router } from 'vue-router'

/**
 * Zone entry type (state-based, not event-based)
 */
export interface ZoneEntry extends CollectorEntry {
  name: string
  isOnPage: boolean
  hasDefault: boolean
  defaultName: string | null
  blocksCount: number
  blocks: ZoneBlock[]
}

/**
 * Zone block info
 */
export interface ZoneBlock {
  id: string
  weight: number
  component: string
  hasWrappers: boolean
  wrappersCount: number
  wrappers: ZoneWrapper[]
}

/**
 * Zone wrapper info
 */
export interface ZoneWrapper {
  component: string
  weight: number
}

/**
 * ZonesCollector options
 */
export interface ZonesCollectorOptions extends CollectorOptions {
  showCurrentPageOnly?: boolean
  showInternalZones?: boolean
}

/**
 * Extended context for zones collector
 */
interface ZonesCollectorContext extends CollectorContext {
  zones?: ZoneRegistry
  router?: Router
}

/**
 * Collector for Zone Registry state visualization
 */
export class ZonesCollector extends Collector<ZoneEntry> {
  /**
   * Collector name identifier
   */
  static override collectorName = 'zones'

  /**
   * This collector shows state, not events
   */
  static override records = false

  private _registry: ZoneRegistry | null = null
  private _highlightedZone: string | null = null
  private _overlays: Map<string, HTMLDivElement> = new Map()
  private _showCurrentPageOnly: boolean
  private _showInternalZones: boolean
  private _routerCleanup: (() => void) | null = null

  constructor(options: ZonesCollectorOptions = {}) {
    super(options)
    this._showCurrentPageOnly = options.showCurrentPageOnly ?? true
    this._showInternalZones = options.showInternalZones ?? false
  }

  /**
   * Internal install - get zone registry reference and subscribe to navigation
   * @protected
   */
  protected override _doInstall(ctx: CollectorContext): void {
    this._ctx = ctx
    this._registry = (ctx as ZonesCollectorContext).zones ?? null
    if (!this._registry) {
      console.warn('[ZonesCollector] No zone registry found in context')
    }
    this._setupRouterListener()
  }

  /**
   * Setup router listener for navigation changes
   * @private
   */
  private _setupRouterListener(): void {
    const router = (this._ctx as ZonesCollectorContext)?.router
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
  protected override _doUninstall(): void {
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
   * @param zoneName - Zone name to check
   *
   * Note: Internal zones (prefixed with _) are currently considered always on page
   * since they're typically global (app:debug, app:toasts).
   */
  isZoneOnPage(zoneName: string): boolean {
    // Internal zones are global, always considered "on page"
    if (zoneName.startsWith('_')) {
      return true
    }
    const escapedName = CSS.escape(zoneName)
    return document.querySelector(`[data-zone="${zoneName}"], .zone-${escapedName}`) !== null
  }

  /**
   * Get/set filter for current page zones only
   */
  get showCurrentPageOnly(): boolean {
    return this._showCurrentPageOnly
  }

  set showCurrentPageOnly(value: boolean) {
    this._showCurrentPageOnly = value
  }

  /**
   * Toggle current page filter
   * @returns New filter state
   */
  toggleFilter(): boolean {
    this._showCurrentPageOnly = !this._showCurrentPageOnly
    return this._showCurrentPageOnly
  }

  /**
   * Get/set filter for internal zones (prefixed with _)
   */
  get showInternalZones(): boolean {
    return this._showInternalZones
  }

  set showInternalZones(value: boolean) {
    this._showInternalZones = value
  }

  /**
   * Toggle internal zones filter
   * @returns New filter state
   */
  toggleInternalFilter(): boolean {
    this._showInternalZones = !this._showInternalZones
    return this._showInternalZones
  }

  /**
   * Get badge - show number of zones (filtered if filter active)
   */
  override getBadge(): number {
    if (!this._registry) return 0
    const registry = this._registry as unknown as { _zones: Map<string, unknown> }
    let count = 0
    for (const [name] of registry._zones) {
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
   * @param forceAll - If true, ignore filter and return all zones
   * @returns Zone info array
   */
  override getEntries(forceAll = false): ZoneEntry[] {
    if (!this._registry) return []

    const registry = this._registry as unknown as {
      _zones: Map<string, { default?: { name?: string; __name?: string } }>
      getBlocks: (name: string) => Array<{
        id?: string
        weight: number
        component?: { name?: string; __name?: string }
        wrappers?: Array<{
          component?: { name?: string; __name?: string }
          weight: number
        }>
      }>
    }

    const zones: ZoneEntry[] = []
    for (const [name, config] of registry._zones) {
      // Skip internal zones (prefixed with _) unless showing them
      if (name.startsWith('_') && !this._showInternalZones) {
        continue
      }

      // Apply filter if enabled
      const isOnPage = this.isZoneOnPage(name)
      if (!forceAll && this._showCurrentPageOnly && !isOnPage) {
        continue
      }

      const blocks = registry.getBlocks(name)
      zones.push({
        timestamp: Date.now(),
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
   * @param zoneName - Zone name to highlight
   */
  highlightZone(zoneName: string): void {
    this.clearHighlights()
    this._highlightedZone = zoneName

    // Find zone elements by data attribute
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
  clearHighlights(): void {
    this._overlays.forEach(overlay => overlay.remove())
    this._overlays.clear()
    this._highlightedZone = null
  }

  /**
   * Get currently highlighted zone
   */
  getHighlightedZone(): string | null {
    return this._highlightedZone
  }

  /**
   * Toggle zone highlight
   * @param zoneName - Zone name
   * @returns Whether zone is now highlighted
   */
  toggleHighlight(zoneName: string): boolean {
    if (this._highlightedZone === zoneName) {
      this.clearHighlights()
      return false
    } else {
      this.highlightZone(zoneName)
      return true
    }
  }
}
