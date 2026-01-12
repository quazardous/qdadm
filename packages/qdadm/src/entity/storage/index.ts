/**
 * Storage Adapters
 *
 * Boilerplate implementations for common storage backends.
 * EntityManagers can use these or implement their own storage.
 */

import type { StorageCapabilities } from '../../types'

/**
 * Default capabilities for storages that don't declare their own.
 * All capabilities default to false for safe degradation.
 */
export const DEFAULT_STORAGE_CAPABILITIES: StorageCapabilities = {
  supportsTotal: false,
  supportsFilters: false,
  supportsPagination: false,
  supportsCaching: false,
}

/**
 * Read capabilities from a storage instance.
 * Accesses static `capabilities` property via constructor with fallback to defaults.
 *
 * @example
 * const caps = getStorageCapabilities(myStorage)
 * if (caps.supportsTotal) {
 *   // Storage provides accurate total count
 * }
 */
export function getStorageCapabilities(
  storage: { constructor?: { capabilities?: Partial<StorageCapabilities> } } | null | undefined
): StorageCapabilities {
  const declared = storage?.constructor?.capabilities || {}
  return {
    ...DEFAULT_STORAGE_CAPABILITIES,
    ...declared,
  }
}

// Base class
export { IStorage } from './IStorage'

// Factory/Resolver
export {
  storageFactory,
  defaultStorageResolver,
  createStorageFactory,
  parseStoragePattern,
  storageTypes,
} from './factory'
export type { ParsedStoragePattern, StorageConfig, StorageResolver } from './factory'

// Storage adapters
export { ApiStorage, createApiStorage } from './ApiStorage'
export type { HttpClient, RoutingContext, ApiStorageOptions } from './ApiStorage'

export { LocalStorage, createLocalStorage } from './LocalStorage'
export type { LocalStorageOptions } from './LocalStorage'

export { MemoryStorage, createMemoryStorage, StorageError } from './MemoryStorage'
export type { MemoryStorageOptions } from './MemoryStorage'

export { MockApiStorage, createMockApiStorage } from './MockApiStorage'
export type { MockApiStorageOptions } from './MockApiStorage'

export { SdkStorage, createSdkStorage } from './SdkStorage'
export type {
  SdkInstance,
  SdkMethodConfig,
  SdkMethodTransforms,
  SdkResponseFormat,
  SdkMethods,
  SdkStorageOptions,
} from './SdkStorage'
