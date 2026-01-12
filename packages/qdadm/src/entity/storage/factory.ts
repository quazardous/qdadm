/**
 * Storage Factory/Resolver Pattern
 *
 * Enables declarative storage configuration with auto-resolution.
 */

import { IStorage } from './IStorage'
import { ApiStorage } from './ApiStorage'
import { LocalStorage } from './LocalStorage'
import { MemoryStorage } from './MemoryStorage'
import { MockApiStorage } from './MockApiStorage'
import { SdkStorage } from './SdkStorage'
import type { EntityRecord } from '../../types'

/**
 * Storage class type
 */
type StorageClass = typeof IStorage

/**
 * Storage type registry - maps type names to storage classes
 */
export const storageTypes: Record<string, StorageClass> = {
  api: ApiStorage as unknown as StorageClass,
  local: LocalStorage as unknown as StorageClass,
  memory: MemoryStorage as unknown as StorageClass,
  mock: MockApiStorage as unknown as StorageClass,
  sdk: SdkStorage as unknown as StorageClass,
}

/**
 * Parsed storage pattern result
 */
export interface ParsedStoragePattern {
  type: string
  endpoint?: string
  key?: string
  entityName?: string
  [key: string]: unknown
}

/**
 * Storage configuration object
 */
export interface StorageConfig {
  type?: string
  endpoint?: string
  key?: string
  entityName?: string
  initialData?: unknown[]
  [key: string]: unknown
}

/**
 * Storage resolver function type
 */
export type StorageResolver = <T extends EntityRecord = EntityRecord>(
  config: StorageConfig,
  entityName: string
) => IStorage<T>

/**
 * Parse string pattern 'type:endpoint' into config object
 */
export function parseStoragePattern(pattern: string): ParsedStoragePattern | null {
  if (typeof pattern !== 'string') return null

  // Pattern: 'type:value'
  const match = pattern.match(/^(\w+):(.+)$/)
  if (match && match[1] && match[2]) {
    const type = match[1]
    const value = match[2]
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
 */
export function defaultStorageResolver<T extends EntityRecord = EntityRecord>(
  config: StorageConfig,
  entityName: string
): IStorage<T> {
  const { type, ...rest } = config

  if (!type) {
    throw new Error('Storage config must have a type property')
  }

  const StorageClass = storageTypes[type]
  if (!StorageClass) {
    throw new Error(
      `Unknown storage type: "${type}". Available: ${Object.keys(storageTypes).join(', ')}`
    )
  }

  // Add entityName to config if not present (useful for mock/memory)
  const resolvedConfig = { ...rest }
  if (!resolvedConfig.entityName && !resolvedConfig.key) {
    if (type === 'local' || type === 'memory') {
      resolvedConfig.key = entityName
    } else if (type === 'mock') {
      resolvedConfig.entityName = entityName
    }
  }

  // @ts-expect-error - StorageClass constructor accepts options object
  return new StorageClass(resolvedConfig) as IStorage<T>
}

/**
 * Duck-typed storage interface for detection
 */
interface DuckTypedStorage {
  list: (...args: unknown[]) => Promise<unknown>
  get: (...args: unknown[]) => Promise<unknown>
}

/**
 * Storage factory - normalizes input and delegates to resolver
 *
 * Handles:
 * - IStorage instance → return directly
 * - String pattern 'type:endpoint' → parse and resolve
 * - Plain string '/endpoint' → treat as API endpoint
 * - Config object → normalize and resolve
 */
export function storageFactory<T extends EntityRecord = EntityRecord>(
  config: IStorage<T> | string | StorageConfig,
  entityName: string,
  resolver: StorageResolver = defaultStorageResolver
): IStorage<T> {
  // Already a Storage instance → return directly
  if (config instanceof IStorage) {
    return config
  }

  // Also check for duck-typed storage (has list method and isn't a class)
  if (
    config &&
    typeof config === 'object' &&
    typeof (config as unknown as DuckTypedStorage).list === 'function' &&
    typeof (config as unknown as DuckTypedStorage).get === 'function'
  ) {
    return config as unknown as IStorage<T>
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
    let normalizedConfig = config as StorageConfig
    // If no type, infer from properties
    if (!normalizedConfig.type) {
      if (normalizedConfig.endpoint) {
        normalizedConfig = { type: 'api', ...normalizedConfig }
      } else if (normalizedConfig.key) {
        normalizedConfig = { type: 'local', ...normalizedConfig }
      } else if (normalizedConfig.initialData) {
        normalizedConfig = { type: 'mock', ...normalizedConfig }
      } else {
        throw new Error(
          `Cannot infer storage type from config: ${JSON.stringify(config)}. Add 'type' property.`
        )
      }
    }
    return resolver(normalizedConfig, entityName)
  }

  throw new Error(
    `Invalid storage config: ${typeof config}. Expected string, object, or Storage instance.`
  )
}

/**
 * Create a custom storage factory with overridden resolver
 */
export function createStorageFactory(
  customResolver: StorageResolver
): <T extends EntityRecord = EntityRecord>(
  config: IStorage<T> | string | StorageConfig,
  entityName: string
) => IStorage<T> {
  return <T extends EntityRecord = EntityRecord>(
    config: IStorage<T> | string | StorageConfig,
    entityName: string
  ) => storageFactory(config, entityName, customResolver)
}
