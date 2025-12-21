/**
 * EntityManager - Base class for entity CRUD operations
 *
 * An EntityManager can either:
 * 1. BE its own storage (implement methods directly)
 * 2. DELEGATE to a storage adapter
 *
 * This class provides the interface and optional delegation pattern.
 *
 * Usage (with delegation):
 * ```js
 * const users = new EntityManager({
 *   name: 'users',
 *   storage: new ApiStorage({ endpoint: '/users', client: axios }),
 *   // Metadata for UI
 *   label: 'User',
 *   labelPlural: 'Users',
 *   routePrefix: 'user',
 *   // Fields schema
 *   fields: {
 *     username: { type: 'text', label: 'Username', required: true },
 *     email: { type: 'email', label: 'Email', required: true },
 *     role: { type: 'select', label: 'Role', options: [...] }
 *   },
 *   children: {
 *     roles: { entity: 'roles' },
 *     sessions: { entity: 'sessions', endpoint: ':id/sessions' }
 *   }
 * })
 * ```
 *
 * Usage (direct implementation):
 * ```js
 * class UsersManager extends EntityManager {
 *   async list(params) { ... }
 *   async get(id) { ... }
 *   // etc.
 * }
 * ```
 */
export class EntityManager {
  constructor(options = {}) {
    const {
      name,
      storage = null,
      idField = 'id',
      // Metadata for UI
      label = null,           // Singular label: 'User'
      labelPlural = null,     // Plural label: 'Users'
      routePrefix = null,     // Route prefix: 'user'
      labelField = 'name',    // Field to use as display label (breadcrumb, delete confirm, etc.)
      // Fields schema
      fields = {},            // { fieldName: { type, label, required, default, options, ... } }
      // List behavior
      localFilterThreshold = null,  // Items threshold to switch to local filtering (null = use default)
      readOnly = false,             // If true, canCreate/canUpdate/canDelete return false
      // Scope control
      scopeWhitelist = null,        // Array of scopes/modules that can bypass restrictions
      // Relations
      children = {},      // { roles: { entity: 'roles', endpoint?: ':id/roles' } }
      parent = null,      // { entity: 'users', foreignKey: 'user_id' }
      relations = {}      // { groups: { entity: 'groups', through: 'user_groups' } }
    } = options

    this.name = name
    this.storage = storage
    this.idField = idField
    this._labelField = labelField  // Can be string or function

    // Metadata (with smart defaults)
    this._label = label
    this._labelPlural = labelPlural
    this._routePrefix = routePrefix
    this._fields = fields

    // List behavior
    this.localFilterThreshold = localFilterThreshold
    this._readOnly = readOnly

    // Scope control
    this._scopeWhitelist = scopeWhitelist

    // Relations
    this._children = children
    this._parent = parent
    this._relations = relations
    this._orchestrator = null  // Set when registered

    // Severity maps for status fields (field → value → severity)
    this._severityMaps = {}

    // Cache for local filtering (when items <= threshold)
    this._cache = {
      items: [],       // All items (when cached)
      total: 0,        // Total count
      loadedAt: null,  // Timestamp of last cache load
      valid: false     // Is cache currently valid?
    }
    this._cacheLoading = null  // Promise when cache is being loaded
  }

  // ============ METADATA ACCESSORS ============

  /**
   * Get entity label (singular)
   * Default: capitalize name (e.g., 'users' → 'User')
   */
  get label() {
    if (this._label) return this._label
    if (!this.name) return 'Item'
    // users → User, book → Book
    const singular = this.name.endsWith('s') ? this.name.slice(0, -1) : this.name
    return singular.charAt(0).toUpperCase() + singular.slice(1)
  }

  /**
   * Get entity label (plural)
   * Default: capitalize name or add 's' (e.g., 'user' → 'Users')
   */
  get labelPlural() {
    if (this._labelPlural) return this._labelPlural
    if (!this.name) return 'Items'
    // users → Users, book → Books
    const plural = this.name.endsWith('s') ? this.name : this.name + 's'
    return plural.charAt(0).toUpperCase() + plural.slice(1)
  }

