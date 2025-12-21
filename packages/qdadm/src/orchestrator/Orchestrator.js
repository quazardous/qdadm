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
      managers = {}
    } = options

    this._entityFactory = entityFactory
    this._managers = new Map()

    // Register pre-provided managers
    for (const [name, manager] of Object.entries(managers)) {
      this.register(name, manager)
    }
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

    throw new Error(`[Orchestrator] No manager for entity "${name}" and no factory provided`)
  }

  /**
   * Get all registered manager names
   * @returns {string[]}
   */
  getRegisteredNames() {
    return Array.from(this._managers.keys())
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
