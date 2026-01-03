/**
 * Storage Adapters
 *
 * Boilerplate implementations for common storage backends.
 * EntityManagers can use these or implement their own storage.
 */

/**
 * Storage Capabilities Interface
 *
 * Static capabilities declaration that storage adapters expose via `static capabilities = {...}`.
 * EntityManager reads these via `storage.constructor.capabilities` to determine feature support.
 *
 * All properties default to `false` if not declared (conservative assumption).
 * Custom storage implementations that don't declare capabilities will degrade gracefully
 * via fallback to empty `{}`.
 *
 * @typedef {object} StorageCapabilities
 * @property {boolean} [supportsTotal=false] - Storage `list()` returns `{ items, total }` with accurate total count
 * @property {boolean} [supportsFilters=false] - Storage `list()` accepts `filters` param and handles filtering
 * @property {boolean} [supportsPagination=false] - Storage `list()` accepts `page`/`page_size` params
 * @property {boolean} [supportsCaching=false] - Hint to EntityManager: should it cache this storage's results?
 *   This is a RECOMMENDATION, not a capability. The storage suggests whether EntityManager caching is useful:
 *   - `true`: Cache is beneficial (remote APIs, slow storages) - enables local filtering, parent field
 *     resolution, warmup at boot
 *   - `false`: Cache adds no value (already in-memory storages like MockApiStorage) - but still technically
 *     possible if overridden. Set to `false` when storage is already fast and in-memory.
 *   Use `false` for: in-memory storages, real-time data sources, storages with their own cache layer.
 *   Use `true` for: REST APIs, database backends, any storage where avoiding repeat fetches helps.
 * @property {string[]} [searchFields] - Fields to search when filtering locally. Supports own fields ('title')
 *   and parent entity fields ('book.title') via EntityManager.parents config. When undefined, all string
 *   fields are searched (default behavior). When defined, only listed fields are searched.
 */

/**
 * Migration Guide for Custom Storage Adapters
 *
 * If you have a custom storage adapter, you can add capabilities support in two ways:
 *
 * **Option 1: Static capabilities (recommended)**
 * Add a static `capabilities` property to your class. EntityManager reads this via
 * `storage.constructor.capabilities`. This is the preferred pattern for new code.
 *
 * ```js
 * export class MyCustomStorage {
 *   static capabilities = {
 *     supportsTotal: true,
 *     supportsFilters: true,
 *     supportsPagination: true,
 *     supportsCaching: true // false = "not useful" (in-memory), true = "beneficial" (remote API)
 *   }
 *
 *   // Backward-compat instance getter (optional, for smooth migration)
 *   get supportsCaching() {
 *     return MyCustomStorage.capabilities.supportsCaching
 *   }
 *
 *   async list(params) { ... }
 *   async get(id) { ... }
 *   // ... other methods
 * }
 * ```
 *
 * **Option 2: Instance property only (legacy)**
 * Keep using instance properties. EntityManager's `isCacheEnabled` check uses:
 * `if (storage?.supportsCaching === false) return false`
 * This works with instance properties directly.
 *
 * ```js
 * export class MyLegacyStorage {
 *   supportsCaching = true // or false for in-memory
 *
 *   async list(params) { ... }
 * }
 * ```
 *
 * **No capabilities declared**
 * If your storage doesn't declare capabilities, EntityManager will:
 * - Assume `supportsTotal: false` (disables auto-caching threshold check)
 * - Assume `supportsCaching: undefined` (caching allowed, but threshold check fails)
 * - Gracefully degrade without errors
 *
 * Use `getStorageCapabilities(storage)` helper to read merged capabilities with defaults.
 */

/**
 * Default capabilities for storages that don't declare their own.
 * All capabilities default to false for safe degradation.
 *
 * @type {StorageCapabilities}
 */
export const DEFAULT_STORAGE_CAPABILITIES = {
  supportsTotal: false,
  supportsFilters: false,
  supportsPagination: false,
  supportsCaching: false
}

/**
 * Read capabilities from a storage instance.
 * Accesses static `capabilities` property via constructor with fallback to defaults.
 *
 * @param {object} storage - Storage adapter instance
 * @returns {StorageCapabilities} Merged capabilities with defaults
 *
 * @example
 * const caps = getStorageCapabilities(myStorage)
 * if (caps.supportsTotal) {
 *   // Storage provides accurate total count
 * }
 */
export function getStorageCapabilities(storage) {
  const declared = storage?.constructor?.capabilities || {}
  return {
    ...DEFAULT_STORAGE_CAPABILITIES,
    ...declared
  }
}

// Base class
export { IStorage } from './IStorage.js'

// Factory/Resolver
export {
  storageFactory,
  defaultStorageResolver,
  createStorageFactory,
  parseStoragePattern,
  storageTypes
} from './factory.js'

// Storage adapters
export { ApiStorage, createApiStorage } from './ApiStorage.js'
export { LocalStorage, createLocalStorage } from './LocalStorage.js'
export { MemoryStorage, createMemoryStorage } from './MemoryStorage.js'
export { MockApiStorage, createMockApiStorage } from './MockApiStorage.js'
export { SdkStorage, createSdkStorage } from './SdkStorage.js'