  /**
   * Get route prefix for this entity
   * Default: singular form of name (e.g., 'books' → 'book')
   */
  get routePrefix() {
    if (this._routePrefix) return this._routePrefix
    if (!this.name) return 'item'
    return this.name.endsWith('s') ? this.name.slice(0, -1) : this.name
  }

  /**
   * Get labelField config (string or function)
   * Used by components to determine how to display entity labels
   */
  get labelField() {
    return this._labelField
  }

  /**
   * Get display label for an entity
   * Handles both string field name and callback function
   * @param {object} entity - The entity object
   * @returns {string|null} - The display label
   */
  getEntityLabel(entity) {
    if (!entity) return null
    if (typeof this._labelField === 'function') {
      return this._labelField(entity)
    }
    return entity[this._labelField] || null
  }

  // ============ PERMISSIONS ============

  /**
   * Check if user can read entities
   * Override in subclass or provide via options to implement custom logic
   *
   * @param {object} [entity] - Optional: specific entity to check
   * @returns {boolean} - true if user can read
   *
   * Without entity: general read permission (e.g., can see the list)
   * With entity: specific read permission (e.g., can see this item)
   */
  canRead(entity = null) {
    // Default: allow all reads
    return true
  }

  /**
   * Check if manager is read-only
   * @returns {boolean}
   */
  get readOnly() {
    return this._readOnly
  }

  /**
   * Check if user can create new entities
   * Override in subclass to implement custom logic
   *
   * @returns {boolean} - true if user can create
   */
  canCreate() {
    if (this._readOnly) return false
    return true
  }

  /**
   * Check if user can update entities
   * Override in subclass to implement custom logic
   *
   * @param {object} [entity] - Optional: specific entity to check
   * @returns {boolean} - true if user can update
   *
   * Without entity: general update permission
   * With entity: specific update permission (e.g., can edit this item)
   */
  canUpdate(entity = null) {
    if (this._readOnly) return false
    return true
  }

  /**
   * Check if user can delete entities
   * Override in subclass or provide via options to implement custom logic
   *
   * @param {object} [entity] - Optional: specific entity to check
   * @returns {boolean} - true if user can delete
   */
  canDelete(entity = null) {
    if (this._readOnly) return false
    return true
  }

  /**
   * Get scope whitelist
   * @returns {Array<string>|null}
   */
  get scopeWhitelist() {
    return this._scopeWhitelist
  }

  /**
   * Check if a context is whitelisted (can bypass restrictions)
   *
   * Checks context.module, context.scope, or context.form against the whitelist.
   * Also returns true if context.bypassPermissions is true with a valid reason.
   *
   * @param {object} context - { module, form, field, scope, bypassPermissions, reason }
   * @returns {boolean} - true if context is whitelisted
   */
  isWhitelisted(context = {}) {
    // Explicit bypass with reason
    if (context.bypassPermissions && context.reason) {
      return true
    }

    // No whitelist configured = nothing whitelisted
    if (!this._scopeWhitelist || this._scopeWhitelist.length === 0) {
      return false
    }

    // Check if any context property matches the whitelist
    const checkValues = [context.module, context.scope, context.form].filter(Boolean)
    return checkValues.some(val => this._scopeWhitelist.includes(val))
  }

  /**
   * Get fields schema
   */
  get fields() {
    return this._fields
  }

  /**
   * Get a specific field config
   * @param {string} fieldName
   * @returns {object|undefined}
   */
  getFieldConfig(fieldName) {
    return this._fields[fieldName]
  }

  /**
   * Get initial data for a new entity based on field defaults
   * @returns {object}
   */
  getInitialData() {
    const data = {}
    for (const [fieldName, fieldConfig] of Object.entries(this._fields)) {
      if (fieldConfig.default !== undefined) {
        data[fieldName] = typeof fieldConfig.default === 'function'
          ? fieldConfig.default()
          : fieldConfig.default
      } else {
        // Type-based defaults
        switch (fieldConfig.type) {
          case 'boolean':
            data[fieldName] = false
            break
          case 'number':
            data[fieldName] = null
            break
          case 'array':
            data[fieldName] = []
            break
          case 'object':
            data[fieldName] = {}
            break
          default:
            data[fieldName] = ''
        }
      }
    }
    return data
  }

