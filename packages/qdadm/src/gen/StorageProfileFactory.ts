/**
 * Storage Profile Factory Pattern
 *
 * A storage profile factory is a function that creates storage instances for a given endpoint.
 * This pattern enables DRY backend configuration by centralizing storage creation logic
 * (API client, base URL, headers, error handling) in one place.
 *
 * Instead of configuring each entity's storage individually, you define a profile factory
 * once and pass it to createManagers(), which calls it with each entity's endpoint.
 *
 * @module gen/StorageProfileFactory
 */

import type { IStorage } from '../entity/storage/IStorage'
import type { EntityRecord } from '../types'

/**
 * Storage Profile Factory Options
 *
 * Per-entity options passed when creating storage from a profile factory.
 * Allows overriding profile defaults for specific entities.
 */
export interface StorageProfileOptions {
  /** Entity name (e.g., 'users', 'posts') */
  entity?: string
  /** Override the profile's HTTP client for this entity */
  client?: unknown
  /** Additional headers for this entity */
  headers?: Record<string, string>
  /** Force read-only mode (no create/update/delete) */
  readOnly?: boolean
  /** Custom per-entity options */
  extensions?: Record<string, unknown>
}

/**
 * Storage Profile Factory
 *
 * A function that creates storage instances for a given endpoint.
 * The factory encapsulates common storage configuration (API client, auth, base URL)
 * and creates properly-configured storage adapters for each entity.
 *
 * @example Basic factory using ApiStorage
 * ```ts
 * import axios from 'axios'
 * import { ApiStorage } from 'qdadm'
 *
 * // Define profile factory with shared configuration
 * const apiProfile: StorageProfileFactory = (endpoint, options = {}) => {
 *   return new ApiStorage({
 *     endpoint,
 *     client: axios.create({
 *       baseURL: 'https://api.example.com',
 *       headers: { 'Authorization': `Bearer ${getToken()}` }
 *     }),
 *     ...options
 *   })
 * }
 *
 * // Use with createManagers (T00317)
 * const managers = createManagers(schemas, {
 *   storageProfile: apiProfile
 * })
 * ```
 *
 * @example Factory with dynamic client resolution
 * ```ts
 * // For Vue/inject pattern - client resolved at call time
 * const lazyApiProfile: StorageProfileFactory = (endpoint, options = {}) => {
 *   return new ApiStorage({
 *     endpoint,
 *     getClient: () => inject('apiClient'),
 *     ...options
 *   })
 * }
 * ```
 *
 * @example Factory for local development
 * ```ts
 * import { MemoryStorage } from 'qdadm'
 *
 * const memoryProfile: StorageProfileFactory = (endpoint, options = {}) => {
 *   const entity = options.entity || endpoint.replace(/^\//, '')
 *   return new MemoryStorage({
 *     initialData: mockData[entity] || []
 *   })
 * }
 * ```
 */
export type StorageProfileFactory = (
  endpoint: string,
  options?: StorageProfileOptions
) => IStorage<EntityRecord>
