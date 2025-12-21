/**
 * ApiStorage - REST API storage adapter
 *
 * Implements the storage interface for REST APIs.
 * Expects standard response format: { items: [], total: number, page: number }
 *
 * Usage:
 * ```js
 * import axios from 'axios'
 *
 * const storage = new ApiStorage({
 *   endpoint: '/users',
 *   client: axios.create({ baseURL: '/api' })
 * })
 *
 * // Or with callback for dynamic client
 * const storage = new ApiStorage({
 *   endpoint: '/users',
 *   getClient: () => inject('apiClient')
 * })
 * ```
 */
export class ApiStorage {
  constructor(options = {}) {
    const {
      endpoint,
      client = null,
      getClient = null,
      // Response format configuration
      responseItemsKey = 'items',
      responseTotalKey = 'total'
    } = options

    this.endpoint = endpoint
    this._client = client
    this._getClient = getClient
    this.responseItemsKey = responseItemsKey
    this.responseTotalKey = responseTotalKey
  }

  get client() {
    if (this._getClient) {
      return this._getClient()
    }
    return this._client
  }

  set client(value) {
    this._client = value
  }

  /**
   * List entities with pagination/filtering
   * @param {object} params - { page, page_size, filters, sort_by, sort_order }
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async list(params = {}) {
    const { page = 1, page_size = 20, ...filters } = params
    const response = await this.client.get(this.endpoint, {
      params: { page, page_size, ...filters }
    })

    const data = response.data
    return {
      items: data[this.responseItemsKey] || data.items || data,
      total: data[this.responseTotalKey] || data.total || (Array.isArray(data) ? data.length : 0)
    }
  }

  /**
   * Get a single entity by ID
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  async get(id) {
    const response = await this.client.get(`${this.endpoint}/${id}`)
    return response.data
  }

  /**
   * Create a new entity
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const response = await this.client.post(this.endpoint, data)
    return response.data
  }

  /**
   * Update an entity (PUT - full replacement)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const response = await this.client.put(`${this.endpoint}/${id}`, data)
    return response.data
  }

  /**
   * Partially update an entity (PATCH)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    const response = await this.client.patch(`${this.endpoint}/${id}`, data)
    return response.data
  }

  /**
   * Delete an entity
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    await this.client.delete(`${this.endpoint}/${id}`)
  }

  /**
   * Generic request for special operations
   * @param {string} method - 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'
   * @param {string} path - Relative path (appended to endpoint)
   * @param {object} options - { data, params, headers }
   * @returns {Promise<any>}
   */
  async request(method, path, options = {}) {
    const url = path.startsWith('/') ? path : `${this.endpoint}/${path}`
    const response = await this.client.request({
      method,
      url,
      data: options.data,
      params: options.params,
      headers: options.headers
    })
    return response.data
  }
}

/**
 * Factory function to create an ApiStorage
 */
export function createApiStorage(options) {
  return new ApiStorage(options)
}
