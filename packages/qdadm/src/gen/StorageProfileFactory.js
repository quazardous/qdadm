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

/**
 * Storage Profile Factory Options
 *
 * Per-entity options passed when creating storage from a profile factory.
 * Allows overriding profile defaults for specific entities.
 *
 * @typedef {object} StorageProfileOptions
 * @property {string} [entity] - Entity name (e.g., 'users', 'posts')
 * @property {object} [client] - Override the profile's HTTP client for this entity
 * @property {object} [headers] - Additional headers for this entity
 * @property {boolean} [readOnly] - Force read-only mode (no create/update/delete)
 * @property {Record<string, *>} [extensions] - Custom per-entity options
 */

/**
 * Storage Profile Factory
 *
 * A function that creates storage instances for a given endpoint.
 * The factory encapsulates common storage configuration (API client, auth, base URL)
 * and creates properly-configured storage adapters for each entity.
 *
 * @callback StorageProfileFactory
 * @param {string} endpoint - Entity endpoint path (e.g., '/users', '/api/v1/posts')
 * @param {StorageProfileOptions} [options] - Per-entity options to override profile defaults
 * @returns {import('../entity/storage/IStorage.js').IStorage} Storage instance
 *
 * @example Basic factory using ApiStorage
 * import axios from 'axios'
 * import { ApiStorage } from 'qdadm'
 *
 * // Define profile factory with shared configuration
 * const apiProfile = (endpoint, options = {}) => {
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
 *
 * @example Factory with dynamic client resolution
 * // For Vue/inject pattern - client resolved at call time
 * const lazyApiProfile = (endpoint, options = {}) => {
 *   return new ApiStorage({
 *     endpoint,
 *     getClient: () => inject('apiClient'),
 *     ...options
 *   })
 * }
 *
 * @example Factory for local development
 * import { MemoryStorage } from 'qdadm'
 *
 * const memoryProfile = (endpoint, options = {}) => {
 *   const entity = options.entity || endpoint.replace(/^\//, '')
 *   return new MemoryStorage({
 *     initialData: mockData[entity] || []
 *   })
 * }
 *
 * @example Factory with per-entity overrides
 * const hybridProfile = (endpoint, options = {}) => {
 *   // Some entities use SDK, others use REST
 *   if (options.useSdk) {
 *     return new SdkStorage({
 *       sdk: options.sdk,
 *       collection: options.entity
 *     })
 *   }
 *   return new ApiStorage({
 *     endpoint,
 *     client: defaultClient
 *   })
 * }
 *
 * @example Factory with environment-based switching
 * const envAwareProfile = (endpoint, options = {}) => {
 *   if (import.meta.env.MODE === 'development') {
 *     return new MockApiStorage({ endpoint })
 *   }
 *   return new ApiStorage({
 *     endpoint,
 *     client: productionClient
 *   })
 * }
 */

// Type-only module - no runtime exports
// Types are available via JSDoc when importing this module
