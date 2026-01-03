/**
 * Module Base Class
 *
 * Defines the interface for qdadm modules. Modules encapsulate:
 * - Entity definitions
 * - Route registration
 * - Navigation items
 * - Zone definitions
 * - Signal listeners
 *
 * Usage patterns:
 *
 * 1. Class-based (full control):
 *    class MyModule extends Module {
 *      static name = 'mymodule'
 *      static requires = ['auth']
 *      static priority = 50
 *      enabled(ctx) { return ctx.isDev }
 *      async connect(ctx) { ... }
 *      async disconnect() { ... }
 *    }
 *
 * 2. Object-based (simple modules):
 *    export default {
 *      name: 'simple',
 *      connect(ctx) { ctx.entity(...).routes(...) }
 *    }
 *
 * 3. Legacy function (backward compat):
 *    export function init({ registry, zones }) { ... }
 */
export class Module {
  /**
   * Unique module name (used for dependency resolution)
   * @type {string}
   */
  static name = 'base'

  /**
   * Module dependencies - names of modules that must be loaded first
   * @type {string[]}
   */
  static requires = []

  /**
   * Load priority - higher values load later (useful for cross-module wiring)
   * @type {number}
   */
  static priority = 0

  /**
   * @param {Object} options - Module configuration options
   */
  constructor(options = {}) {
    this.options = options
    this.ctx = null
    this._signalCleanups = []
  }

  /**
   * Get the module name (from static property or options)
   * @returns {string}
   */
  get name() {
    return this.options.name || this.constructor.name
  }

  /**
   * Check if module should be enabled
   * Override in subclass for conditional loading
   * @param {KernelContext} ctx
   * @returns {boolean}
   */
  enabled(ctx) {
    return true
  }

  /**
   * Connect module to kernel - main registration point
   * Override in subclass to register entities, routes, etc.
   * @param {KernelContext} ctx
   * @returns {Promise<void>}
   */
  async connect(ctx) {
    // Override in subclass
  }

  /**
   * Disconnect module from kernel - cleanup
   * Override in subclass to remove listeners, cleanup resources
   * @returns {Promise<void>}
   */
  async disconnect() {
    // Cleanup signal listeners registered via ctx.on()
    for (const cleanup of this._signalCleanups) {
      cleanup()
    }
    this._signalCleanups = []
  }

  /**
   * Register a signal cleanup function (used by KernelContext.on())
   * @param {Function} cleanup
   * @internal
   */
  _addSignalCleanup(cleanup) {
    this._signalCleanups.push(cleanup)
  }
}

export default Module