  /**
   * Get field names that are required
   * @returns {string[]}
   */
  getRequiredFields() {
    return Object.entries(this._fields)
      .filter(([, config]) => config.required)
      .map(([name]) => name)
  }

  /**
   * Get fields that should appear in list view
   * @returns {Array<{name: string, ...config}>}
   */
  getListFields() {
    return Object.entries(this._fields)
      .filter(([, config]) => config.listable !== false)
      .map(([name, config]) => ({ name, ...config }))
  }

  /**
   * Get fields that should appear in form view
   * @returns {Array<{name: string, ...config}>}
   */
  getFormFields() {
    return Object.entries(this._fields)
      .filter(([, config]) => config.editable !== false)
      .map(([name, config]) => ({ name, ...config }))
  }

  // ============ SEVERITY MAPS ============

  /**
   * Set severity map for a field
   * @param {string} field - Field name (e.g., 'status')
   * @param {object} map - Value to severity map (e.g., { pending: 'warn', completed: 'success' })
   * @returns {this} - For chaining
   */
  setSeverityMap(field, map) {
    this._severityMaps[field] = map
    return this
  }

  /**
   * Get severity for a field value
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @param {string} [defaultSeverity='secondary'] - Default if no mapping found
   * @returns {string} - Severity string (success, info, warn, danger, secondary, contrast)
   */
  getSeverity(field, value, defaultSeverity = 'secondary') {
    const map = this._severityMaps[field]
    if (!map) return defaultSeverity
    return map[value] ?? defaultSeverity
  }

  /**
   * Check if a severity map exists for a field
   * @param {string} field - Field name
   * @returns {boolean}
   */
  hasSeverityMap(field) {
    return field in this._severityMaps
  }

  /**
   * List entities with pagination/filtering
   *
   * Opportunistic caching:
   * - If cache valid + no filters → use cache
   * - If no filters → fill cache with results (up to threshold)
   * - If filters → just return API results (don't touch cache)
   *
   * Cache-safe filters (cacheSafe: true):
   * Use this for ownership/scope filters that are session-bound and constant
   * during the user's session (e.g., user_id for "show only my items").
   * These filters are applied server-side but don't prevent caching because
   * the filtered result is valid for the entire session.
   *
   * Example - ownership-based manager:
   * ```js
   * async list(params = {}) {
   *   if (!this._isAdmin()) {
   *     params.user_id = currentUser.id
   *     params.cacheSafe = true  // Session-bound, safe to cache
   *   }
   *   return super.list(params)
   * }
   * ```
   *
   * @param {object} params - Query parameters
   * @param {number} [params.page] - Page number (1-based)
   * @param {number} [params.page_size] - Items per page
   * @param {string} [params.search] - Search query
   * @param {object} [params.filters] - Field filters
   * @param {string} [params.sort_by] - Sort field
   * @param {string} [params.sort_order] - 'asc' or 'desc'
   * @param {boolean} [params.cacheSafe] - If true, allow caching even with filters
   * @returns {Promise<{ items: Array, total: number, fromCache: boolean }>}
   */
  async list(params = {}) {
    if (!this.storage) {
      throw new Error(`[EntityManager:${this.name}] list() not implemented`)
    }

    // Extract cacheSafe flag (for ownership/scope filters that are session-bound)
    const { cacheSafe = false, ...queryParams } = params

    const hasFilters = queryParams.search || Object.keys(queryParams.filters || {}).length > 0
    const canUseCache = !hasFilters || cacheSafe

    // 1. Cache valid + cacheable → use cache with local filtering
    if (this._cache.valid && canUseCache) {
      const filtered = this._filterLocally(this._cache.items, queryParams)
      return { ...filtered, fromCache: true }
    }

    // 2. Fetch from API (storage normalizes response to { items, total })
    const response = await this.storage.list(queryParams)
    const items = response.items || []
    const total = response.total ?? items.length

    // 3. Fill cache opportunistically if cacheable and cache enabled
    if (canUseCache && this.isCacheEnabled) {
      this._cache.items = items.slice(0, this.effectiveThreshold)
      this._cache.total = total  // Always keep real total from API
      this._cache.valid = true
      this._cache.loadedAt = Date.now()
    }

    return { items, total, fromCache: false }
  }

