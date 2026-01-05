import { IStorage } from './IStorage.js'

/**
 * SdkStorage - hey-api SDK storage adapter
 *
 * Implements the storage interface using hey-api generated SDKs.
 * Provides config-based method mapping with optional transform callbacks.
 *
 * Usage:
 * ```js
 * import { Sdk } from './generated/sdk.gen.js'
 *
 * const sdk = new Sdk({ client: myClient })
 *
 * // Simple string mapping
 * const storage = new SdkStorage({
 *   sdk,
 *   methods: {
 *     list: 'getApiAdminTasks',
 *     get: 'getApiAdminTasksById',
 *     create: 'postApiAdminTasks',
 *     update: 'patchApiAdminTasksById',
 *     delete: 'deleteApiAdminTasksById'
 *   }
 * })
 *
 * // Function callbacks for full control
 * const storage = new SdkStorage({
 *   sdk,
 *   methods: {
 *     list: async (sdk, params) => {
 *       const result = await sdk.getApiAdminTasks({ query: params })
 *       return result.data
 *     },
 *     get: async (sdk, id) => {
 *       const result = await sdk.getApiAdminTasksById({ path: { id } })
 *       return result.data
 *     }
 *   }
 * })
 *
 * // With global transform callbacks for tweaks
 * const storage = new SdkStorage({
 *   sdk,
 *   methods: {
 *     list: 'getApiAdminTasks',
 *     get: 'getApiAdminTasksById'
 *   },
 *   transformRequest: (method, params) => {
 *     if (method === 'list') {
 *       return { query: params }
 *     }
 *     return params
 *   },
 *   transformResponse: (method, response) => {
 *     return response.data
 *   }
 * })
 *
 * // With method-specific transforms (takes precedence over global)
 * const storage = new SdkStorage({
 *   sdk,
 *   methods: {
 *     list: 'getApiAdminTasks',
 *     get: 'getApiAdminTasksById'
 *   },
 *   transforms: {
 *     list: {
 *       request: (params) => ({ query: { ...params, include_deleted: false } }),
 *       response: (data) => ({ items: data.results, total: data.count })
 *     },
 *     get: {
 *       response: (data) => data.entity
 *     }
 *   }
 * })
 *
 * // Client-side pagination for SDKs that don't support server-side pagination
 * const storage = new SdkStorage({
 *   sdk,
 *   methods: { list: 'getAllItems' },
 *   clientSidePagination: true  // Fetches all, paginates in-memory
 * })
 *
 * // With responseFormat for APIs with non-standard response shapes
 * // Normalization happens BEFORE user transforms (so users get consistent format)
 * const storage = new SdkStorage({
 *   sdk,
 *   methods: { list: 'getItems' },
 *   responseFormat: {
 *     dataField: 'results',     // or 'data', 'items' - field containing the array
 *     totalField: 'count',      // or 'total', null (compute from array)
 *     itemsField: 'data.items'  // nested path like 'response.data.items'
 *   }
 * })
 * ```
 */
export class SdkStorage extends IStorage {
  static storageName = 'SdkStorage'

  /**
   * Storage capabilities declaration
   * @type {import('./index.js').StorageCapabilities}
   */
  static capabilities = {
    supportsTotal: true,      // list() returns { items, total }
    supportsFilters: true,    // list() accepts filters param
    supportsPagination: true, // list() accepts page/page_size
    supportsCaching: true     // Benefits from EntityManager cache layer
  }

  /**
   * Backward-compat instance getter for supportsCaching
   * @deprecated Use SdkStorage.capabilities.supportsCaching instead
   * @returns {boolean}
   */
  get supportsCaching() {
    return SdkStorage.capabilities.supportsCaching
  }

