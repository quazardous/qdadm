/**
 * LocalStorage - Browser localStorage storage adapter
 *
 * Implements the storage interface using browser localStorage.
 * Useful for:
 * - Offline-first applications
 * - User preferences
 * - Draft saving
 * - Small datasets that persist across sessions
 *
 * Usage:
 * ```js
 * const storage = new LocalStorage({
 *   key: 'my_entities',
 *   idField: 'id',
 *   generateId: () => crypto.randomUUID()
 * })
 * ```
 */
export class LocalStorage {
  /**
   * LocalStorage is already in-memory, no need for EntityManager cache layer
   */
  supportsCaching = false

  constructor(options = {}) {
    const {
      key,
      idField = 'id',
      generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)
    } = options

    this.key = key
    this.idField = idField
    this.generateId = generateId
  }

  /**
   * Get all items from localStorage
   * @returns {Array}
   */
  _getAll() {
    try {
      const stored = localStorage.getItem(this.key)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  /**
   * Save all items to localStorage
   * @param {Array} items
   */
  _saveAll(items) {
    localStorage.setItem(this.key, JSON.stringify(items))
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
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {}, search } = params

    let items = this._getAll()

    // Apply filters (exact match for dropdown filters)
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      items = items.filter(item => {
        const itemValue = item[key]
        // Use exact match for filters (case-insensitive for strings)
        if (typeof value === 'string' && typeof itemValue === 'string') {
          return itemValue.toLowerCase() === value.toLowerCase()
        }
        return itemValue === value
      })
    }

    // Apply search (substring match on all string fields)
    if (search && search.trim()) {
      const query = search.toLowerCase().trim()
      items = items.filter(item => {
        // Search in all string fields
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
    const items = this._getAll()
    const item = items.find(i => i[this.idField] === id)
    if (!item) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    return item
  }

  /**
   * Get multiple entities by IDs (batch fetch)
   * @param {Array<string|number>} ids
   * @returns {Promise<Array<object>>}
   */
  async getMany(ids) {
    if (!ids || ids.length === 0) return []
    const items = this._getAll()
    const idSet = new Set(ids)
    return items.filter(i => idSet.has(i[this.idField]))
  }

  /**
   * Create a new entity
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const items = this._getAll()
    const newItem = {
      ...data,
      [this.idField]: data[this.idField] || this.generateId(),
      created_at: data.created_at || new Date().toISOString()
    }
    items.push(newItem)
    this._saveAll(items)
    return newItem
  }

  /**
   * Update an entity (PUT - full replacement)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const items = this._getAll()
    const index = items.findIndex(i => i[this.idField] === id)
    if (index === -1) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    const updated = {
      ...data,
      [this.idField]: id,
      updated_at: new Date().toISOString()
    }
    items[index] = updated
    this._saveAll(items)
    return updated
  }

  /**
   * Partially update an entity (PATCH)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    const items = this._getAll()
    const index = items.findIndex(i => i[this.idField] === id)
    if (index === -1) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    const updated = {
      ...items[index],
      ...data,
      updated_at: new Date().toISOString()
    }
    items[index] = updated
    this._saveAll(items)
    return updated
  }

  /**
   * Delete an entity
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    const items = this._getAll()
    const index = items.findIndex(i => i[this.idField] === id)
    if (index === -1) {
      const error = new Error(`Entity not found: ${id}`)
      error.status = 404
      throw error
    }
    items.splice(index, 1)
    this._saveAll(items)
  }

  /**
   * Clear all items
   * @returns {Promise<void>}
   */
  async clear() {
    localStorage.removeItem(this.key)
  }
}

/**
 * Factory function to create a LocalStorage
 */
export function createLocalStorage(options) {
  return new LocalStorage(options)
}
