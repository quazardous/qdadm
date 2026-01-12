/**
 * Manager Factory/Resolver Pattern
 *
 * Enables declarative manager configuration with auto-resolution.
 * Works with storageFactory for complete auto-wiring.
 *
 * Usage:
 * ```js
 * // String pattern → factory creates manager with storage
 * managerFactory('api:/api/bots', 'bots', context)  // → EntityManager + ApiStorage
 *
 * // Config object → factory normalizes, resolver creates
 * managerFactory({ storage: 'api:/api/bots', label: 'Bot' }, 'bots', context)
 *
 * // Manager instance → returned directly
 * managerFactory(myManagerInstance, 'bots', context)  // → myManagerInstance
 * ```
 */

import { EntityManager } from './EntityManager'
import { storageFactory } from './storage/factory'

/**
 * Default manager resolver - creates manager instance from config
 *
 * Override this via Kernel config for custom manager classes.
 *
 * @param {object} config - Normalized manager config with resolved storage
 * @param {string} entityName - Entity name
 * @param {object} context - Context with managerRegistry
 * @returns {EntityManager} Manager instance
 */
export function defaultManagerResolver(config, entityName, context = {}) {
  const { managerRegistry = {} } = context

  // Look up registered manager class (e.g., from qdadm-gen)
  const ManagerClass = managerRegistry[entityName] || EntityManager

  // Ensure name is set
  const managerConfig = {
    name: entityName,
    ...config
  }

  return new ManagerClass(managerConfig)
}

/**
 * Manager factory - normalizes input and delegates to resolver
 *
 * Handles:
 * - EntityManager instance → return directly
 * - String pattern 'type:endpoint' → create storage, then manager
 * - Config object → resolve storage, then manager
 *
 * @param {EntityManager | string | object} config - Manager config
 * @param {string} entityName - Entity name
 * @param {object} context - Context with storageFactory, storageResolver, managerResolver, managerRegistry
 * @returns {EntityManager} Manager instance
 *
 * @example
 * // Instance passthrough
 * managerFactory(myManager, 'bots', ctx)  // → myManager
 *
 * // String pattern (shorthand for storage)
 * managerFactory('api:/api/bots', 'bots', ctx)  // → EntityManager + ApiStorage
 *
 * // Config object
 * managerFactory({
 *   storage: 'api:/api/bots',
 *   label: 'Bot',
 *   fields: { name: { type: 'text' } }
 * }, 'bots', ctx)
 */
export function managerFactory(config, entityName, context = {}) {
  const {
    storageResolver,
    managerResolver = defaultManagerResolver
  } = context

  // Already a Manager instance → return directly
  if (config instanceof EntityManager) {
    return config
  }

  // Also check for duck-typed manager (has storage property or list/get methods)
  if (config && typeof config === 'object' && config.storage && typeof config.list === 'function') {
    return config
  }

  // String pattern → treat as storage config, create default manager
  if (typeof config === 'string') {
    const storage = storageFactory(config, entityName, storageResolver)
    return managerResolver({ storage }, entityName, context)
  }

  // Config object → resolve storage first, then manager
  if (config && typeof config === 'object') {
    let resolvedConfig = { ...config }

    // Resolve storage if provided as string/config
    if (config.storage && !(config.storage instanceof Object && typeof config.storage.list === 'function')) {
      resolvedConfig.storage = storageFactory(config.storage, entityName, storageResolver)
    }

    return managerResolver(resolvedConfig, entityName, context)
  }

  throw new Error(`Invalid manager config for "${entityName}": ${typeof config}. Expected string, object, or Manager instance.`)
}

/**
 * Create a custom manager factory with context
 *
 * @param {object} context - Context with storageResolver, managerResolver, managerRegistry
 * @returns {function} Manager factory with bound context
 *
 * @example
 * const myFactory = createManagerFactory({
 *   managerRegistry: { bots: BotManager },
 *   managerResolver: (config, name, ctx) => {
 *     // Custom logic
 *     return defaultManagerResolver(config, name, ctx)
 *   }
 * })
 *
 * const botsManager = myFactory('api:/api/bots', 'bots')
 */
export function createManagerFactory(context) {
  return (config, entityName) => managerFactory(config, entityName, context)
}

/**
 * Create all managers from a config object
 *
 * @param {object} managersConfig - { entityName: config, ... }
 * @param {object} context - Factory context
 * @returns {object} { entityName: managerInstance, ... }
 *
 * @example
 * const managers = createManagers({
 *   bots: 'api:/api/bots',
 *   tasks: { storage: 'api:/api/tasks', label: 'Task' },
 *   settings: new SettingsManager({...})
 * }, { managerRegistry })
 */
export function createManagers(managersConfig, context = {}) {
  const managers = {}

  for (const [entityName, config] of Object.entries(managersConfig)) {
    managers[entityName] = managerFactory(config, entityName, context)
  }

  return managers
}
