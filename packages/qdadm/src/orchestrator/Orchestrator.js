/**
 * Orchestrator - Manager of EntityManagers
 *
 * Central registry that creates and distributes EntityManagers.
 * Uses a factory function provided by the consuming application.
 * Entity configs can be declared by modules via registry.addEntity().
 *
 * Usage:
 * ```js
 * // Dashboard provides a factory that receives (name, config)
 * const entityFactory = (entityName, entityConfig) => {
 *   // entityConfig comes from registry.addEntity() or is undefined
 *   if (entityConfig instanceof EntityManager) {
 *     return entityConfig  // Module provided a custom manager
 *   }
 *   return new EntityManager({
 *     name: entityName,
 *     storage: new ApiStorage({
 *       endpoint: entityConfig?.endpoint || `/${entityName}`,
 *       client
 *     })
 *   })
 * }
 *
 * const orchestrator = new Orchestrator({ entityFactory })
 *
 * // Get managers (created lazily)
 * const usersManager = orchestrator.get('users')
 * ```
 */
import { getEntityConfig } from '../module/moduleRegistry.js'

export class Orchestrator {
  constructor(options = {}) {
    const {
      entityFactory = null,
      // Optional: pre-registered managers (for special cases)
      managers = {},
      // SignalBus instance for event-driven communication
      signals = null,
      // HookRegistry instance for lifecycle hooks
      hooks = null,
      // DeferredRegistry instance for async warmup
      deferred = null,
      // Optional: AuthAdapter for entity permission checks (scope/silo)
      entityAuthAdapter = null
    } = options

    this._entityFactory = entityFactory
    this._managers = new Map()
    this._signals = signals
    this._hooks = hooks
    this._deferred = deferred
    this._entityAuthAdapter = entityAuthAdapter

    // Register pre-provided managers
    for (const [name, manager] of Object.entries(managers)) {
      this.register(name, manager)
    }
  }

  /**
   * Set the SignalBus instance
   * @param {SignalBus} signals
   */
  setSignals(signals) {
    this._signals = signals
  }

  /**
   * Get the SignalBus instance
   * @returns {SignalBus|null}
   */
  get signals() {
    return this._signals
  }

  /**
   * Set the entity AuthAdapter for permission checks
   * This adapter will be injected into all newly registered managers
   * (unless they already have their own adapter)
   * @param {AuthAdapter} adapter
   */
  setEntityAuthAdapter(adapter) {
    this._entityAuthAdapter = adapter
  }

  /**
   * Get the entity AuthAdapter
   * @returns {AuthAdapter|null}
   */
  get entityAuthAdapter() {
    return this._entityAuthAdapter
  }

  /**
   * Set the HookRegistry instance
   * @param {HookRegistry} hooks
   */
  setHooks(hooks) {
    this._hooks = hooks
  }

  /**
   * Get the HookRegistry instance
   * @returns {HookRegistry|null}
   */
  get hooks() {
    return this._hooks
  }

  /**
   * Set the DeferredRegistry instance
   * @param {DeferredRegistry} deferred
   */
  setDeferred(deferred) {
    this._deferred = deferred
  }

  /**
   * Get the DeferredRegistry instance
   * @returns {DeferredRegistry|null}
   */
  get deferred() {
    return this._deferred
  }

  /**
   * Set the entity factory
   * @param {function} factory - (entityName, entityConfig) => EntityManager
   */
  setFactory(factory) {
    this._entityFactory = factory
  }

  /**
   * Register an EntityManager manually
   * Use this for special managers that don't follow the factory pattern
   *
   * @param {string} name - Entity name
   * @param {EntityManager} manager - Manager instance
   */
  register(name, manager) {
    this._managers.set(name, manager)
    // Pass signals reference to manager for event emission
    if (this._signals && manager.setSignals) {
      manager.setSignals(this._signals)
    }
    // Pass hooks reference to manager for lifecycle hooks
    if (this._hooks && manager.setHooks) {
      manager.setHooks(this._hooks)
    }
    // Inject entityAuthAdapter if provided and manager doesn't have one
    // Manager's own adapter takes precedence (allows per-entity customization)
    if (this._entityAuthAdapter && !manager._authAdapter) {
      manager.authAdapter = this._entityAuthAdapter
    }
    if (manager.onRegister) {
      manager.onRegister(this)
    }
  }

  /**
   * Check if a manager exists (registered or can be created)
   * @param {string} name - Entity name
   * @returns {boolean}
   */
  has(name) {
    return this._managers.has(name) || !!this._entityFactory
  }

  /**
   * Get an EntityManager by name
   * Creates it via factory if not already registered
   *
   * @param {string} name - Entity name
   * @returns {EntityManager}
   */
  get(name) {
    // Return existing manager
    if (this._managers.has(name)) {
      return this._managers.get(name)
    }

    // Get entity config from module registry (if declared)
    const entityConfig = getEntityConfig(name)

    // If config is already an EntityManager, use it directly
    if (entityConfig && typeof entityConfig.get === 'function') {
      this.register(name, entityConfig)
      return entityConfig
    }

    // Create via factory
    if (this._entityFactory) {
      const manager = this._entityFactory(name, entityConfig)
      if (manager) {
        this.register(name, manager)
        return manager
      }
    }

    // Build helpful error message
    const registered = this.getRegisteredNames()
    const hint = registered.length > 0
      ? `\nRegistered entities: ${registered.join(', ')}\n`
      : '\nNo entities registered yet.\n'

    const suggestion = `
Possible causes:
1. Entity "${name}" not declared in any module (ctx.entity('${name}', {...}))
2. Module not loaded (check moduleDefs in config/modules.js)
3. Typo in entity name

Example fix in your module:
  ctx.entity('${name}', {
    name: '${name}',
    labelField: 'name',
    fields: { ... },
    storage: yourStorage
  })`

    throw new Error(`[Orchestrator] No manager for entity "${name}"${hint}${suggestion}`)
  }

  /**
   * Get all registered manager names
   * @returns {string[]}
   */
  getRegisteredNames() {
    return Array.from(this._managers.keys())
  }

  /**
   * Fire warmup for all managers (fire-and-forget)
   *
   * Triggers cache preloading for all managers with warmupEnabled.
   * Each manager registers its warmup in the DeferredRegistry, allowing
   * pages to await specific entities before rendering.
   *
   * IMPORTANT: This is fire-and-forget by design. Don't await this method.
   * Components await what they need via DeferredRegistry:
   *   `await deferred.await('entity:books:cache')`
   *
   * @returns {Promise<Map<string, any>>} For debugging/logging only
   *
   * @example
   * ```js
   * // At boot (fire-and-forget)
   * orchestrator.fireWarmups()
   *
   * // In component - await specific entity cache
   * await deferred.await('entity:books:cache')
   * const { items } = await booksManager.list()  // Uses local cache
   * ```
   */
  fireWarmups() {
    const results = new Map()

    for (const [name, manager] of this._managers) {
      if (manager.warmup && manager.warmupEnabled) {
        // Fire each warmup - they register themselves in DeferredRegistry
        manager.warmup().then(result => {
          results.set(name, result)
        }).catch(error => {
          console.warn(`[Orchestrator] Warmup failed for ${name}:`, error.message)
          results.set(name, error)
        })
      }
    }

    return results
  }

  /**
   * Dispose all managers
   */
  dispose() {
    for (const [, manager] of this._managers) {
      if (manager.onDispose) {
        manager.onDispose()
      }
    }
    this._managers.clear()
  }
}

/**
 * Factory function to create an Orchestrator
 */
export function createOrchestrator(options) {
  return new Orchestrator(options)
}
