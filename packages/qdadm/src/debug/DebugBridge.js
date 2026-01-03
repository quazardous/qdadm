/**
 * DebugBridge - Central aggregator for debug collectors
 *
 * Manages multiple collectors and provides a unified interface
 * for the debug panel UI. Uses Vue reactivity for state management.
 *
 * @example
 * import { createDebugBridge, SignalCollector } from '@qdadm/core/debug'
 *
 * const debug = createDebugBridge()
 * debug.addCollector(new SignalCollector())
 * debug.install(ctx)
 */

import { ref, shallowReactive } from 'vue'

/**
 * Central aggregator for debug collectors
 */
export class DebugBridge {
  /**
   * Create a new DebugBridge
   * @param {object} options - Bridge options
   * @param {boolean} [options.enabled=false] - Initial enabled state
   */
  constructor(options = {}) {
    this.options = options
    this.enabled = ref(options.enabled ?? false)
    // Use shallowReactive to avoid deep reactivity on collector instances
    this.collectors = shallowReactive(new Map())
    this._installed = false
    this._ctx = null
    // Reactive tick for UI updates - collectors increment this when they have new data
    this.tick = ref(0)
  }

  /**
   * Notify that a collector has new data
   * Called by collectors when they record new entries or state changes
   */
  notify() {
    // Defensive check - ensure tick is still a ref
    if (this.tick && typeof this.tick === 'object' && 'value' in this.tick) {
      this.tick.value++
    }
  }

  /**
   * Add a collector to the bridge
   * @param {Collector} collector - Collector instance to add
   * @returns {DebugBridge} this for chaining
   */
  addCollector(collector) {
    const name = collector.constructor.name || collector.name
    // Set bridge reference for reactive notifications
    collector._bridge = this
    this.collectors.set(name, collector)
    if (this._installed && this.enabled.value) {
      collector.install(this._ctx)
    }
    return this
  }

  /**
   * Get a collector by name
   * @param {string} name - Collector name
   * @returns {Collector|undefined} The collector or undefined
   */
  getCollector(name) {
    return this.collectors.get(name)
  }

  /**
   * Get all collectors
   * @returns {Map<string, Collector>} All collectors
   */
  getAllCollectors() {
    return this.collectors
  }

  /**
   * Install all collectors
   * @param {object} ctx - Context object with signals, router, etc.
   * @returns {DebugBridge} this for chaining
   */
  install(ctx) {
    this._ctx = ctx
    this._installed = true
    if (this.enabled.value) {
      for (const collector of this.collectors.values()) {
        collector.install(ctx)
      }
    }
    // Initial notify after all collectors are installed
    // Use nextTick to ensure Vue reactivity is ready
    setTimeout(() => this.notify(), 0)
    return this
  }

  /**
   * Uninstall all collectors and cleanup
   */
  uninstall() {
    for (const collector of this.collectors.values()) {
      collector.uninstall()
    }
    this.collectors.clear()
    this._installed = false
    this._ctx = null
  }

  /**
   * Toggle enabled state
   * When enabled, installs all collectors; when disabled, uninstalls them
   * @returns {boolean} New enabled state
   */
  toggle() {
    this.enabled.value = !this.enabled.value
    if (this._installed && this._ctx) {
      if (this.enabled.value) {
        for (const collector of this.collectors.values()) {
          collector.install(this._ctx)
        }
      } else {
        for (const collector of this.collectors.values()) {
          collector.uninstall()
        }
      }
    }
    return this.enabled.value
  }

  /**
   * Clear all collectors' entries
   */
  clearAll() {
    for (const collector of this.collectors.values()) {
      collector.clear()
    }
  }

  /**
   * Get total badge count across all collectors
   * @param {boolean} [countAll=false] - If true, count all entries; otherwise unseen only
   * @returns {number} Total entry count
   */
  getTotalBadge(countAll = false) {
    let total = 0
    for (const collector of this.collectors.values()) {
      total += collector.getBadge(countAll)
    }
    return total
  }
}

/**
 * Factory function to create a DebugBridge
 * @param {object} options - Bridge options
 * @returns {DebugBridge} New DebugBridge instance
 */
export function createDebugBridge(options = {}) {
  return new DebugBridge(options)
}
