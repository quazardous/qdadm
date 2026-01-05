/**
 * SignalCollector - Debug collector for SignalBus events
 *
 * Extends the base Collector to capture all signals emitted through the SignalBus.
 * Uses wildcard subscription to capture all domain:action events.
 *
 * @example
 * const collector = new SignalCollector({ maxEntries: 50 })
 * collector.install(ctx) // ctx.signals is the SignalBus
 *
 * // Later, retrieve captured signals
 * collector.getEntries() // [{ name, data, source, timestamp }, ...]
 */

import { Collector } from './Collector.js'

/**
 * Collector for SignalBus events
 *
 * Records all signals with their name, data, and source for debugging.
 * Uses the `**` wildcard pattern to capture all signals including
 * multi-segment names (e.g., entity:data-invalidate, auth:impersonate:start).
 */
export class SignalCollector extends Collector {
  /**
   * Collector name for identification
   * @type {string}
   */
  static name = 'signals'

  /**
   * Internal install - subscribe to all signals
   *
   * @param {object} ctx - Context object from Kernel
   * @param {import('../kernel/SignalBus.js').SignalBus} ctx.signals - SignalBus instance
   * @protected
   */
  _doInstall(ctx) {
    if (!ctx?.signals) {
      console.warn('[SignalCollector] No signals bus found in context')
      return
    }

    // Subscribe to all signals using wildcard pattern
    // QuarKernel supports wildcards with the configured delimiter (:)
    // '**' matches all signals including multi-segment (entity:data-invalidate)
    this._unsubscribe = ctx.signals.on('**', (event) => {
      this.record({
        name: event.name,
        data: event.data,
        source: event.data?.source ?? null
      })
    })
  }

  /**
   * Internal uninstall - cleanup subscription
   * @protected
   */
  _doUninstall() {
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
  }

  /**
   * Get entries filtered by signal name pattern
   *
   * @param {string|RegExp} pattern - Pattern to match signal names
   * @returns {Array<object>} Filtered entries
   */
  getByPattern(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
    return this.entries.filter((entry) => regex.test(entry.name))
  }

  /**
   * Get entries for a specific signal domain
   *
   * @param {string} domain - Domain prefix (e.g., 'entity', 'auth', 'books')
   * @returns {Array<object>} Entries matching the domain
   */
  getByDomain(domain) {
    return this.entries.filter((entry) => entry.name.startsWith(`${domain}:`))
  }
}
