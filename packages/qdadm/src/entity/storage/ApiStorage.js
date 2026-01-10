import { IStorage } from './IStorage.js'

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
 *
 * // With parameter mapping (transform filter names for API)
 * const storage = new ApiStorage({
 *   endpoint: '/commands',
 *   client: apiClient,
 *   paramMapping: {
 *     bot_uuid: 'botUuid',  // filters.bot_uuid → ?botUuid=xxx
 *     page_size: 'limit'    // page_size → ?limit=xxx
 *   }
 * })
 *
 * // With data normalization (different API format)
 * const storage = new ApiStorage({
 *   endpoint: '/api/projects/:id/tasks',
 *   client: apiClient,
 *   // API → internal format
 *   normalize: (apiData) => ({
 *     id: apiData.task_id,
 *     title: apiData.name,
 *     status: apiData.state
 *   }),
 *   // Internal → API format
 *   denormalize: (data) => ({
 *     task_id: data.id,
 *     name: data.title,
 *     state: data.status
 *   })
 * })
 * ```
 */
export class ApiStorage extends IStorage {
  static storageName = 'ApiStorage'

  /**
   * Storage capabilities declaration.
   * Describes what features this storage adapter supports.
   *
   * @type {import('./index.js').StorageCapabilities}
   */
  static capabilities = {
    supportsTotal: true,
    supportsFilters: true,
    supportsPagination: true,
    supportsCaching: true
  }

  /**
   * Backward-compatible instance getter for supportsCaching.
   * @deprecated Use static ApiStorage.capabilities.supportsCaching instead
   * @returns {boolean}
   */
  get supportsCaching() {
    return ApiStorage.capabilities.supportsCaching
  }

  constructor(options = {}) {
    super()
    const {
      endpoint,
      client = null,
      getClient = null,
      // Response format configuration
      responseItemsKey = 'items',
      responseTotalKey = 'total',
      // Parameter mapping: { clientName: apiName }
      // Transforms filter and query param names before sending to API
      paramMapping = {},
      // Data normalization
      // normalize: (apiData) => internalData - transform API response
      // denormalize: (internalData) => apiData - transform before sending
      normalize = null,
      denormalize = null
    } = options

    this.endpoint = endpoint
    this._client = client
    this._getClient = getClient
    this.responseItemsKey = responseItemsKey
    this.responseTotalKey = responseTotalKey
    this.paramMapping = paramMapping
    this._normalize = normalize
    this._denormalize = denormalize
  }

  /**
   * Normalize API response data to internal format
   * @param {object|Array} data - API response data
   * @returns {object|Array} - Normalized data
   */
  _normalizeData(data) {
    if (!this._normalize) return data
    if (Array.isArray(data)) {
      return data.map(item => this._normalize(item))
    }
    return this._normalize(data)
  }

  /**
   * Denormalize internal data to API format
   * @param {object} data - Internal data
   * @returns {object} - API format data
   */
  _denormalizeData(data) {
    if (!this._denormalize) return data
    return this._denormalize(data)
  }

  /**
   * Apply parameter mapping to transform names
   * @param {object} params - Original params
   * @returns {object} - Params with mapped names
   */
  _applyParamMapping(params) {
    if (!this.paramMapping || Object.keys(this.paramMapping).length === 0) {
      return params
    }

    const mapped = {}
    for (const [key, value] of Object.entries(params)) {
      const mappedKey = this.paramMapping[key] || key
      mapped[mappedKey] = value
    }
    return mapped
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
   * @param {object} params - Query parameters
   * @param {number} [params.page=1] - Page number (1-based)
   * @param {number} [params.page_size=20] - Items per page
   * @param {string} [params.sort_by] - Field to sort by
   * @param {string} [params.sort_order='asc'] - Sort order ('asc' or 'desc')
   * @param {object} [params.filters] - Field filters { field: value }
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async list(params = {}) {
    const { page = 1, page_size = 20, sort_by, sort_order, filters = {} } = params

    // Apply param mapping to filters
    const mappedFilters = this._applyParamMapping(filters)

    const response = await this.client.get(this.endpoint, {
      params: { page, page_size, sort_by, sort_order, ...mappedFilters }
    })

    const data = response.data
    const items = data[this.responseItemsKey] || data.items || data
    return {
      items: this._normalizeData(items),
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
    return this._normalizeData(response.data)
  }

  /**
   * Create a new entity
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    const apiData = this._denormalizeData(data)
    const response = await this.client.post(this.endpoint, apiData)
    return this._normalizeData(response.data)
  }

  /**
   * Update an entity (PUT - full replacement)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const apiData = this._denormalizeData(data)
    const response = await this.client.put(`${this.endpoint}/${id}`, apiData)
    return this._normalizeData(response.data)
  }

  /**
   * Partially update an entity (PATCH)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    const apiData = this._denormalizeData(data)
    const response = await this.client.patch(`${this.endpoint}/${id}`, apiData)
    return this._normalizeData(response.data)
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