  /**
   * Get a single entity by ID
   * @param {string|number} id
   * @returns {Promise<object>}
   */
  async get(id) {
    if (this.storage) {
      return this.storage.get(id)
    }
    throw new Error(`[EntityManager:${this.name}] get() not implemented`)
  }

  /**
   * Get multiple entities by IDs (batch fetch)
   * @param {Array<string|number>} ids
   * @returns {Promise<Array<object>>}
   */
  async getMany(ids) {
    if (!ids || ids.length === 0) return []
    if (this.storage?.getMany) {
      return this.storage.getMany(ids)
    }
    // Fallback: parallel get calls
    return Promise.all(ids.map(id => this.get(id).catch(() => null)))
      .then(results => results.filter(Boolean))
  }

  /**
   * Create a new entity
   * @param {object} data
   * @returns {Promise<object>} - The created entity
   */
  async create(data) {
    if (this.storage) {
      const result = await this.storage.create(data)
      this.invalidateCache()
      return result
    }
    throw new Error(`[EntityManager:${this.name}] create() not implemented`)
  }

  /**
   * Update an entity (PUT - full replacement)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    if (this.storage) {
      const result = await this.storage.update(id, data)
      this.invalidateCache()
      return result
    }
    throw new Error(`[EntityManager:${this.name}] update() not implemented`)
  }

  /**
   * Partially update an entity (PATCH)
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    if (this.storage) {
      const result = await this.storage.patch(id, data)
      this.invalidateCache()
      return result
    }
    throw new Error(`[EntityManager:${this.name}] patch() not implemented`)
  }

  /**
   * Delete an entity
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (this.storage) {
      const result = await this.storage.delete(id)
      this.invalidateCache()
      return result
    }
    throw new Error(`[EntityManager:${this.name}] delete() not implemented`)
  }

  /**
   * Generic request for special operations
   * @param {string} method - 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'
   * @param {string} path - Relative path
   * @param {object} options - { data, params, headers }
   * @returns {Promise<any>}
   */
  async request(method, path, options = {}) {
    if (this.storage?.request) {
      return this.storage.request(method, path, options)
    }
    throw new Error(`[EntityManager:${this.name}] request() not implemented`)
  }

  /**
   * Hook: called when manager is registered with orchestrator
   * Override to perform initialization
   */
  onRegister(orchestrator) {
    this._orchestrator = orchestrator
  }

  // ============ CACHE MANAGEMENT ============

  /**
   * Get effective threshold (0 = no cache)
   * @returns {number}
   */
  get effectiveThreshold() {
    return this.localFilterThreshold ?? 100
  }

  /**
   * Check if caching is enabled for this entity
   * Caching is disabled if:
   * - threshold is 0 (explicit disable)
   * - storage declares supportsCaching = false (e.g., LocalStorage)
   * @returns {boolean}
   */
  get isCacheEnabled() {
    if (this.effectiveThreshold <= 0) return false
    if (this.storage?.supportsCaching === false) return false
    return true
  }

  /**
   * Check if cache is in overflow mode (has more items than cached)
   * When overflow, local filtering is incomplete - must use API for filtered queries
   * @returns {boolean}
   */
  get overflow() {
    return this._cache.valid && this._cache.total > this._cache.items.length
  }

  /**
   * Invalidate the cache (call after create/update/delete)
   */
  invalidateCache() {
    this._cache.valid = false
    this._cache.items = []
    this._cache.total = 0
    this._cache.loadedAt = null
    this._cacheLoading = null
  }

