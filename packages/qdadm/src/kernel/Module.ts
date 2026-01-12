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

// Forward declaration for KernelContext (to avoid circular deps)
export interface KernelContextLike {
  [key: string]: unknown
}

/**
 * Module static properties interface
 */
export interface ModuleStatic {
  name: string
  requires: string[]
  priority: number
  styles: (() => Promise<unknown>) | null
}

/**
 * Module constructor options
 */
export interface ModuleOptions {
  name?: string
  [key: string]: unknown
}

export class Module {
  /**
   * Unique module name (used for dependency resolution)
   */
  static name = 'base'

  /**
   * Module dependencies - names of modules that must be loaded first
   */
  static requires: string[] = []

  /**
   * Load priority - higher values load later (useful for cross-module wiring)
   */
  static priority = 0

  /**
   * Path to module styles (relative import or absolute)
   * Set in subclass to auto-load CSS/SCSS when module connects.
   * Styles are loaded once and cached.
   *
   * @example
   * class DebugModule extends Module {
   *   static styles = () => import('./styles.scss')
   * }
   */
  static styles: (() => Promise<unknown>) | null = null

  options: ModuleOptions
  ctx: KernelContextLike | null = null
  protected _signalCleanups: Array<() => void> = []
  protected _stylesLoaded = false

  constructor(options: ModuleOptions = {}) {
    this.options = options
  }

  /**
   * Get the module name (from static property or options)
   */
  get name(): string {
    return this.options.name || (this.constructor as typeof Module).name
  }

  /**
   * Check if module should be enabled
   * Override in subclass for conditional loading
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enabled(_ctx: any): boolean {
    return true
  }

  /**
   * Load module styles if defined
   * Called automatically by ModuleLoader before connect()
   */
  async loadStyles(): Promise<void> {
    const stylesLoader = (this.constructor as typeof Module).styles
    if (this._stylesLoaded || !stylesLoader) return

    try {
      await stylesLoader()
      this._stylesLoaded = true
    } catch (e) {
      console.warn(`[${(this.constructor as typeof Module).name}] Failed to load styles:`, e)
    }
  }

  /**
   * Connect module to kernel - main registration point
   * Override in subclass to register entities, routes, etc.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async connect(_ctx: any): Promise<void> {
    // Override in subclass
  }

  /**
   * Disconnect module from kernel - cleanup
   * Override in subclass to remove listeners, cleanup resources
   */
  async disconnect(): Promise<void> {
    // Cleanup signal listeners registered via ctx.on()
    for (const cleanup of this._signalCleanups) {
      cleanup()
    }
    this._signalCleanups = []
  }

  /**
   * Register a signal cleanup function (used by KernelContext.on())
   * @internal
   */
  _addSignalCleanup(cleanup: () => void): void {
    this._signalCleanups.push(cleanup)
  }
}

export default Module
