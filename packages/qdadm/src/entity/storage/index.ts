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
} from './factory.js'

// Storage adapters
export { ApiStorage, createApiStorage } from './ApiStorage.js'
export { LocalStorage, createLocalStorage } from './LocalStorage.js'
export { MemoryStorage, createMemoryStorage } from './MemoryStorage.js'
export { MockApiStorage, createMockApiStorage } from './MockApiStorage.js'
export { SdkStorage, createSdkStorage } from './SdkStorage.js'
