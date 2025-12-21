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

    // Relations
    this._children = children
    this._parent = parent
    this._relations = relations
    this._orchestrator = null  // Set when registered
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
   * Check if user can create new entities
   * Override in subclass to implement custom logic
   *
   * @returns {boolean} - true if user can create
   */
  canCreate() {
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
    return true
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

  /**
   * List entities with pagination/filtering
   * @param {object} params - { page, page_size, filters, sort_by, sort_order }
   * @returns {Promise<{ items: Array, total: number }>}
   */
  async list(params = {}) {
    if (this.storage) {
      return this.storage.list(params)
    }
    throw new Error(`[EntityManager:${this.name}] list() not implemented`)
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
      return this.storage.create(data)
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
      return this.storage.update(id, data)
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
      return this.storage.patch(id, data)
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
      return this.storage.delete(id)
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
