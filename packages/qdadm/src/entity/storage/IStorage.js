/**
 * IStorage - Base class for storage adapters
 *
 * Provides instanceof checking for storageFactory.
 * All storage adapters should extend this class.
 *
 * Usage:
 * ```js
 * class MyStorage extends IStorage {
 *   static capabilities = { supportsTotal: true, ... }
 *   async list(params) { ... }
 *   async get(id) { ... }
 *   async create(data) { ... }
 *   async update(id, data) { ... }
 *   async delete(id) { ... }
 * }
 * ```
 */
export class IStorage {
  /**
   * Default capabilities - override in subclass
   * @type {import('./index.js').StorageCapabilities}
   */
  static capabilities = {
    supportsTotal: false,
    supportsFilters: false,
    supportsPagination: false,
    supportsCaching: false
  }

  /**
   * List entities with optional filtering/pagination
   * @param {object} params - Query parameters
   * @returns {Promise<{items: Array, total?: number}>}
   */
  async list(params = {}) {
    throw new Error('list() not implemented')
  }

  /**
   * Get single entity by ID
   * @param {string} id - Entity ID
   * @returns {Promise<object|null>}
   */
  async get(id) {
    throw new Error('get() not implemented')
  }

  /**
   * Create new entity
   * @param {object} data - Entity data
   * @returns {Promise<object>} Created entity with ID
   */
  async create(data) {
    throw new Error('create() not implemented')
  }

  /**
   * Update entity by ID
   * @param {string} id - Entity ID
   * @param {object} data - Updated data
   * @returns {Promise<object>} Updated entity
   */
  async update(id, data) {
    throw new Error('update() not implemented')
  }

  /**
   * Delete entity by ID
   * @param {string} id - Entity ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    throw new Error('delete() not implemented')
  }
}
