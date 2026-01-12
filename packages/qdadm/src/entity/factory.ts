/**
 * Manager Factory/Resolver Pattern
 *
 * Enables declarative manager configuration with auto-resolution.
 * Works with storageFactory for complete auto-wiring.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { EntityManager } from './EntityManager'
import { storageFactory } from './storage/factory'

/**
 * Manager config interface
 */
export interface ManagerConfig {
  name?: string
  storage?: any
  label?: string
  labelPlural?: string
  fields?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Manager factory context
 */
export interface ManagerFactoryContext {
  managerRegistry?: Record<string, typeof EntityManager>
  storageResolver?: (config: any, entityName: string) => any
  managerResolver?: ManagerResolver
  [key: string]: unknown
}

/**
 * Manager resolver function type
 */
export type ManagerResolver = (
  config: ManagerConfig,
  entityName: string,
  context: ManagerFactoryContext
) => EntityManager

/**
 * Default manager resolver - creates manager instance from config
 */
export function defaultManagerResolver(
  config: ManagerConfig,
  entityName: string,
  context: ManagerFactoryContext = {}
): EntityManager {
  const { managerRegistry = {} } = context

  // Look up registered manager class
  const ManagerClass = managerRegistry[entityName] || EntityManager

  // Ensure name is set
  const managerConfig = {
    name: entityName,
    ...config
  }

  return new ManagerClass(managerConfig as any)
}

/**
 * Manager factory - normalizes input and delegates to resolver
 */
export function managerFactory(
  config: EntityManager | string | ManagerConfig,
  entityName: string,
  context: ManagerFactoryContext = {}
): EntityManager {
  const {
    storageResolver,
    managerResolver = defaultManagerResolver
  } = context

  // Already a Manager instance → return directly
  if (config instanceof EntityManager) {
    return config
  }

  // Also check for duck-typed manager
  if (
    config &&
    typeof config === 'object' &&
    'storage' in config &&
    typeof (config as any).list === 'function'
  ) {
    return config as any
  }

  // String pattern → treat as storage config
  if (typeof config === 'string') {
    const storage = storageFactory(config, entityName, storageResolver as any)
    return managerResolver({ storage }, entityName, context)
  }

  // Config object → resolve storage first, then manager
  if (config && typeof config === 'object') {
    const resolvedConfig = { ...config }

    // Resolve storage if provided as string/config
    if (config.storage && typeof config.storage === 'string') {
      resolvedConfig.storage = storageFactory(config.storage, entityName, storageResolver as any)
    } else if (
      config.storage &&
      typeof config.storage === 'object' &&
      typeof (config.storage as any).list !== 'function'
    ) {
      resolvedConfig.storage = storageFactory(config.storage as any, entityName, storageResolver as any)
    }

    return managerResolver(resolvedConfig, entityName, context)
  }

  throw new Error(
    `Invalid manager config for "${entityName}": ${typeof config}. Expected string, object, or Manager instance.`
  )
}

/**
 * Create a custom manager factory with context
 */
export function createManagerFactory(
  context: ManagerFactoryContext
): (config: EntityManager | string | ManagerConfig, entityName: string) => EntityManager {
  return (config, entityName) => managerFactory(config, entityName, context)
}

/**
 * Create all managers from a config object
 */
export function createManagers(
  managersConfig: Record<string, EntityManager | string | ManagerConfig>,
  context: ManagerFactoryContext = {}
): Record<string, EntityManager> {
  const managers: Record<string, EntityManager> = {}

  for (const [entityName, config] of Object.entries(managersConfig)) {
    managers[entityName] = managerFactory(config, entityName, context)
  }

  return managers
}
