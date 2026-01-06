import { IStorage } from './IStorage.js'
import { QueryExecutor } from '../../query/index.js'

/**
 * MockApiStorage - In-memory storage with localStorage persistence
 *
 * Combines in-memory Map performance with localStorage persistence.
 * Designed for demos that need:
 * - Fast in-memory operations
 * - Data persistence across page reloads
 * - Optional initial data seeding
 *
 * Usage:
 * ```js
 * const storage = new MockApiStorage({
 *   entityName: 'users',
 *   idField: 'id',
 *   initialData: [{ id: '1', name: 'Alice' }]
 * })
 * ```
 *
 * localStorage key pattern: mockapi_${entityName}_data
 */
export class MockApiStorage extends IStorage {
  static storageName = 'MockApiStorage'

  /**
   * Storage capabilities declaration.
   * Describes what features this storage adapter supports.
   *
   * MockApiStorage operates with in-memory Map + localStorage persistence:
   * - supportsTotal: true - Returns accurate total from in-memory data
   * - supportsFilters: true - Filters in-memory via list() params
   * - supportsPagination: true - Paginates in-memory
   * - supportsCaching: false - Suggests EntityManager cache is not useful (see below)
   *
   * WHY supportsCaching = false?
   * MockApiStorage is already in-memory, so the primary benefit of caching (avoiding
   * network calls) doesn't apply. However, EntityManager cache CAN still be enabled
   * by subclassing and setting supportsCaching: true. This is useful when you need:
   * - Parent field resolution for searchFields (e.g., 'book.title' in loans)
   * - Warmup at boot for consistent initial state
   * - Local filtering without re-calling list()
   *
   * To enable EntityManager caching on MockApiStorage:
   * ```js
   * class CacheableMockStorage extends MockApiStorage {
   *   static capabilities = { ...MockApiStorage.capabilities, supportsCaching: true }
   *   get supportsCaching() { return true }
   * }
   * ```
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
   * @deprecated Use static MockApiStorage.capabilities.supportsCaching instead
   * @returns {boolean}
   */
  get supportsCaching() {
    return MockApiStorage.capabilities.supportsCaching
  }

  /**
   * Instance capabilities getter.
   * Merges static capabilities with instance-specific ones like requiresAuth.
   * @returns {object}
   */
  get capabilities() {
    return {
      ...MockApiStorage.capabilities,
      requiresAuth: !!this._authCheck
    }
  }

  constructor(options = {}) {
    super()
    const {
      entityName,
      idField = 'id',
      generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2),
      initialData = null,
      authCheck = null // Optional: () => boolean - throws 401 if returns false
    } = options

    if (!entityName) {
      throw new Error('MockApiStorage requires entityName option')
    }

    this.entityName = entityName
    this.idField = idField
    this.generateId = generateId
    this._storageKey = `mockapi_${entityName}_data`
    this._data = new Map()
    this._authCheck = authCheck

