/**
 * Collector - Base class for debug collectors
 *
 * Collectors gather data from various sources (signals, network, events)
 * and store them in a ring buffer for display in the debug panel.
 *
 * Subclasses implement specific collection strategies by overriding
 * the install() and uninstall() methods.
 *
 * @example
 * class SignalCollector extends Collector {
 *   static override collectorName = 'signals'
 *
 *   protected override _doInstall(ctx: CollectorContext) {
 *     this._unbind = ctx.signals.on('*', (event) => {
 *       this.record({ type: event.name, data: event.data })
 *     })
 *   }
 *
 *   protected override _doUninstall() {
 *     if (this._unbind) this._unbind()
 *   }
 * }
 */

import type { SignalBus } from '../../kernel/SignalBus'
import type { Orchestrator } from '../../orchestrator/Orchestrator'

/**
 * Context provided to collectors during install
 */
export interface CollectorContext {
  signals?: SignalBus
  orchestrator?: Orchestrator
  router?: unknown
  kernel?: unknown
  [key: string]: unknown
}

/**
 * Base entry type for collector entries
 */
export interface CollectorEntry {
  timestamp: number
  _isNew?: boolean
  [key: string]: unknown
}

/**
 * Collector options
 */
export interface CollectorOptions {
  maxEntries?: number
  enabled?: boolean
  [key: string]: unknown
}

/**
 * Notify callback type
 */
export type NotifyCallback = () => void

/**
 * Debug bridge interface
 */
export interface DebugBridgeInterface {
  notify: () => void
}

/**
 * Base class for debug collectors
 */
export class Collector<TEntry extends CollectorEntry = CollectorEntry> {
  /**
   * Collector name - override in subclass
   * Using collectorName to avoid conflict with Function.name
   */
  static collectorName = 'base'

  /**
   * Whether this collector actually records (vs just displays state)
   * Override to false for collectors that only show current state (e.g., zones, auth)
   */
  static records = true

  options: CollectorOptions
  maxEntries: number
  entries: TEntry[]
  protected _enabled: boolean
  protected _installed: boolean
  protected _ctx: CollectorContext | null
  protected _seenCount: number
  _bridge: DebugBridgeInterface | null
  protected _notifyCallbacks: NotifyCallback[]

  /**
   * Create a new collector
   * @param options - Collector options
   */
  constructor(options: CollectorOptions = {}) {
    this.options = options
    this.maxEntries = options.maxEntries ?? 100
    this.entries = []
    this._enabled = options.enabled ?? true
    this._installed = false
    this._ctx = null
    this._seenCount = 0  // Number of entries that have been "seen"
    this._bridge = null  // Set by DebugBridge when added
    this._notifyCallbacks = []  // Direct notification subscribers
  }

  /**
   * Check if this collector type records events (vs showing state)
   */
  get records(): boolean {
    return (this.constructor as typeof Collector).records
  }

  /**
   * Check if collector is enabled
   */
  get enabled(): boolean {
    return this._enabled
  }

  /**
   * Set enabled state - installs/uninstalls as needed
   */
  set enabled(value: boolean) {
    if (this._enabled === value) return
    this._enabled = value
    if (this._ctx) {
      if (value) {
        this.install(this._ctx)
      } else {
        this.uninstall()
      }
    }
  }

  /**
   * Toggle enabled state
   * @returns New enabled state
   */
  toggle(): boolean {
    this.enabled = !this._enabled
    return this._enabled
  }

  /**
   * Get collector name from static property
   */
  get name(): string {
    return (this.constructor as typeof Collector).collectorName
  }

  /**
   * Record an entry in the ring buffer
   * Automatically adds timestamp and enforces max entries
   * @param entry - Entry data to record
   */
  record(entry: Omit<TEntry, 'timestamp' | '_isNew'>): void {
    const fullEntry = { ...entry, timestamp: Date.now(), _isNew: true } as TEntry
    this.entries.push(fullEntry)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
      // Adjust seenCount when oldest entry is removed
      if (this._seenCount > 0) {
        this._seenCount--
      }
    }
    // Notify bridge and direct subscribers
    this.notifyChange()
  }

  /**
   * Notify bridge that state has changed (for non-recording collectors)
   * Call this when collector state changes that should trigger UI update
   */
  notifyChange(): void {
    this._bridge?.notify()
    // Call direct subscribers
    for (const cb of this._notifyCallbacks) {
      try {
        cb()
      } catch (e) {
        console.warn('[Collector] Notify callback error:', e)
      }
    }
  }

  /**
   * Subscribe to change notifications
   * @param callback - Called when collector state changes
   * @returns Unsubscribe function
   */
  onNotify(callback: NotifyCallback): () => void {
    this._notifyCallbacks.push(callback)
    return () => {
      const idx = this._notifyCallbacks.indexOf(callback)
      if (idx >= 0) this._notifyCallbacks.splice(idx, 1)
    }
  }

  /**
   * Get unseen count (new entries since last markAsSeen)
   * @returns Number of unseen entries
   */
  getUnseenCount(): number {
    return Math.max(0, this.entries.length - this._seenCount)
  }

  /**
   * Get total count
   * @returns Total number of entries
   */
  getTotalCount(): number {
    return this.entries.length
  }

  /**
   * Get badge count for UI display
   * @param countAll - If true, return total count; otherwise unseen count
   * @returns Number of entries
   */
  getBadge(countAll = false): number {
    return countAll ? this.getTotalCount() : this.getUnseenCount()
  }

  /**
   * Mark all current entries as seen
   * Removes _isNew flag and updates seenCount
   */
  markAsSeen(): void {
    this._seenCount = this.entries.length
    // Remove _isNew flag from all entries
    for (const entry of this.entries) {
      delete entry._isNew
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = []
    this._seenCount = 0
  }

  /**
   * Get all entries
   * Returns a shallow copy to trigger Vue reactivity when used in computed
   * @returns All recorded entries
   */
  getEntries(): TEntry[] {
    return [...this.entries]
  }

  /**
   * Get latest entries
   * @param count - Number of entries to return
   * @returns Latest entries
   */
  getLatest(count: number): TEntry[] {
    return this.entries.slice(-count)
  }

  /**
   * Install collector - subscribe to signals, events, etc.
   * Stores context for later use. Override _doInstall in subclass.
   * @param ctx - Context object with signals, router, etc.
   */
  install(ctx: CollectorContext): void {
    this._ctx = ctx
    this._installed = true
    if (this._enabled) {
      this._doInstall(ctx)
    }
  }

  /**
   * Uninstall collector - cleanup subscriptions
   * Override _doUninstall in subclass to cleanup resources
   */
  uninstall(): void {
    this._doUninstall()
    this._installed = false
  }

  /**
   * Internal install - override in subclass
   * @param ctx - Context object
   * @protected
   */
  protected _doInstall(_ctx: CollectorContext): void {
    // Override in subclass
  }

  /**
   * Internal uninstall - override in subclass
   * @protected
   */
  protected _doUninstall(): void {
    // Override in subclass
  }
}
