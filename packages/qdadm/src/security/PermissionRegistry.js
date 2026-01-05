/**
 * PermissionRegistry - Central registry for all permissions
 *
 * Collects permissions declared by modules via ctx.permissions().
 * Provides discovery methods for building role management UIs.
 *
 * Permission format: namespace:target:action
 * - entity:books:read     - Entity CRUD
 * - auth:impersonate      - System feature
 * - admin:config:edit     - Admin feature
 *
 * @example
 * const registry = new PermissionRegistry()
 *
 * // Module registers permissions
 * registry.register('books', { read: 'View books' }, { isEntity: true })
 * // → entity:books:read
 *
 * registry.register('auth', { impersonate: 'Impersonate users' })
 * // → auth:impersonate
 *
 * // Query permissions
 * registry.getAll()           // All permissions
 * registry.getGrouped()       // Grouped by namespace
 * registry.exists('auth:impersonate')  // true
 */
export class PermissionRegistry {
  constructor() {
    /** @type {Map<string, PermissionDefinition>} */
    this._permissions = new Map()
  }

  /**
   * Register permissions for a namespace
   *
   * @param {string} prefix - Namespace prefix (e.g., 'books', 'auth', 'admin:config')
   * @param {Object<string, string|PermissionMeta>} permissions - Permission definitions
   * @param {Object} [options]
   * @param {boolean} [options.isEntity=false] - Prefix with 'entity:' namespace
   * @param {string} [options.module] - Module name for tracking
   *
   * @example
   * // Entity permissions (auto-prefixed with 'entity:')
   * registry.register('books', {
   *   read: 'View books',
   *   checkout: { label: 'Checkout', description: 'Borrow books' }
   * }, { isEntity: true })
   * // → entity:books:read, entity:books:checkout
   *
   * // System permissions
   * registry.register('auth', {
   *   impersonate: 'Impersonate users'
   * })
   * // → auth:impersonate
   */
  register(prefix, permissions, options = {}) {
    const namespace = options.isEntity ? `entity:${prefix}` : prefix
    const module = options.module || null

    for (const [action, meta] of Object.entries(permissions)) {
      const key = `${namespace}:${action}`
      const definition = typeof meta === 'string'
        ? { label: meta }
        : { ...meta }

      this._permissions.set(key, {
        key,
        namespace,
        action,
        module,
        label: definition.label || action,
        description: definition.description || null,
        custom: definition.custom || false
      })
    }
  }

  /**
   * Register standard CRUD permissions for an entity
   * Called automatically by ctx.entity()
   *
   * @param {string} entityName - Entity name
   * @param {Object} [options]
   * @param {string} [options.module] - Module name
   * @param {string[]} [options.actions] - Custom action list (default: CRUD)
   * @param {boolean} [options.hasOwnership] - Register entity-own:* permissions too
   * @param {string[]} [options.ownActions] - Actions for ownership (default: same as actions)
   */
  registerEntity(entityName, options = {}) {
    const actions = options.actions || ['read', 'list', 'create', 'update', 'delete']
    const permissions = {}

    for (const action of actions) {
      permissions[action] = {
        label: `${this._capitalize(action)} ${entityName}`,
        description: `Can ${action} ${entityName} records`
      }
    }

    this.register(entityName, permissions, {
      isEntity: true,
      module: options.module
    })

    // Register entity-own:* permissions for ownership-based access
    if (options.hasOwnership) {
      const ownActions = options.ownActions || actions.filter(a => a !== 'list' && a !== 'create')
      const ownPermissions = {}

      for (const action of ownActions) {
        ownPermissions[action] = {
          label: `${this._capitalize(action)} own ${entityName}`,
          description: `Can ${action} own ${entityName} records`
        }
      }

      // Register under entity-own:entityName namespace
      this.register(`entity-own:${entityName}`, ownPermissions, {
        module: options.module
      })
    }
  }

  /**
   * Unregister all permissions for a namespace
   * @param {string} namespace - Namespace to clear
   */
  unregister(namespace) {
    for (const key of this._permissions.keys()) {
      if (key.startsWith(namespace + ':')) {
        this._permissions.delete(key)
      }
    }
  }

  /**
   * Get all registered permissions
   * @returns {PermissionDefinition[]}
   */
  getAll() {
    return [...this._permissions.values()]
  }

  /**
   * Get all permission keys
   * @returns {string[]}
   */
  getKeys() {
    return [...this._permissions.keys()]
  }

  /**
   * Get permissions grouped by namespace
   * @returns {Object<string, PermissionDefinition[]>}
   *
   * @example
   * registry.getGrouped()
   * // {
   * //   'entity:books': [{ key: 'entity:books:read', ... }],
   * //   'auth': [{ key: 'auth:impersonate', ... }]
   * // }
   */
  getGrouped() {
    const groups = {}

    for (const perm of this._permissions.values()) {
      if (!groups[perm.namespace]) {
        groups[perm.namespace] = []
      }
      groups[perm.namespace].push(perm)
    }

    return groups
  }

  /**
   * Get permissions for a specific namespace
   * @param {string} namespace - Namespace prefix
   * @returns {PermissionDefinition[]}
   */
  getByNamespace(namespace) {
    return this.getAll().filter(p =>
      p.namespace === namespace || p.namespace.startsWith(namespace + ':')
    )
  }

  /**
   * Get permissions registered by a specific module
   * @param {string} moduleName - Module name
   * @returns {PermissionDefinition[]}
   */
  getByModule(moduleName) {
    return this.getAll().filter(p => p.module === moduleName)
  }

  /**
   * Get entity permissions only
   * @returns {PermissionDefinition[]}
   */
  getEntityPermissions() {
    return this.getAll().filter(p => p.namespace.startsWith('entity:'))
  }

  /**
   * Get non-entity permissions (system, feature, admin, etc.)
   * @returns {PermissionDefinition[]}
   */
  getSystemPermissions() {
    return this.getAll().filter(p => !p.namespace.startsWith('entity:'))
  }

  /**
   * Check if a permission is registered
   * @param {string} permission - Permission key
   * @returns {boolean}
   */
  exists(permission) {
    return this._permissions.has(permission)
  }

  /**
   * Get a specific permission definition
   * @param {string} permission - Permission key
   * @returns {PermissionDefinition|null}
   */
  get(permission) {
    return this._permissions.get(permission) || null
  }

  /**
   * Get count of registered permissions
   * @returns {number}
   */
  get size() {
    return this._permissions.size
  }

  /**
   * Capitalize first letter
   * @private
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

/**
 * @typedef {Object} PermissionDefinition
 * @property {string} key - Full permission key (e.g., 'entity:books:read')
 * @property {string} namespace - Namespace (e.g., 'entity:books')
 * @property {string} action - Action name (e.g., 'read')
 * @property {string|null} module - Module that registered this permission
 * @property {string} label - Human-readable label
 * @property {string|null} description - Optional description
 * @property {boolean} custom - Is this a custom (non-CRUD) permission
 */

/**
 * @typedef {Object} PermissionMeta
 * @property {string} [label] - Human-readable label
 * @property {string} [description] - Description
 * @property {boolean} [custom] - Mark as custom permission
 */