  /**
   * Ensure cache is loaded (if caching is enabled and items fit)
   * @returns {Promise<boolean>} - true if cache is ready, false if too many items
   */
  async ensureCache() {
    if (!this.isCacheEnabled) return false
    if (this._cache.valid) return true

    // Avoid concurrent cache loads
    if (this._cacheLoading) {
      await this._cacheLoading
      return this._cache.valid
    }

    this._cacheLoading = this._loadCache()
    const result = await this._cacheLoading
    this._cacheLoading = null
    return result
  }

  /**
   * Internal: load all items into cache
   * @returns {Promise<boolean>} - true if cached, false if too many items
   */
  async _loadCache() {
    // First, check total count with minimal request
    const probe = await this.list({ page_size: 1 })

    if (probe.total > this.effectiveThreshold) {
      // Too many items, don't cache
      this._cache.valid = false
      return false
    }

    // Load all items
    const result = await this.list({ page_size: probe.total || this.effectiveThreshold })
    this._cache.items = result.items || []
    this._cache.total = result.total
    this._cache.loadedAt = Date.now()
    this._cache.valid = true
    return true
  }

  /**
   * Query entities with automatic cache/API decision
   *
   * - If cache valid + !overflow → local filtering
   * - If cache valid + overflow → API (cache incomplete for filtering)
   * - If cache invalid → fill via list(), then decide
   *
   * @param {object} params - Query params (search, filters, sort_by, sort_order, page, page_size)
   * @param {object} [options] - Query options
   * @param {object} [options.context] - Context info (module, form, field, scope, bypassPermissions, reason)
   * @returns {Promise<{ items: Array, total: number, fromCache: boolean }>}
   */
  async query(params = {}, options = {}) {
    const { context = {} } = options

    // Ensure cache is filled (via list)
    if (!this._cache.valid && this.isCacheEnabled) {
      await this.list({ page_size: this.effectiveThreshold })
    }

    let result

    // If overflow or cache disabled, use API for accurate filtered results
    if (this.overflow || !this.isCacheEnabled) {
      result = await this.list(params)
    } else {
      // Full cache available - filter locally
      const filtered = this._filterLocally(this._cache.items, params)
      result = { ...filtered, fromCache: true }
    }

    // Call hook if defined (for context-based customization)
    if (this.onQueryResult) {
      result = this.onQueryResult(result, context) || result
    }

    return result
  }

  /**
   * Apply filters, search, sort and pagination locally
   * @param {Array} items - All items
   * @param {object} params - Query params
   * @returns {{ items: Array, total: number }}
   */
  _filterLocally(items, params = {}) {
    const {
      search = '',
      filters = {},
      sort_by = null,
      sort_order = 'asc',
      page = 1,
      page_size = 20
    } = params

    let result = [...items]

    // Apply search (searches in all string fields by default)
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(item => {
        return Object.values(item).some(value => {
          if (typeof value === 'string') {
            return value.toLowerCase().includes(searchLower)
          }
          if (typeof value === 'number') {
            return value.toString().includes(search)
          }
          return false
        })
      })
    }

