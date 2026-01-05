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
 *   static name = 'signals'
 *
 *   install(ctx) {
 *     this._unbind = ctx.signals.on('*', (event) => {
 *       this.record({ type: event.name, data: event.data })
 *     })
 *   }
 *
 *   uninstall() {
 *     if (this._unbind) this._unbind()
 *   }
 * }
 */

/**
 * Base class for debug collectors
 */
export class Collector {
  /**
   * Collector name - override in subclass
   * @type {string}
   */
  static name = 'base'

  /**
   * Whether this collector actually records (vs just displays state)
   * Override to false for collectors that only show current state (e.g., zones, auth)
   * @type {boolean}
   */
  static records = true

  /**
   * Create a new collector
   * @param {object} options - Collector options
   * @param {number} [options.maxEntries=100] - Maximum entries to keep in ring buffer
   * @param {boolean} [options.enabled=true] - Initial enabled state
   */
  constructor(options = {}) {
    this.options = options
    this.maxEntries = options.maxEntries ?? 100
    this.entries = []
    this._enabled = options.enabled ?? true
    this._installed = false
    this._ctx = null
    this._seenCount = 0  // Number of entries that have been "seen"
    this._bridge = null  // Set by DebugBridge when added
  }

  /**
   * Check if this collector type records events (vs showing state)
   * @returns {boolean}
   */
  get records() {
    return this.constructor.records
  }

  /**
   * Check if collector is enabled
   * @returns {boolean}
   */
  get enabled() {
    return this._enabled
  }

  /**
   * Set enabled state - installs/uninstalls as needed
   * @param {boolean} value
   */
  set enabled(value) {
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
   * @returns {boolean} New enabled state
   */
  toggle() {
    this.enabled = !this._enabled
    return this._enabled
  }

  /**
   * Get collector name from static property
   * @returns {string}
   */
  get name() {
    return this.constructor.name
  }

  /**
   * Record an entry in the ring buffer
   * Automatically adds timestamp and enforces max entries
   * @param {object} entry - Entry data to record
   */
  record(entry) {
    this.entries.push({ ...entry, timestamp: Date.now(), _isNew: true })
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
      // Adjust seenCount when oldest entry is removed
      if (this._seenCount > 0) {
        this._seenCount--
      }
    }
    // Notify bridge for reactive UI update
    this._bridge?.notify()
  }

  /**
   * Notify bridge that state has changed (for non-recording collectors)
   * Call this when collector state changes that should trigger UI update
   */
  notifyChange() {
    this._bridge?.notify()
  }

  /**
   * Get unseen count (new entries since last markAsSeen)
   * @returns {number} Number of unseen entries
   */
  getUnseenCount() {
    return Math.max(0, this.entries.length - this._seenCount)
  }

  /**
   * Get total count
   * @returns {number} Total number of entries
   */
  getTotalCount() {
    return this.entries.length
  }

  /**
   * Get badge count for UI display
   * @param {boolean} [countAll=false] - If true, return total count; otherwise unseen count
   * @returns {number} Number of entries
   */
  getBadge(countAll = false) {
    return countAll ? this.getTotalCount() : this.getUnseenCount()
  }

  /**
   * Mark all current entries as seen
   * Removes _isNew flag and updates seenCount
   */
  markAsSeen() {
    this._seenCount = this.entries.length
    // Remove _isNew flag from all entries
    for (const entry of this.entries) {
      delete entry._isNew
    }
  }

  /**
   * Clear all entries
   */
  clear() {
    this.entries = []
    this._seenCount = 0
  }

  /**
   * Get all entries
   * Returns a shallow copy to trigger Vue reactivity when used in computed
   * @returns {Array<object>} All recorded entries
   */
  getEntries() {
    return [...this.entries]
  }

  /**
   * Get latest entries
   * @param {number} count - Number of entries to return
   * @returns {Array<object>} Latest entries
   */
  getLatest(count) {
    return this.entries.slice(-count)
  }

  /**
   * Install collector - subscribe to signals, events, etc.
   * Stores context for later use. Override _doInstall in subclass.
   * @param {object} ctx - Context object with signals, router, etc.
   */
  install(ctx) {
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
  uninstall() {
    this._doUninstall()
    this._installed = false
  }

  /**
   * Internal install - override in subclass
   * @param {object} ctx - Context object
   * @protected
   */
  _doInstall(ctx) {
    // Override in subclass
  }

  /**
   * Internal uninstall - override in subclass
   * @protected
   */
  _doUninstall() {
    // Override in subclass
  }
}
