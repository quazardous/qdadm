import { PermissiveAuthAdapter } from './auth/PermissiveAdapter.js'
import { AuthActions } from './auth/AuthAdapter.js'
import { QueryExecutor } from '../query/QueryExecutor.js'

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
      warmup = true,                // If true, cache is preloaded at boot via DeferredRegistry
      // Scope control
      scopeWhitelist = null,        // Array of scopes/modules that can bypass restrictions
      // Relations
      children = {},      // { roles: { entity: 'roles', endpoint?: ':id/roles' } }
      parent = null,      // { entity: 'users', foreignKey: 'user_id' }
      parents = {},       // { book: { entity: 'books', foreignKey: 'book_id' } } - multi-parent support
      relations = {},     // { groups: { entity: 'groups', through: 'user_groups' } }
      // Auth adapter (for permission checks)
      authAdapter = null  // AuthAdapter instance or null (uses PermissiveAuthAdapter)
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
    this._warmup = warmup

    // Scope control
    this._scopeWhitelist = scopeWhitelist

    // Relations
    this._children = children
    this._parent = parent
    this._parents = parents
    this._relations = relations
    this._orchestrator = null  // Set when registered

    // Auth adapter (fallback to permissive if not provided)
    this._authAdapter = authAdapter

    // HookRegistry reference for lifecycle hooks (set by Orchestrator)
    this._hooks = null

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

    // SignalBus reference for event emission (set by Orchestrator)
    this._signals = null

    // Cleanup function for signal listeners
    this._signalCleanup = null
  }

  // ============ SIGNALS ============

  /**
   * Set the SignalBus reference (called by Orchestrator during registration)
   * @param {SignalBus} signals
   */
  setSignals(signals) {
    this._signals = signals
    this._setupCacheListeners()
  }

  /**
   * Set the HookRegistry reference (called by Orchestrator during registration)
   * @param {HookRegistry} hooks
   */
  setHooks(hooks) {
    this._hooks = hooks
  }

  /**
   * Get the HookRegistry reference
   * @returns {HookRegistry|null}
   */
  get hooks() {
    return this._hooks
  }

  /**
   * Emit entity signals after CRUD operations
   * Emits both entity-specific and generic signals via SignalBus.emitEntity
   * @param {string} action - 'created', 'updated', or 'deleted'
   * @param {object} data - Signal payload data { entity, id, ... }
   * @private
   */
  _emitSignal(action, data) {
    if (!this._signals) return
    // Use SignalBus.emitEntity for proper dual-signal emission
    this._signals.emitEntity(this.name, action, data)
  }

  // ============ LIFECYCLE HOOKS ============

  /**
   * Invoke a lifecycle hook for this entity
   *
   * Invokes both entity-specific hook (e.g., 'books:presave') and
   * generic hook (e.g., 'entity:presave'). Entity-specific hooks run first.
   *
   * @param {string} hookName - Hook name without entity prefix (e.g., 'presave')
   * @param {object} context - Hook context passed to handlers
   * @private
   */
  async _invokeHook(hookName, context) {
    if (!this._hooks) return

    // Invoke entity-specific hook first (e.g., 'books:presave')
    await this._hooks.invoke(`${this.name}:${hookName}`, context)

    // Invoke generic hook (e.g., 'entity:presave')
    await this._hooks.invoke(`entity:${hookName}`, context)
  }

  /**
   * Build hook context for presave operations
   *
   * @typedef {object} PresaveContext
   * @property {string} entity - Entity name
   * @property {object} record - Record data (can be mutated by handlers)
   * @property {boolean} isNew - True for create, false for update
   * @property {string|number} [id] - Record ID (only for update)
   * @property {EntityManager} manager - This manager instance
   *
   * @param {object} data - Record data
   * @param {boolean} isNew - True for create, false for update
   * @param {string|number} [id] - Record ID (only for update)
   * @returns {PresaveContext}
   * @private
   */
  _buildPresaveContext(data, isNew, id = null) {
    const context = {
      entity: this.name,
      record: data,
      isNew,
      manager: this
    }
    if (!isNew && id !== null) {
      context.id = id
    }
    return context
  }

  /**
   * Build hook context for postsave operations
   *
   * @typedef {object} PostsaveContext
   * @property {string} entity - Entity name
   * @property {object} record - Original record data
   * @property {object} result - Saved entity returned from storage
   * @property {boolean} isNew - True for create, false for update
   * @property {string|number} [id] - Record ID
   * @property {EntityManager} manager - This manager instance
   *
   * @param {object} data - Original record data
   * @param {object} result - Saved entity from storage
   * @param {boolean} isNew - True for create, false for update
   * @param {string|number} [id] - Record ID
   * @returns {PostsaveContext}
   * @private
   */
  _buildPostsaveContext(data, result, isNew, id = null) {
    const context = {
      entity: this.name,
      record: data,
      result,
      isNew,
      manager: this
    }
    if (id !== null) {
      context.id = id
    } else if (result?.[this.idField]) {
      context.id = result[this.idField]
    }
    return context
  }

  /**
   * Build hook context for predelete operations
   *
   * @typedef {object} PredeleteContext
   * @property {string} entity - Entity name
   * @property {string|number} id - Record ID to be deleted
   * @property {EntityManager} manager - This manager instance
   *
   * @param {string|number} id - Record ID to delete
   * @returns {PredeleteContext}
   * @private
   */
  _buildPredeleteContext(id) {
    return {
      entity: this.name,
      id,
      manager: this
    }
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
   * Get the auth adapter (lazy-initialized PermissiveAuthAdapter if not set)
   * @returns {AuthAdapter}
   */
  get authAdapter() {
    if (!this._authAdapter) {
      this._authAdapter = new PermissiveAuthAdapter()
    }
    return this._authAdapter
  }

  /**
   * Build permission string for an action based on entity_permissions config
   *
   * The permission format depends on the security config:
   * - entity_permissions: false → 'entity:read'
   * - entity_permissions: true → 'books:read'
   * - entity_permissions: ['books'] → 'books:read' for books, 'entity:read' for others
   *
   * @param {string} action - Action name (read, create, update, delete, list)
   * @returns {string} - Permission string
   * @private
   */
  _getPermissionString(action) {
    const checker = this.authAdapter._securityChecker
    if (!checker) return `entity:${action}`

    const config = checker.entityPermissions
    if (config === false) return `entity:${action}`
    if (config === true) return `${this.name}:${action}`
    if (Array.isArray(config) && config.includes(this.name)) {
      return `${this.name}:${action}`
    }
    return `entity:${action}`
  }

  /**
   * Check permission using isGranted() if security is configured
   *
   * Falls back to traditional canPerform()/canAccessRecord() if no SecurityChecker.
   * This method respects the entity_permissions config for granular permissions.
   *
   * @param {string} action - Action to check (read, create, update, delete, list)
   * @param {object} [subject] - Optional subject for context-aware checks
   * @returns {boolean}
   */
  checkPermission(action, subject = null) {
    // If isGranted is available, use it
    if (this.authAdapter.isGranted && this.authAdapter._securityChecker) {
      const perm = this._getPermissionString(action)
      return this.authAdapter.isGranted(perm, subject)
    }
    // Fallback to traditional method
    return this.canAccess(action, subject)
  }

  /**
   * Set the auth adapter
   * @param {AuthAdapter|null} adapter
   */
  set authAdapter(adapter) {
    this._authAdapter = adapter
  }

  /**
   * Check if the current user can perform an action, optionally on a specific record
   *
   * This is the primary permission check method. It combines:
   * 1. Local restrictions (readOnly, scopeWhitelist)
   * 2. Scope check via AuthAdapter.canPerform() - can user do this action type?
   * 3. Silo check via AuthAdapter.canAccessRecord() - can user access this record?
   *
   * @param {string} action - Action to check: 'read', 'create', 'update', 'delete', 'list'
   * @param {object} [record] - Optional: specific record to check (for silo validation)
   * @returns {boolean} - true if action is allowed
   *
   * @example
   * // Scope-only checks (no record)
   * manager.canAccess('create')       // Can user create new items?
   * manager.canAccess('list')         // Can user see the list?
   *
   * @example
   * // Scope + silo checks (with record)
   * manager.canAccess('read', item)   // Can user see this specific item?
   * manager.canAccess('update', item) // Can user edit this specific item?
   * manager.canAccess('delete', item) // Can user delete this specific item?
   */
  canAccess(action, record = null) {
    // 1. Check readOnly restriction for write actions
    if (this._readOnly && action !== AuthActions.READ && action !== AuthActions.LIST) {
      return false
    }

    // 2. Scope check: can user perform this action on this entity type?
    const canPerformAction = this.authAdapter.canPerform(this.name, action)
    if (!canPerformAction) {
      return false
    }

    // 3. Silo check: if record provided, can user access this specific record?
    if (record !== null) {
      return this.authAdapter.canAccessRecord(this.name, record)
    }

    return true
  }

  /**
   * Check if user can read entities
   * Delegates to canAccess('read', entity)
   *
   * @param {object} [entity] - Optional: specific entity to check
   * @returns {boolean} - true if user can read
   *
   * Without entity: general read permission (e.g., can see the list)
   * With entity: specific read permission (e.g., can see this item)
   */
  canRead(entity = null) {
    return this.canAccess(AuthActions.READ, entity)
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
   * Delegates to canAccess('create')
   *
   * @returns {boolean} - true if user can create
   */
  canCreate() {
    return this.canAccess(AuthActions.CREATE)
  }

  /**
   * Check if user can update entities
   * Delegates to canAccess('update', entity)
   *
   * @param {object} [entity] - Optional: specific entity to check
   * @returns {boolean} - true if user can update
   *
   * Without entity: general update permission
   * With entity: specific update permission (e.g., can edit this item)
   */
  canUpdate(entity = null) {
    return this.canAccess(AuthActions.UPDATE, entity)
  }

  /**
   * Check if user can delete entities
   * Delegates to canAccess('delete', entity)
   *
   * @param {object} [entity] - Optional: specific entity to check
   * @returns {boolean} - true if user can delete
   */
  canDelete(entity = null) {
    return this.canAccess(AuthActions.DELETE, entity)
  }

  /**
   * Check if user can list entities
   * Delegates to canAccess('list')
   *
   * @returns {boolean} - true if user can list
   */
  canList() {
    return this.canAccess(AuthActions.LIST)
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
      console.log('[cache] Using local cache for entity:', this.name)
      const filtered = this._filterLocally(this._cache.items, queryParams)
      return { ...filtered, fromCache: true }
    }

    // 2. Fetch from API (storage normalizes response to { items, total })
    const response = await this.storage.list(queryParams)
    const items = response.items || []
    const total = response.total ?? items.length

    // 3. Fill cache opportunistically if:
    //    - canUseCache (no filters or cacheSafe filters)
    //    - isCacheEnabled (threshold > 0 and storage supports total)
    //    - total <= threshold (all items fit in cache for complete local filtering)
    if (canUseCache && this.isCacheEnabled && total <= this.effectiveThreshold) {
      this._cache.items = items  // Store all items (no slicing - total fits threshold)
      this._cache.total = total
      this._cache.valid = true
      this._cache.loadedAt = Date.now()
      // Resolve parent fields for search (book.title, user.username, etc.)
      await this._resolveSearchFields(items)
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
   *
   * Lifecycle hooks invoked:
   * - presave: Before storage.create(), can modify data or throw to abort
   * - postsave: After successful storage.create(), for side effects
   *
   * @param {object} data
   * @returns {Promise<object>} - The created entity
   */
  async create(data) {
    if (this.storage) {
      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(data, true)
      await this._invokeHook('presave', presaveContext)

      // Use potentially modified data from context
      const result = await this.storage.create(presaveContext.record)
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, true)
      await this._invokeHook('postsave', postsaveContext)

      this._emitSignal('created', {
        entity: result,
        manager: this.name,
        id: result?.[this.idField]
      })
      return result
    }
    throw new Error(`[EntityManager:${this.name}] create() not implemented`)
  }

  /**
   * Update an entity (PUT - full replacement)
   *
   * Lifecycle hooks invoked:
   * - presave: Before storage.update(), can modify data or throw to abort
   * - postsave: After successful storage.update(), for side effects
   *
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    if (this.storage) {
      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(data, false, id)
      await this._invokeHook('presave', presaveContext)

      // Use potentially modified data from context
      const result = await this.storage.update(id, presaveContext.record)
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, false, id)
      await this._invokeHook('postsave', postsaveContext)

      this._emitSignal('updated', {
        entity: result,
        manager: this.name,
        id
      })
      return result
    }
    throw new Error(`[EntityManager:${this.name}] update() not implemented`)
  }

  /**
   * Partially update an entity (PATCH)
   *
   * Lifecycle hooks invoked:
   * - presave: Before storage.patch(), can modify data or throw to abort
   * - postsave: After successful storage.patch(), for side effects
   *
   * @param {string|number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async patch(id, data) {
    if (this.storage) {
      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(data, false, id)
      await this._invokeHook('presave', presaveContext)

      // Use potentially modified data from context
      const result = await this.storage.patch(id, presaveContext.record)
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, false, id)
      await this._invokeHook('postsave', postsaveContext)

      this._emitSignal('updated', {
        entity: result,
        manager: this.name,
        id
      })
      return result
    }
    throw new Error(`[EntityManager:${this.name}] patch() not implemented`)
  }

  /**
   * Delete an entity
   *
   * Lifecycle hooks invoked:
   * - predelete: Before storage.delete(), can throw to abort (for cascade checks)
   *
   * @param {string|number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (this.storage) {
      // Invoke predelete hooks (can throw to abort, e.g., for cascade checks)
      const predeleteContext = this._buildPredeleteContext(id)
      await this._invokeHook('predelete', predeleteContext)

      const result = await this.storage.delete(id)
      this.invalidateCache()
      this._emitSignal('deleted', {
        manager: this.name,
        id
      })
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
   * Check if storage adapter supports returning total count
   *
   * Auto-caching only makes sense when storage can report total items
   * (to compare against threshold). Reads from storage.constructor.capabilities.supportsTotal.
   *
   * @returns {boolean} - true if storage supports total, false otherwise
   */
  get storageSupportsTotal() {
    const caps = this.storage?.constructor?.capabilities || {}
    return caps.supportsTotal ?? false
  }

  /**
   * Get searchable fields declared by storage adapter
   *
   * Returns the list of fields that should be searched in _filterLocally().
   * Supports both own fields ('title') and parent entity fields ('book.title').
   * When undefined (not declared), all string fields are searched.
   *
   * @returns {string[]|undefined} - Array of field names or undefined
   */
  get storageSearchFields() {
    const caps = this.storage?.constructor?.capabilities || {}
    return caps.searchFields
  }

  /**
   * Parse searchFields into own fields and parent fields
   *
   * Separates fields without dots (own fields like 'title') from fields with
   * dots (parent fields like 'book.title'). Groups parent fields by parentKey.
   *
   * @returns {{ ownFields: string[], parentFields: Object<string, string[]> }}
   */
  _parseSearchFields(overrideSearchFields = null) {
    const searchFields = overrideSearchFields ?? this.storageSearchFields ?? []
    const ownFields = []
    const parentFields = {}

    for (const field of searchFields) {
      if (!field.includes('.')) {
        ownFields.push(field)
        continue
      }

      // Split on first dot only
      const [parentKey, fieldName] = field.split('.', 2)

      // Validate parentKey exists in parents config
      if (!this._parents[parentKey]) {
        console.warn(`[EntityManager:${this.name}] Unknown parent '${parentKey}' in searchFields '${field}', skipping`)
        continue
      }

      // Group by parentKey
      if (!parentFields[parentKey]) {
        parentFields[parentKey] = []
      }
      parentFields[parentKey].push(fieldName)
    }

    return { ownFields, parentFields }
  }

  /**
   * Resolve parent entity fields for searchable caching
   *
   * Batch-fetches parent entities and caches their field values on each item
   * in a non-enumerable `_search` property to avoid JSON serialization issues.
   *
   * @param {Array} items - Items to resolve parent fields for
   * @returns {Promise<void>}
   */
  async _resolveSearchFields(items) {
    const { parentFields } = this._parseSearchFields()

    // No parent fields to resolve
    if (Object.keys(parentFields).length === 0) return

    // Need orchestrator to access other managers
    if (!this._orchestrator) {
      console.warn(`[EntityManager:${this.name}] No orchestrator, cannot resolve parent fields`)
      return
    }

    // Process each parent type
    for (const [parentKey, fields] of Object.entries(parentFields)) {
      const config = this._parents[parentKey]

      if (!config) {
        console.warn(`[EntityManager:${this.name}] Missing parent config for '${parentKey}'`)
        continue
      }

      // Extract unique parent IDs (deduplicated)
      const ids = [...new Set(items.map(i => i[config.foreignKey]).filter(Boolean))]
      if (ids.length === 0) continue

      // Batch fetch parent entities
      const manager = this._orchestrator.get(config.entity)
      if (!manager) {
        console.warn(`[EntityManager:${this.name}] Manager not found for '${config.entity}'`)
        continue
      }

      const parents = await manager.getMany(ids)
      const parentMap = new Map(parents.map(p => [p[manager.idField], p]))

      // Cache resolved values in _search (non-enumerable)
      for (const item of items) {
        // Initialize _search as non-enumerable if needed
        if (!item._search) {
          Object.defineProperty(item, '_search', {
            value: {},
            enumerable: false,
            writable: true,
            configurable: true
          })
        }

        const parent = parentMap.get(item[config.foreignKey])
        for (const field of fields) {
          item._search[`${parentKey}.${field}`] = parent?.[field] ?? ''
        }
      }
    }
  }

  /**
   * Set up signal listeners for cache invalidation
   *
   * Listens for:
   * - Parent entity invalidation: clears _search cache and invalidates
   * - Auth changes: invalidates cache on login/logout (user context changed)
   */
  _setupCacheListeners() {
    if (!this._signals) return

    // Clean up existing listeners if any
    if (this._signalCleanup) {
      this._signalCleanup()
      this._signalCleanup = null
    }

    const cleanups = []

    // Listen for parent cache invalidation (if parents defined)
    if (this._parents && Object.keys(this._parents).length > 0) {
      const parentEntities = Object.values(this._parents).map(p => p.entity)
      cleanups.push(
        this._signals.on('cache:entity:invalidated', ({ entity }) => {
          if (parentEntities.includes(entity)) {
            this._clearSearchCache()
          }
        })
      )
    }

    // Listen for targeted cache invalidation (routed by EventRouter)
    // EntityManager only listens to its own signal, staying simple.
    // EventRouter transforms high-level events (auth:impersonate) into targeted signals.
    cleanups.push(
      this._signals.on(`cache:entity:invalidate:${this.name}`, () => {
        this.invalidateCache()
      })
    )

    // Combined cleanup function
    this._signalCleanup = () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }

  /**
   * Clear the _search cache from all cached items
   *
   * Called when a parent entity is invalidated. Forces refetch and
   * re-resolution of parent fields on next list() call.
   */
  _clearSearchCache() {
    if (!this._cache.valid) return

    for (const item of this._cache.items) {
      if (item._search) {
        item._search = {}
      }
    }

    // Invalidate cache so next list() refetches
    this.invalidateCache()
  }

  /**
   * Check if caching is enabled for this entity
   *
   * Caching is disabled if:
   * - threshold is 0 (explicit disable)
   * - storage declares supportsCaching = false (e.g., LocalStorage)
   * - storage does not support total count (cannot determine if items fit threshold)
   *
   * @returns {boolean}
   */
  get isCacheEnabled() {
    if (this.effectiveThreshold <= 0) return false
    if (this.storage?.supportsCaching === false) return false
    if (!this.storageSupportsTotal) return false
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
   *
   * Emits cache:entity:invalidated signal only when cache was previously valid
   * to avoid duplicate signals on repeated invalidation calls.
   */
  invalidateCache() {
    const wasValid = this._cache.valid

    this._cache.valid = false
    this._cache.items = []
    this._cache.total = 0
    this._cache.loadedAt = null
    this._cacheLoading = null

    // Emit cache invalidation signal only when cache was actually valid
    // This prevents noise on repeated invalidation calls
    if (wasValid && this._signals) {
      this._signals.emit('cache:entity:invalidated', { entity: this.name })
    }
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
    // Resolve parent fields for search (book.title, user.username, etc.)
    await this._resolveSearchFields(this._cache.items)
    return true
  }

  /**
   * Warmup: preload cache via DeferredRegistry for loose async coupling
   *
   * Called by Orchestrator.fireWarmups() at boot. Registers the cache loading
   * in DeferredRegistry so pages can await it before rendering.
   *
   * @returns {Promise<boolean>|null} Promise if warmup started, null if disabled/not applicable
   *
   * @example
   * ```js
   * // At boot (automatic via Kernel)
   * orchestrator.warmupAll()
   *
   * // In component - await cache ready
   * await deferred.await('entity:books:cache')
   * const { items } = await booksManager.list()  // Uses local cache
   * ```
   */
  async warmup() {
    // Skip if warmup disabled or caching not applicable
    if (!this._warmup) return null
    if (!this.isCacheEnabled) return null

    const deferred = this._orchestrator?.deferred

    // Wait for auth if app uses authentication (user context affects cache)
    if (deferred?.has('auth:ready')) {
      await deferred.await('auth:ready')
    }

    const key = `entity:${this.name}:cache`

    if (!deferred) {
      // Fallback: direct cache load without DeferredRegistry
      return this.ensureCache()
    }

    // Register in DeferredRegistry for loose coupling
    return deferred.queue(key, () => this.ensureCache())
  }

  /**
   * Check if warmup is enabled for this manager
   * @returns {boolean}
   */
  get warmupEnabled() {
    return this._warmup && this.isCacheEnabled
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
      console.log('[cache] API call for entity:', this.name, '(total > threshold)', 'isCacheEnabled:', this.isCacheEnabled, 'overflow:', this.overflow)
      result = await this.list(params)
    } else {
      // Full cache available - filter locally
      console.log('[cache] Using local cache for entity:', this.name)
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
   * Build MongoDB-like query from filters object
   *
   * Converts EntityManager filter params to QueryExecutor format:
   * - Skips null/undefined/empty string values
   * - Arrays become implicit $in (handled by QueryExecutor)
   * - Single values stay as implicit $eq
   *
   * @param {object} filters - Field filters { field: value }
   * @returns {object} - Query object for QueryExecutor
   * @private
   */
  _buildQuery(filters) {
    const query = {}
    for (const [field, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      // Arrays and single values are passed through as-is
      // QueryExecutor handles implicit $in for arrays and $eq for primitives
      query[field] = value
    }
    return query
  }

  /**
   * Apply filters, search, sort and pagination locally
   *
   * Uses QueryExecutor for filtering (MongoDB-like operators supported).
   * Sort and pagination are applied after filtering.
   *
   * @param {Array} items - All items
   * @param {object} params - Query params
   * @returns {{ items: Array, total: number }}
   */
  _filterLocally(items, params = {}) {
    const {
      search = '',
      searchFields: overrideSearchFields = null,  // Override storage's searchFields
      filters = {},
      sort_by = null,
      sort_order = 'asc',
      page = 1,
      page_size = 20
    } = params

    let result = [...items]

    // Apply search
    // If searchFields is declared, search in own fields + parent fields (from _search cache)
    // If not declared, search all string/number fields (backward compatible)
    // Override searchFields takes priority over storage's searchFields
    if (search) {
      const searchLower = search.toLowerCase()
      const searchFields = overrideSearchFields ?? this.storageSearchFields

      result = result.filter(item => {
        if (searchFields) {
          const { ownFields, parentFields } = this._parseSearchFields(searchFields)

          // Search own fields
          for (const field of ownFields) {
            const value = item[field]
            if (typeof value === 'string' && value.toLowerCase().includes(searchLower)) {
              return true
            }
            if (typeof value === 'number' && value.toString().includes(search)) {
              return true
            }
          }

          // Search cached parent fields (in item._search)
          if (item._search) {
            for (const [parentKey, fields] of Object.entries(parentFields)) {
              for (const field of fields) {
                const key = `${parentKey}.${field}`
                const value = item._search[key]
                if (typeof value === 'string' && value.toLowerCase().includes(searchLower)) {
                  return true
                }
                if (typeof value === 'number' && value.toString().includes(search)) {
                  return true
                }
              }
            }
          }

          return false
        } else {
          // No searchFields declared: search all string/number fields
          return Object.values(item).some(value => {
            if (typeof value === 'string') {
              return value.toLowerCase().includes(searchLower)
            }
            if (typeof value === 'number') {
              return value.toString().includes(search)
            }
            return false
          })
        }
      })
    }

    // Build query and apply filters using QueryExecutor
    const query = this._buildQuery(filters)
    if (Object.keys(query).length > 0) {
      const { items: filtered } = QueryExecutor.execute(result, query)
      result = filtered
    }

    // Total after filtering (before pagination)
    const total = result.length

    // Apply sort (QueryExecutor does not sort)
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
      storageSupportsTotal: this.storageSupportsTotal,
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
