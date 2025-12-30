/**
 * MemoryStorage - In-memory storage adapter
 *
 * Implements the storage interface using in-memory Map.
 * Useful for:
 * - Testing
 * - Ephemeral data
 * - Caching layer
 * - Client-side state management
 *
 * Usage:
 * ```js
 * const storage = new MemoryStorage({
 *   idField: 'id',
 *   generateId: () => crypto.randomUUID(),
 *   initialData: [{ id: '1', name: 'Alice' }]
 * })
 * ```
 */
export class MemoryStorage {
  /**
   * Storage capabilities declaration.
   * Describes what features this storage adapter supports.
   *
   * MemoryStorage operates entirely in-memory:
   * - supportsTotal: true - Returns accurate total from in-memory data
   * - supportsFilters: true - Filters in-memory via list() params
   * - supportsPagination: true - Paginates in-memory
   * - supportsCaching: false - Already in-memory, no cache benefit
   *
   * @type {import('./index.js').StorageCapabilities}
   */
  static capabilities = {
    supportsTotal: true,
    supportsFilters: true,
    supportsPagination: true,
    supportsCaching: false
  }

  /**
   * Backward-compatible instance getter for supportsCaching.
   * @deprecated Use static MemoryStorage.capabilities.supportsCaching instead
   * @returns {boolean}
   */
  get supportsCaching() {
    return MemoryStorage.capabilities.supportsCaching
  }

  constructor(options = {}) {
    const {
      idField = 'id',
      generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2),
      initialData = []
    } = options

    this.idField = idField
    this.generateId = generateId
    this._data = new Map()

    // Initialize with initial data
    for (const item of initialData) {
      const id = item[idField]
      if (id) {
        this._data.set(String(id), { ...item })
      }
    }
  }

  /**
   * Get all items as array
   * @returns {Array}
   */
  _getAll() {
    return Array.from(this._data.values())
  }

  /**
   * List entities with pagination/filtering
   * @param {object} params - Query parameters
   * @param {number} [params.page=1] - Page number (1-based)
   * @param {number} [params.page_size=20] - Items per page
   * @param {string} [params.sort_by] - Field to sort by
   * @param {string} [params.sort_order='asc'] - Sort order ('asc' or 'desc')
   * @param {object} [params.filters] - Field filters { field: value }
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async list(params = {}) {
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {} } = params

    let items = this._getAll()

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      items = items.filter(item => {
        const itemValue = item[key]
        if (typeof value === 'string' && typeof itemValue === 'string') {
          return itemValue.toLowerCase().includes(value.toLowerCase())
        }
        return itemValue === value
      })
    }

    const total = items.length

    // Apply sorting
    if (sort_by) {
      items.sort((a, b) => {
        const aVal = a[sort_by]
        const bVal = b[sort_by]
        if (aVal < bVal) return sort_order === 'asc' ? -1 : 1
        if (aVal > bVal) return sort_order === 'asc' ? 1 : -1
        return 0
      })
    }

    // Apply pagination
    const start = (page - 1) * page_size
    items = items.slice(start, start + page_size)

    return { items, total }
  }

  /**
   * Get a single entity by ID
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  async get(id) {
    const item = this._data.get(String(id))
    if (!item) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    return { ...item }
  }

  /**
   * Create a new entity
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const id = data[this.idField] || this.generateId()
    const newItem = {
      ...data,
      [this.idField]: id,
      created_at: data.created_at || new Date().toISOString()
    }
    this._data.set(String(id), newItem)
    return { ...newItem }
  }

  /**
   * Update an entity (PUT - full replacement)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    if (!this._data.has(String(id))) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    const updated = {
      ...data,
      [this.idField]: id,
      updated_at: new Date().toISOString()
    }
    this._data.set(String(id), updated)
    return { ...updated }
  }

  /**
   * Partially update an entity (PATCH)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    const existing = this._data.get(String(id))
    if (!existing) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    const updated = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString()
    }
    this._data.set(String(id), updated)
    return { ...updated }
  }

  /**
   * Delete an entity
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!this._data.has(String(id))) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    this._data.delete(String(id))
  }

  /**
   * Clear all items
   * @returns {Promise<void>}
   */
  async clear() {
    this._data.clear()
  }

  /**
   * Get current item count
   * @returns {number}
   */
  get size() {
    return this._data.size
  }
}

/**
 * Factory function to create a MemoryStorage
 */
export function createMemoryStorage(options) {
  return new MemoryStorage(options)
}