    // Load from localStorage or seed with initialData
    this._loadFromStorage(initialData)
  }

  /**
   * Check authentication if authCheck is configured
   * @throws {Error} 401 error if not authenticated
   */
  _checkAuth() {
    if (this._authCheck && !this._authCheck()) {
      const error = new Error(`Unauthorized: Authentication required to access ${this.entityName}`)
      error.status = 401
      throw error
    }
  }

  /**
   * Load data from localStorage, seed with initialData if empty
   * @param {Array|null} initialData - Data to seed if storage is empty
   */
  _loadFromStorage(initialData) {
    try {
      const stored = localStorage.getItem(this._storageKey)
      if (stored) {
        const items = JSON.parse(stored)
        for (const item of items) {
          const id = item[this.idField]
          if (id !== undefined && id !== null) {
            this._data.set(String(id), { ...item })
          }
        }
      } else if (initialData && Array.isArray(initialData) && initialData.length > 0) {
        // Seed with initial data
        for (const item of initialData) {
          const id = item[this.idField]
          if (id !== undefined && id !== null) {
            this._data.set(String(id), { ...item })
          }
        }
        this._persistToStorage()
      }
    } catch {
      // localStorage unavailable or corrupted, start fresh
      if (initialData && Array.isArray(initialData)) {
        for (const item of initialData) {
          const id = item[this.idField]
          if (id !== undefined && id !== null) {
            this._data.set(String(id), { ...item })
          }
        }
      }
    }
  }

  /**
   * Persist current in-memory data to localStorage
   */
  _persistToStorage() {
    try {
      const items = Array.from(this._data.values())
      localStorage.setItem(this._storageKey, JSON.stringify(items))
    } catch {
      // localStorage unavailable or quota exceeded, continue without persistence
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
   * @param {string} [params.search] - Search query (substring match on string fields)
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async list(params = {}) {
    this._checkAuth()
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {}, search } = params

    let items = this._getAll()

    // Apply filters using QueryExecutor (supports MongoDB-like operators)
    if (Object.keys(filters).length > 0) {
      items = QueryExecutor.execute(items, filters).items
    }

    // Apply search (substring match on all string fields)
    if (search && search.trim()) {
      const query = search.toLowerCase().trim()
      items = items.filter(item => {
        for (const value of Object.values(item)) {
          if (typeof value === 'string' && value.toLowerCase().includes(query)) {
            return true
          }
        }
        return false
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
    this._checkAuth()
    const item = this._data.get(String(id))
    if (!item) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    return { ...item }
  }

  /**
   * Get multiple entities by IDs (batch fetch)
   * @param {Array<string|number>} ids
   * @returns {Promise<Array<object>>}
   */
  async getMany(ids) {
    this._checkAuth()
    if (!ids || ids.length === 0) return []
    const results = []
    for (const id of ids) {
      const item = this._data.get(String(id))
      if (item) {
        results.push({ ...item })
      }
    }
    return results
  }

  /**
   * Get distinct values for a field
   * @param {string} field - Field name to get distinct values from
   * @returns {Promise<Array>} Sorted array of unique values
   */
  async distinct(field) {
    const values = new Set()
    for (const item of this._data.values()) {
      if (item[field] !== undefined && item[field] !== null) {
        values.add(item[field])
      }
    }
    return Array.from(values).sort()
  }

  /**
   * Get distinct values with counts for a field
   * @param {string} field - Field name to get distinct values from
   * @returns {Promise<Array<{ value: any, count: number }>>} Array of value/count pairs, sorted by value
   */
  async distinctWithCount(field) {
    const counts = new Map()
    for (const item of this._data.values()) {
      const value = item[field]
      if (value !== undefined && value !== null) {
        counts.set(value, (counts.get(value) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (a.value < b.value) return -1
        if (a.value > b.value) return 1
        return 0
      })
  }

  /**
   * Create a new entity
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    this._checkAuth()
    const id = data[this.idField] || this.generateId()
    const newItem = {
      ...data,
      [this.idField]: id,
      created_at: data.created_at || new Date().toISOString()
    }
    this._data.set(String(id), newItem)
    this._persistToStorage()
    return { ...newItem }
  }

  /**
   * Update an entity (PUT - full replacement)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    this._checkAuth()
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
    this._persistToStorage()
    return { ...updated }
  }

  /**
   * Partially update an entity (PATCH)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    this._checkAuth()
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
    this._persistToStorage()
    return { ...updated }
  }

  /**
   * Delete an entity
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    this._checkAuth()
    if (!this._data.has(String(id))) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    this._data.delete(String(id))
    this._persistToStorage()
  }

  /**
   * Clear all items
   * @returns {Promise<void>}
   */
  async clear() {
    this._data.clear()
    try {
      localStorage.removeItem(this._storageKey)
    } catch {
      // localStorage unavailable
    }
  }

  /**
   * Get current item count
   * @returns {number}
   */
  get size() {
    return this._data.size
  }

  /**
   * Get the localStorage key used by this storage
   * @returns {string}
   */
  get storageKey() {
    return this._storageKey
  }
}

/**
 * Factory function to create a MockApiStorage
 */
export function createMockApiStorage(options) {
  return new MockApiStorage(options)
}
