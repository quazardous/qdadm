/**
 * Storage Adapters
 *
 * Boilerplate implementations for common storage backends.
 * EntityManagers can use these or implement their own storage.
 */

export { ApiStorage, createApiStorage } from './ApiStorage.js'
export { LocalStorage, createLocalStorage } from './LocalStorage.js'
export { MemoryStorage, createMemoryStorage } from './MemoryStorage.js'