  /**
   * @param {object} options
   * @param {object} options.sdk - hey-api SDK instance
   * @param {Function} [options.getSdk] - Callback to get SDK instance (for lazy loading)
   * @param {object} options.methods - Method mapping configuration
   * @param {string|Function} [options.methods.list] - List entities method
   * @param {string|Function} [options.methods.get] - Get single entity method
   * @param {string|Function} [options.methods.create] - Create entity method
   * @param {string|Function} [options.methods.update] - Update entity (PUT) method
   * @param {string|Function} [options.methods.patch] - Partial update (PATCH) method
   * @param {string|Function} [options.methods.delete] - Delete entity method
   * @param {Function} [options.transformRequest] - Global transform for request params before SDK call
   * @param {Function} [options.transformResponse] - Global transform for response after SDK call (receives normalized data)
   * @param {object} [options.transforms] - Method-specific transforms (takes precedence over global)
   * @param {object} [options.transforms.list] - { request: fn, response: fn } for list method
   * @param {object} [options.transforms.get] - { request: fn, response: fn } for get method
   * @param {object} [options.transforms.create] - { request: fn, response: fn } for create method
   * @param {object} [options.transforms.update] - { request: fn, response: fn } for update method
   * @param {object} [options.transforms.patch] - { request: fn, response: fn } for patch method
   * @param {object} [options.transforms.delete] - { request: fn, response: fn } for delete method
   * @param {object} [options.responseFormat] - Response format configuration for list() normalization
   * @param {string} [options.responseFormat.dataField] - Field containing array (e.g., 'data', 'results')
   * @param {string} [options.responseFormat.totalField] - Field containing total count (e.g., 'total', 'count', null to compute)
   * @param {string} [options.responseFormat.itemsField] - Nested path to items (e.g., 'data.items')
   * @param {boolean} [options.clientSidePagination=false] - Enable client-side pagination for list()
   */
  constructor(options = {}) {
    super()
    const {
      sdk = null,
      getSdk = null,
      methods = {},
      transformRequest = null,
      transformResponse = null,
      transforms = {},
      responseFormat = null,
      clientSidePagination = false
    } = options

    this._sdk = sdk
    this._getSdk = getSdk
    this._methods = methods
    this._transformRequest = transformRequest
    this._transformResponse = transformResponse
    this._transforms = transforms
    this._responseFormat = responseFormat
    this.clientSidePagination = clientSidePagination
  }

  /**
   * Get SDK instance (supports lazy loading via getSdk callback)
   */
  get sdk() {
    if (this._getSdk) {
      return this._getSdk()
    }
    return this._sdk
  }

  set sdk(value) {
    this._sdk = value
  }

  /**
   * Get request transform for an operation
   * Method-specific transforms take precedence over global transforms
   * @param {string} operation - Operation name
   * @returns {Function|null}
   */
  _getRequestTransform(operation) {
    const methodTransforms = this._transforms[operation]
    if (methodTransforms?.request) {
      return methodTransforms.request
    }
    return this._transformRequest
  }

  /**
   * Get response transform for an operation
   * Method-specific transforms take precedence over global transforms
   * @param {string} operation - Operation name
   * @returns {Function|null}
   */
  _getResponseTransform(operation) {
    const methodTransforms = this._transforms[operation]
    if (methodTransforms?.response) {
      return methodTransforms.response
    }
    return this._transformResponse
  }

  /**
   * Get a nested value from an object using dot notation
   * @param {object} obj - Source object
   * @param {string} path - Dot-separated path (e.g., 'data.items')
   * @returns {any} Value at path or undefined
   */
  _getNestedValue(obj, path) {
    if (!path || !obj) return undefined
    return path.split('.').reduce((acc, part) => acc?.[part], obj)
  }

  /**
   * Normalize list response to { items: Array, total: number } format
   * Handles various API response shapes before user transforms
   * @param {any} data - Raw response data from SDK
   * @returns {{ items: Array, total: number }}
   */
  _normalizeListResponse(data) {
    // Already an array - wrap it
    if (Array.isArray(data)) {
      return { items: data, total: data.length }
    }

    // Not an object - return empty
    if (!data || typeof data !== 'object') {
      return { items: [], total: 0 }
    }

    const format = this._responseFormat
    let items
    let total

    if (format) {
      // Use configured responseFormat
      // itemsField takes precedence (nested path), then dataField (simple key)
      if (format.itemsField) {
        items = this._getNestedValue(data, format.itemsField)
      } else if (format.dataField) {
        items = data[format.dataField]
      }

      // Get total from configured field or compute
      if (format.totalField) {
        total = data[format.totalField]
      }
    }

    // Fallback to common field names if not found via config
    if (!Array.isArray(items)) {
      items = data.items || data.data || data.results || []
    }

    // Ensure items is an array
    if (!Array.isArray(items)) {
      items = []
    }

    // Compute total if not found
    if (total === undefined || total === null) {
      total = data.total ?? data.count ?? items.length
    }

    return { items, total }
  }