    // Apply filters
    for (const [field, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      result = result.filter(item => {
        const itemValue = item[field]
        // Array filter (e.g., status in ['active', 'pending'])
        if (Array.isArray(value)) {
          return value.includes(itemValue)
        }
        // Exact match
        return itemValue === value
      })
    }

    // Total after filtering (before pagination)
    const total = result.length

    // Apply sort
    if (sort_by) {
      result.sort((a, b) => {
        const aVal = a[sort_by]
        const bVal = b[sort_by]

        // Handle nulls
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sort_order === 'asc' ? 1 : -1
        if (bVal == null) return sort_order === 'asc' ? -1 : 1

        // Compare
        if (typeof aVal === 'string') {
          const cmp = aVal.localeCompare(bVal)
          return sort_order === 'asc' ? cmp : -cmp
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sort_order === 'asc' ? cmp : -cmp
      })
    }

    // Apply pagination
    const start = (page - 1) * page_size
    const paged = result.slice(start, start + page_size)

    return { items: paged, total }
  }

  /**
   * Get cache info (for debugging)
   * @returns {object}
   */
  getCacheInfo() {
    return {
      enabled: this.isCacheEnabled,
      threshold: this.effectiveThreshold,
      valid: this._cache.valid,
      overflow: this.overflow,
      itemCount: this._cache.items.length,
      total: this._cache.total,
      loadedAt: this._cache.loadedAt
    }
  }

  // ============ RELATIONS ============

  /**
   * Get child relation config
   * @param {string} childName - Child relation name
   * @returns {object|undefined}
   */
  getChildConfig(childName) {
    return this._children[childName]
  }

  /**
   * Get all child relation names
   * @returns {string[]}
   */
  getChildNames() {
    return Object.keys(this._children)
  }

  /**
   * Get parent relation config
   * @returns {object|null}
   */
  getParentConfig() {
    return this._parent
  }

  /**
   * List children of a parent entity
   * @param {string|number} parentId - Parent entity ID
   * @param {string} childName - Child relation name
   * @param {object} params - List params
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async listChildren(parentId, childName, params = {}) {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(`[EntityManager:${this.name}] Unknown child relation "${childName}"`)
    }

    // Build endpoint path
    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('GET', childEndpoint, { params })
    }

    throw new Error(`[EntityManager:${this.name}] listChildren() requires storage with request()`)
  }

  /**
   * Get a specific child entity
   * @param {string|number} parentId - Parent entity ID
   * @param {string} childName - Child relation name
   * @param {string|number} childId - Child entity ID
   * @returns {Promise<object>}
   */
  async getChild(parentId, childName, childId) {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(`[EntityManager:${this.name}] Unknown child relation "${childName}"`)
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('GET', `${childEndpoint}/${childId}`)
    }

    throw new Error(`[EntityManager:${this.name}] getChild() requires storage with request()`)
  }

  /**
   * Create a child entity
   * @param {string|number} parentId - Parent entity ID
   * @param {string} childName - Child relation name
   * @param {object} data - Child entity data
   * @returns {Promise<object>}
   */
  async createChild(parentId, childName, data) {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(`[EntityManager:${this.name}] Unknown child relation "${childName}"`)
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('POST', childEndpoint, { data })
    }

    throw new Error(`[EntityManager:${this.name}] createChild() requires storage with request()`)
  }

  /**
   * Delete a child entity
   * @param {string|number} parentId - Parent entity ID
   * @param {string} childName - Child relation name
   * @param {string|number} childId - Child entity ID
   * @returns {Promise<void>}
   */
  async deleteChild(parentId, childName, childId) {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(`[EntityManager:${this.name}] Unknown child relation "${childName}"`)
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('DELETE', `${childEndpoint}/${childId}`)
    }

    throw new Error(`[EntityManager:${this.name}] deleteChild() requires storage with request()`)
  }

  /**
   * Get the parent entity's manager
   * @returns {EntityManager|null}
   */
  getParentManager() {
    if (!this._parent || !this._orchestrator) return null
    return this._orchestrator.get(this._parent.entity)
  }

  /**
   * Get a child entity's manager (from orchestrator)
   * @param {string} childName - Child relation name
   * @returns {EntityManager|null}
   */
  getChildManager(childName) {
    const childConfig = this._children[childName]
    if (!childConfig || !this._orchestrator) return null
    return this._orchestrator.get(childConfig.entity)
  }

  /**
   * Hook: called when orchestrator is disposed
   * Override to perform cleanup
   */
  onDispose() {
    // Override in subclass if needed
  }
}

/**
 * Factory function to create an EntityManager
 *
 * @param {object} options
 * @param {string} options.name - Entity name
 * @param {object} [options.storage] - Storage adapter instance
 * @param {string} [options.idField='id'] - Field name for entity ID
 * @returns {EntityManager}
 */
export function createEntityManager(options) {
  return new EntityManager(options)
}
