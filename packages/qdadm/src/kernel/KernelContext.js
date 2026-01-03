/**
 * KernelContext - Fluent API wrapper for module registration
 *
 * Provides a chainable interface for modules to register entities, routes,
 * navigation items, zones, blocks, and signal handlers.
 *
 * Usage in a module:
 * ```js
 * class UsersModule extends Module {
 *   async connect(ctx) {
 *     ctx
 *       .entity('users', { storage: 'api:/api/users' })
 *       .routes('users', [
 *         { path: '', name: 'users', component: UserList },
 *         { path: ':id', name: 'users-edit', component: UserEdit }
 *       ])
 *       .navItem({ section: 'Admin', route: 'users', icon: 'pi pi-users', label: 'Users' })
 *       .routeFamily('users', ['users-'])
 *       .zone('users-list-header')
 *       .block('users-list-header', { component: UserStats, weight: 10 })
 *       .on('users:created', (event) => console.log('User created:', event))
 *   }
 * }
 * ```
 */

import { managerFactory } from '../entity/factory.js'
import { registry } from '../module/moduleRegistry.js'

export class KernelContext {
  /**
   * @param {import('./Kernel.js').Kernel} kernel - Kernel instance
   * @param {import('./Module.js').Module} module - Module instance
   */
  constructor(kernel, module) {
    this._kernel = kernel
    this._module = module
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Getters for kernel services
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get Vue app instance
   * @returns {import('vue').App}
   */
  get app() {
    return this._kernel.vueApp
  }

  /**
   * Get Vue router instance
   * @returns {import('vue-router').Router}
   */
  get router() {
    return this._kernel.router
  }

  /**
   * Get SignalBus instance
   * @returns {import('./SignalBus.js').SignalBus}
   */
  get signals() {
    return this._kernel.signals
  }

  /**
   * Get Orchestrator instance (entity managers)
   * @returns {import('../orchestrator/Orchestrator.js').Orchestrator}
   */
  get orchestrator() {
    return this._kernel.orchestrator
  }

  /**
   * Get ZoneRegistry instance
   * @returns {import('../zones/ZoneRegistry.js').ZoneRegistry}
   */
  get zones() {
    return this._kernel.zoneRegistry
  }

  /**
   * Get HookRegistry instance
   * @returns {import('../hooks/HookRegistry.js').HookRegistry}
   */
  get hooks() {
    return this._kernel.hookRegistry
  }

  /**
   * Get DeferredRegistry instance
   * @returns {import('../deferred/DeferredRegistry.js').DeferredRegistry}
   */
  get deferred() {
    return this._kernel.deferred
  }

  /**
   * Check if running in development mode
   * @returns {boolean}
   */
  get isDev() {
    return import.meta.env?.DEV ?? false
  }

  /**
   * Get debug mode from kernel options
   * @returns {boolean}
   */
  get debug() {
    return this._kernel.options?.debug ?? false
  }

  /**
   * Get auth adapter
   * @returns {object|null}
   */
  get authAdapter() {
    return this._kernel.options?.authAdapter ?? null
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Fluent registration methods (return this for chaining)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register an entity manager
   *
   * Uses managerFactory to resolve config into a manager instance.
   * Registers with Orchestrator for CRUD operations.
   *
   * @param {string} name - Entity name (e.g., 'users', 'books')
   * @param {string|object|import('../entity/EntityManager.js').EntityManager} config - Manager config
   *   - String pattern: 'api:/api/users' → creates ApiStorage + EntityManager
   *   - Object: { storage: '...', label: '...', fields: {...} }
   *   - Manager instance: passed through directly
   * @returns {this}
   *
   * @example
   * ctx.entity('users', 'api:/api/users')
   * ctx.entity('books', { storage: 'api:/api/books', label: 'Book' })
   * ctx.entity('settings', new SettingsManager({...}))
   */
  entity(name, config) {
    // Build factory context from kernel options
    const factoryContext = {
      storageResolver: this._kernel.options.storageResolver,
      managerResolver: this._kernel.options.managerResolver,
      managerRegistry: this._kernel.options.managerRegistry || {}
    }

    // Create manager via factory
    const manager = managerFactory(config, name, factoryContext)

    // Register with orchestrator
    if (this._kernel.orchestrator) {
      this._kernel.orchestrator.register(name, manager)
    }

    return this
  }

  /**
   * Register routes for this module
   *
   * Delegates to moduleRegistry.addRoutes with prefix application.
   *
   * @param {string} basePath - Base path prefix (e.g., 'users')
   * @param {Array} routes - Route definitions with relative paths
   * @param {object} [opts={}] - Route options
   * @param {string} [opts.entity] - Entity name for permission checking
   * @param {object} [opts.parent] - Parent entity config for child routes
   * @param {string} [opts.label] - Label for nav links
   * @param {string} [opts.layout] - Default layout type
   * @returns {this}
   *
   * @example
   * ctx.routes('users', [
   *   { path: '', name: 'users', component: UserList },
   *   { path: ':id', name: 'users-edit', component: UserEdit }
   * ], { entity: 'users' })
   */
  routes(basePath, routes, opts = {}) {
    registry.addRoutes(basePath, routes, opts)
    return this
  }

  /**
   * Add a navigation item to a section
   *
   * @param {object} item - Navigation item config
   * @param {string} item.section - Section title (e.g., 'Admin', 'Content')
   * @param {string} item.route - Route name
   * @param {string} [item.icon] - Icon class (e.g., 'pi pi-users')
   * @param {string} [item.label] - Display label
   * @param {boolean} [item.exact] - Use exact route matching
   * @param {string} [item.entity] - Entity for permission check
   * @returns {this}
   *
   * @example
   * ctx.navItem({ section: 'Admin', route: 'users', icon: 'pi pi-users', label: 'Users' })
   */
  navItem(item) {
    registry.addNavItem(item)
    return this
  }

  /**
   * Add route family mapping for active state detection
   *
   * @param {string} base - Parent route name (e.g., 'users')
   * @param {string[]} prefixes - Child route prefixes (e.g., ['users-', 'user-'])
   * @returns {this}
   *
   * @example
   * ctx.routeFamily('users', ['users-', 'user-'])
   */
  routeFamily(base, prefixes) {
    registry.addRouteFamily(base, prefixes)
    return this
  }

  /**
   * Define a zone for extensible UI composition
   *
   * @param {string} name - Zone name (e.g., 'users-list-header')
   * @param {object} [options={}] - Zone options
   * @param {import('vue').Component} [options.default] - Default component when no blocks
   * @returns {this}
   *
   * @example
   * ctx.zone('users-list-header')
   * ctx.zone('users-sidebar', { default: DefaultSidebar })
   */
  zone(name, options = {}) {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.defineZone(name, options)
    }
    return this
  }

  /**
   * Register a block in a zone
   *
   * @param {string} zoneName - Target zone name
   * @param {object} config - Block configuration
   * @param {import('vue').Component} config.component - Vue component
   * @param {number} [config.weight=50] - Ordering weight (lower = first)
   * @param {object} [config.props={}] - Props to pass to component
   * @param {string} [config.id] - Unique identifier
   * @param {string} [config.operation='add'] - Block operation (add, replace, extend, wrap)
   * @returns {this}
   *
   * @example
   * ctx.block('users-list-header', { component: UserStats, weight: 10, id: 'user-stats' })
   */
  block(zoneName, config) {
    if (this._kernel.zoneRegistry) {
      this._kernel.zoneRegistry.registerBlock(zoneName, config)
    }
    return this
  }

  /**
   * Provide a value to Vue's dependency injection system
   *
   * @param {string|symbol} key - Injection key
   * @param {*} value - Value to provide
   * @returns {this}
   *
   * @example
   * ctx.provide('myService', new MyService())
   */
  provide(key, value) {
    if (this._kernel.vueApp) {
      this._kernel.vueApp.provide(key, value)
    } else {
      // Store for later application when vueApp is created
      this._kernel._pendingProvides.set(key, value)
    }
    return this
  }

  /**
   * Register a global Vue component
   *
   * @param {string} name - Component name
   * @param {import('vue').Component} component - Vue component
   * @returns {this}
   *
   * @example
   * ctx.component('MyGlobalComponent', MyComponent)
   */
  component(name, component) {
    if (this._kernel.vueApp) {
      this._kernel.vueApp.component(name, component)
    } else {
      // Store for later registration when vueApp is created
      this._kernel._pendingComponents.set(name, component)
    }
    return this
  }

  /**
   * Subscribe to a signal with automatic cleanup on module disconnect
   *
   * The handler will be automatically unsubscribed when the module's
   * disconnect() method is called.
   *
   * @param {string} signal - Signal name (supports wildcards via SignalBus)
   * @param {Function} handler - Handler function (event, ctx) => void
   * @param {object} [options={}] - Listener options
   * @param {number} [options.priority] - Listener priority (higher = earlier)
   * @param {string} [options.id] - Unique listener ID
   * @param {boolean} [options.once] - Remove after first call
   * @returns {this}
   *
   * @example
   * ctx.on('users:created', (event) => console.log('User created:', event.data))
   * ctx.on('entity:*', (event) => console.log('Entity event:', event))
   */
  on(signal, handler, options = {}) {
    if (this._kernel.signals) {
      const cleanup = this._kernel.signals.on(signal, handler, options)
      // Register cleanup with module for automatic unsubscribe on disconnect
      if (this._module && typeof this._module._addSignalCleanup === 'function') {
        this._module._addSignalCleanup(cleanup)
      }
    }
    return this
  }

  /**
   * Register a hook handler
   *
   * @param {string} hookName - Hook name (e.g., 'users:presave')
   * @param {Function} handler - Handler function
   * @param {object} [options={}] - Hook options
   * @returns {this}
   *
   * @example
   * ctx.hook('users:presave', (context) => {
   *   context.data.updated_at = new Date().toISOString()
   *   return context
   * })
   */
  hook(hookName, handler, options = {}) {
    if (this._kernel.hookRegistry) {
      this._kernel.hookRegistry.register(hookName, handler, options)
    }
    return this
  }

  /**
   * Queue a deferred task
   *
   * @param {string} name - Deferred task name
   * @param {Function} factory - Factory function returning a promise
   * @returns {this}
   *
   * @example
   * ctx.deferred('users:warmup', async () => {
   *   await ctx.orchestrator.get('users').warmup()
   * })
   */
  defer(name, factory) {
    if (this._kernel.deferred) {
      this._kernel.deferred.queue(name, factory)
    }
    return this
  }
}

/**
 * Factory function to create a KernelContext instance
 *
 * @param {import('./Kernel.js').Kernel} kernel - Kernel instance
 * @param {import('./Module.js').Module} module - Module instance
 * @returns {KernelContext}
 */
export function createKernelContext(kernel, module) {
  return new KernelContext(kernel, module)
}