  /**
   * Execute an SDK method with optional transforms
   * @param {string} operation - Storage operation name (list, get, create, etc.)
   * @param {any} params - Parameters for the operation
   * @returns {Promise<any>}
   */
  async _execute(operation, params) {
    const methodConfig = this._methods[operation]

    if (!methodConfig) {
      throw new Error(`SdkStorage: No method configured for operation '${operation}'`)
    }

    const sdk = this.sdk
    if (!sdk) {
      throw new Error('SdkStorage: No SDK instance available')
    }

    // Apply request transform if provided (method-specific or global)
    let transformedParams = params
    const requestTransform = this._getRequestTransform(operation)
    if (requestTransform) {
      // Method-specific transforms receive just params, global receives (operation, params)
      const isMethodSpecific = this._transforms[operation]?.request === requestTransform
      transformedParams = isMethodSpecific
        ? requestTransform(params)
        : requestTransform(operation, params)
    }

    let result

    if (typeof methodConfig === 'function') {
      // Direct function callback - full control to user
      result = await methodConfig(sdk, transformedParams)
    } else if (typeof methodConfig === 'string') {
      // String method name - call SDK method
      const sdkMethod = sdk[methodConfig]
      if (typeof sdkMethod !== 'function') {
        throw new Error(`SdkStorage: SDK method '${methodConfig}' not found`)
      }
      const response = await sdkMethod.call(sdk, transformedParams)
      result = response.data
    } else {
      throw new Error(`SdkStorage: Invalid method config for '${operation}' - expected string or function`)
    }

    // For list operations, normalize response BEFORE user transforms
    // This ensures users always receive consistent { items, total } format
    if (operation === 'list') {
      result = this._normalizeListResponse(result)
    }

    // Apply response transform if provided (method-specific or global)
    const responseTransform = this._getResponseTransform(operation)
    if (responseTransform) {
      // Method-specific transforms receive just result, global receives (operation, result)
      const isMethodSpecific = this._transforms[operation]?.response === responseTransform
      result = isMethodSpecific
        ? responseTransform(result)
        : responseTransform(operation, result)
    }

    return result
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

    // Build query params for SDK (hey-api style)
    const queryParams = { query: { page, page_size, sort_by, sort_order, ...filters } }

    // _execute normalizes response to { items, total } before applying user transforms
    const data = await this._execute('list', queryParams)

    // Extract items and total from normalized response
    let { items, total } = data

    // Ensure items is an array (user transform may have altered it)
    if (!Array.isArray(items)) {
      items = []
      total = 0
    }

    // Client-side pagination: SDK returned all items, we paginate locally
    if (this.clientSidePagination && items.length > 0) {
      total = items.length

      // Apply client-side sorting
      if (sort_by) {
        items = [...items].sort((a, b) => {
          const aVal = a[sort_by]
          const bVal = b[sort_by]
          if (aVal < bVal) return sort_order === 'asc' ? -1 : 1
          if (aVal > bVal) return sort_order === 'asc' ? 1 : -1
          return 0
        })
      }

      // Apply client-side filtering
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

      // Update total after filtering
      total = items.length

      // Apply client-side pagination
      const start = (page - 1) * page_size
      items = items.slice(start, start + page_size)
    }

    return { items, total }
  }

  /**
   * Get a single entity by ID
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  async get(id) {
    // Build path params for SDK (hey-api style)
    const pathParams = { path: { id } }
    return this._execute('get', pathParams)
  }

  /**
   * Create a new entity
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    // Build body params for SDK (hey-api style)
    const bodyParams = { body: data }
    return this._execute('create', bodyParams)
  }

  /**
   * Update an entity (PUT - full replacement)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    // Build combined params for SDK (hey-api style)
    const params = { path: { id }, body: data }
    return this._execute('update', params)
  }

  /**
   * Partially update an entity (PATCH)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    // Build combined params for SDK (hey-api style)
    const params = { path: { id }, body: data }
    return this._execute('patch', params)
  }

  /**
   * Delete an entity
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    // Build path params for SDK (hey-api style)
    const pathParams = { path: { id } }
    return this._execute('delete', pathParams)
  }

  /**
   * Generic request for special operations (SDK methods not in standard CRUD)
   * @param {string} methodName - SDK method name or operation key
   * @param {object} params - Parameters to pass to the SDK method
   * @returns {Promise<any>}
   */
  async request(methodName, params = {}) {
    // Check if it's a configured method first
    if (this._methods[methodName]) {
      return this._execute(methodName, params)
    }

    // Otherwise, try to call the SDK method directly
    const sdk = this.sdk
    if (!sdk) {
      throw new Error('SdkStorage: No SDK instance available')
    }

    const sdkMethod = sdk[methodName]
    if (typeof sdkMethod !== 'function') {
      throw new Error(`SdkStorage: SDK method '${methodName}' not found`)
    }

    const response = await sdkMethod.call(sdk, params)
    return response.data
  }
}

/**
 * Factory function to create an SdkStorage
 */
export function createSdkStorage(options) {
  return new SdkStorage(options)
}
