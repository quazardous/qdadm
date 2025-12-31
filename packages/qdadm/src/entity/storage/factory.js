/**
 * Storage Factory/Resolver Pattern
 *
 * Enables declarative storage configuration with auto-resolution.
 *
 * Usage:
 * ```js
 * // String pattern → factory parses, resolver creates
 * storageFactory('api:/api/bots', 'bots')  // → ApiStorage
 * storageFactory('local:settings', 'settings')  // → LocalStorage
 * storageFactory('mock:books', 'books')  // → MockApiStorage
 *
 * // Config object → factory normalizes, resolver creates
 * storageFactory({ endpoint: '/api/bots' }, 'bots')  // → ApiStorage
 * storageFactory({ type: 'local', key: 'my-key' }, 'settings')  // → LocalStorage
 *
 * // Storage instance → returned directly
 * storageFactory(myStorageInstance, 'bots')  // → myStorageInstance
 * ```
 */

import { IStorage } from './IStorage.js'
import { ApiStorage } from './ApiStorage.js'
import { LocalStorage } from './LocalStorage.js'
import { MemoryStorage } from './MemoryStorage.js'
import { MockApiStorage } from './MockApiStorage.js'
import { SdkStorage } from './SdkStorage.js'

/**
 * Storage type registry - maps type names to storage classes
 * @type {Record<string, typeof IStorage>}
 */
export const storageTypes = {
  api: ApiStorage,
  local: LocalStorage,
  memory: MemoryStorage,
  mock: MockApiStorage,
  sdk: SdkStorage
}

/**
 * Parse string pattern 'type:endpoint' into config object
 *
 * @param {string} pattern - Storage pattern (e.g., 'api:/api/bots', 'local:settings')
 * @returns {{type: string, endpoint?: string, key?: string} | null} Parsed config or null if invalid
 *
 * @example
 * parseStoragePattern('api:/api/bots')  // → { type: 'api', endpoint: '/api/bots' }
 * parseStoragePattern('local:settings')  // → { type: 'local', key: 'settings' }
 * parseStoragePattern('/api/bots')  // → { type: 'api', endpoint: '/api/bots' }
 */
export function parseStoragePattern(pattern) {
  if (typeof pattern !== 'string') return null

  // Pattern: 'type:value'
  const match = pattern.match(/^(\w+):(.+)$/)
  if (match) {
    const [, type, value] = match
    // For local/mock, value is key/name; for api/sdk, value is endpoint
    if (type === 'local' || type === 'memory') {
      return { type, key: value }
    }
    if (type === 'mock') {
      return { type, entityName: value }
    }
    return { type, endpoint: value }
  }

  // Plain string starting with '/' → assume API endpoint
  if (pattern.startsWith('/')) {
    return { type: 'api', endpoint: pattern }
  }

  return null
}

/**
 * Default storage resolver - creates storage instance from config
 *
 * Override this via Kernel config for custom storage types.
 *
 * @param {object} config - Normalized storage config with `type` property
 * @param {string} entityName - Entity name (used for key generation)
 * @returns {IStorage} Storage instance
 *
 * @example
 * defaultStorageResolver({ type: 'api', endpoint: '/api/bots' }, 'bots')
 * defaultStorageResolver({ type: 'local', key: 'settings' }, 'settings')
 */
export function defaultStorageResolver(config, entityName) {
  const { type, ...rest } = config

  const StorageClass = storageTypes[type]
  if (!StorageClass) {
    throw new Error(`Unknown storage type: "${type}". Available: ${Object.keys(storageTypes).join(', ')}`)
  }

  // Add entityName to config if not present (useful for mock/memory)
  if (!rest.entityName && !rest.key) {
    if (type === 'local' || type === 'memory') {
      rest.key = entityName
    } else if (type === 'mock') {
      rest.entityName = entityName
    }
  }

  return new StorageClass(rest)
}

/**
 * Storage factory - normalizes input and delegates to resolver
 *
 * Handles:
 * - IStorage instance → return directly
 * - String pattern 'type:endpoint' → parse and resolve
 * - Plain string '/endpoint' → treat as API endpoint
 * - Config object → normalize and resolve
 *
 * @param {IStorage | string | object} config - Storage config (instance, pattern, or object)
 * @param {string} entityName - Entity name for key generation
 * @param {function} [resolver=defaultStorageResolver] - Custom resolver function
 * @returns {IStorage} Storage instance
 *
 * @example
 * // Instance passthrough
 * storageFactory(myStorage, 'bots')  // → myStorage
 *
 * // String patterns
 * storageFactory('api:/api/bots', 'bots')  // → ApiStorage
 * storageFactory('/api/bots', 'bots')  // → ApiStorage (default type)
 * storageFactory('local:settings', 'settings')  // → LocalStorage
 *
 * // Config objects
 * storageFactory({ endpoint: '/api/bots' }, 'bots')  // → ApiStorage
 * storageFactory({ type: 'local' }, 'settings')  // → LocalStorage
 */
export function storageFactory(config, entityName, resolver = defaultStorageResolver) {
  // Already a Storage instance → return directly
  if (config instanceof IStorage) {
    return config
  }

  // Also check for duck-typed storage (has list method and isn't a class)
  if (config && typeof config === 'object' && typeof config.list === 'function' && typeof config.get === 'function') {
    return config
  }

  // String pattern → parse
  if (typeof config === 'string') {
    const parsed = parseStoragePattern(config)
    if (!parsed) {
      throw new Error(`Invalid storage pattern: "${config}". Use 'type:value' or '/api/endpoint'`)
    }
    return resolver(parsed, entityName)
  }

  // Config object → normalize
  if (config && typeof config === 'object') {
    // If no type, infer from properties
    if (!config.type) {
      if (config.endpoint) {
        config = { type: 'api', ...config }
      } else if (config.key) {
        config = { type: 'local', ...config }
      } else if (config.initialData) {
        config = { type: 'mock', ...config }
      } else {
        throw new Error(`Cannot infer storage type from config: ${JSON.stringify(config)}. Add 'type' property.`)
      }
    }
    return resolver(config, entityName)
  }

  throw new Error(`Invalid storage config: ${typeof config}. Expected string, object, or Storage instance.`)
}

/**
 * Create a custom storage factory with overridden resolver
 *
 * @param {function} customResolver - Custom resolver that handles additional types
 * @returns {function} Storage factory with custom resolver
 *
 * @example
 * const myFactory = createStorageFactory((config, entityName) => {
 *   if (config.type === 'graphql') {
 *     return new GraphQLStorage(config)
 *   }
 *   return defaultStorageResolver(config, entityName)
 * })
 */
export function createStorageFactory(customResolver) {
  return (config, entityName) => storageFactory(config, entityName, customResolver)
}
