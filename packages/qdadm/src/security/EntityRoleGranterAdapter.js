import { RoleGranterAdapter } from './RoleGranterAdapter.js'

/**
 * EntityRoleGranterAdapter - Role granter backed by an entity
 *
 * Fetches roles and permissions from a 'roles' entity.
 * Auto-invalidates cache on entity:roles:* signals.
 * Use this for apps with a role management UI.
 *
 * Expected entity schema:
 * {
 *   id: 'role-1',
 *   name: 'ROLE_ADMIN',
 *   label: 'Administrator',
 *   permissions: ['entity:**', 'admin:**'],
 *   inherits: ['ROLE_USER']
 * }
 *
 * @example
 * // Configure Kernel with entity-based roles
 * const kernel = new Kernel({
 *   modules: [SecurityModule, ...],
 *   security: {
 *     roleGranter: new EntityRoleGranterAdapter({
 *       entityName: 'roles',
 *       nameField: 'name',
 *       permissionsField: 'permissions',
 *       inheritsField: 'inherits'
 *     })
 *   }
 * })
 *
 * // Load roles before boot
 * await kernel.options.security.roleGranter.load()
 * await kernel.boot()
 */
export class EntityRoleGranterAdapter extends RoleGranterAdapter {
  /**
   * @param {Object} options
   * @param {string} [options.entityName='roles'] - Entity name for roles
   * @param {string} [options.nameField='name'] - Field for role name
   * @param {string} [options.labelField='label'] - Field for display label
   * @param {string} [options.permissionsField='permissions'] - Field for permissions array
   * @param {string} [options.inheritsField='inherits'] - Field for parent roles (hierarchy)
   */
  constructor(options = {}) {
    super()
    this._entityName = options.entityName || 'roles'
    this._nameField = options.nameField || 'name'
    this._labelField = options.labelField || 'label'
    this._permissionsField = options.permissionsField || 'permissions'
    this._inheritsField = options.inheritsField || 'inherits'

    this._cache = null
    this._ctx = null
    this._orchestrator = null
    this._signalCleanup = null
    this._loading = null
  }

  /**
   * Install adapter (called by Kernel after orchestrator ready)
   * @param {Object} ctx - Kernel context
   */
  install(ctx) {
    this._ctx = ctx
    this._orchestrator = ctx.orchestrator

    // Auto-invalidate on role changes
    if (ctx.signals) {
      this._signalCleanup = ctx.signals.on(`entity:${this._entityName}:**`, () => {
        this.invalidate()
      })
    }
  }

  /**
   * Uninstall adapter (cleanup)
   */
  uninstall() {
    if (this._signalCleanup) {
      this._signalCleanup()
      this._signalCleanup = null
    }
    this._ctx = null
    this._orchestrator = null
    this._cache = null
    this._loading = null
  }

  /**
   * Load roles from entity (async, must be called before use)
   * @returns {Promise<void>}
   */
  async load() {
    // Prevent concurrent loads
    if (this._loading) {
      return this._loading
    }

    this._loading = this._doLoad()
    await this._loading
    this._loading = null
  }

  /**
   * Internal load implementation
   * @private
   */
  async _doLoad() {
    const manager = this._orchestrator?.get(this._entityName)
    if (!manager) {
      console.warn(`[EntityRoleGranter] Entity '${this._entityName}' not found`)
      this._cache = { permissions: {}, hierarchy: {}, labels: {} }
      return
    }

    try {
      const { data: roles } = await manager.list({ limit: 1000 })

      // Build cache
      const permissions = {}
      const hierarchy = {}
      const labels = {}

      for (const role of roles) {
        const name = role[this._nameField]
        if (!name) continue

        permissions[name] = role[this._permissionsField] || []
        labels[name] = role[this._labelField] || name

        const inherits = role[this._inheritsField]
        if (inherits?.length > 0) {
          hierarchy[name] = inherits
        }
      }

      this._cache = { permissions, hierarchy, labels }
    } catch (error) {
      console.error(`[EntityRoleGranter] Failed to load roles:`, error)
      this._cache = { permissions: {}, hierarchy: {}, labels: {} }
    }
  }

  /**
   * Ensure cache is loaded (throws if not)
   * @private
   */
  _ensureLoaded() {
    if (!this._cache) {
      throw new Error(
        '[EntityRoleGranter] Roles not loaded. Call load() before using the adapter.'
      )
    }
  }

  /**
   * Get permissions for a role
   * @param {string} role
   * @returns {string[]}
   */
  getPermissions(role) {
    this._ensureLoaded()
    return this._cache.permissions[role] || []
  }

  /**
   * Get all defined roles
   * @returns {string[]}
   */
  getRoles() {
    this._ensureLoaded()
    return Object.keys(this._cache.permissions)
  }

  /**
   * Get role hierarchy
   * @returns {Object<string, string[]>}
   */
  getHierarchy() {
    this._ensureLoaded()
    return this._cache.hierarchy
  }

  /**
   * Get role metadata
   * @param {string} role
   * @returns {RoleMeta|null}
   */
  getRoleMeta(role) {
    this._ensureLoaded()
    const label = this._cache.labels[role]
    if (!label) return null
    return { label }
  }

  /**
   * Invalidate cache (triggers reload on next access)
   * Call this after role changes
   */
  invalidate() {
    this._cache = null
  }

  /**
   * Check if cache is loaded
   * @returns {boolean}
   */
  get isLoaded() {
    return this._cache !== null
  }

  /**
   * Entity-backed adapter can always persist (via entity manager)
   * @returns {boolean}
   */
  get canPersist() {
    return true
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Role query methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a role exists
   * @param {string} role - Role name
   * @returns {boolean}
   */
  roleExists(role) {
    this._ensureLoaded()
    return this._cache.permissions[role] !== undefined
  }

  /**
   * Get complete role object
   * @param {string} role - Role name
   * @returns {Object|null}
   */
  getRole(role) {
    this._ensureLoaded()
    if (!this.roleExists(role)) {
      return null
    }
    return {
      name: role,
      label: this._cache.labels[role] || role,
      permissions: this._cache.permissions[role] || [],
      inherits: this._cache.hierarchy[role] || []
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutation methods (via entity manager)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the entity manager for roles
   * @returns {Object}
   * @private
   */
  _getManager() {
    const manager = this._orchestrator?.get(this._entityName)
    if (!manager) {
      throw new Error(`Entity '${this._entityName}' not found`)
    }
    return manager
  }

  /**
   * Create a new role
   * @param {string} name - Role name
   * @param {Object} [options]
   * @param {string} [options.label] - Display label
   * @param {string[]} [options.permissions=[]] - Permissions
   * @param {string[]} [options.inherits=[]] - Parent roles
   * @returns {Promise<Object>} Created role entity
   */
  async createRole(name, { label, permissions = [], inherits = [] } = {}) {
    if (this.roleExists(name)) {
      throw new Error(`Role '${name}' already exists`)
    }
    const manager = this._getManager()
    const data = {
      [this._nameField]: name,
      [this._labelField]: label || name,
      [this._permissionsField]: permissions,
      [this._inheritsField]: inherits
    }
    const result = await manager.create(data)
    this.invalidate()
    return result
  }

  /**
   * Update an existing role
   * @param {string} name - Role name
   * @param {Object} [options]
   * @param {string} [options.label] - Display label
   * @param {string[]} [options.permissions] - Permissions
   * @param {string[]} [options.inherits] - Parent roles
   * @returns {Promise<Object>} Updated role entity
   */
  async updateRole(name, { label, permissions, inherits } = {}) {
    this._ensureLoaded()
    const manager = this._getManager()

    // Find the role entity by name
    const { data: roles } = await manager.list({
      filter: { [this._nameField]: name },
      limit: 1
    })
    if (roles.length === 0) {
      throw new Error(`Role '${name}' does not exist`)
    }

    const roleEntity = roles[0]
    const updates = {}
    if (label !== undefined) updates[this._labelField] = label
    if (permissions !== undefined) updates[this._permissionsField] = permissions
    if (inherits !== undefined) updates[this._inheritsField] = inherits

    const result = await manager.update(roleEntity.id, updates)
    this.invalidate()
    return result
  }

  /**
   * Delete a role
   * @param {string} name - Role name
   * @returns {Promise<void>}
   */
  async deleteRole(name) {
    this._ensureLoaded()
    const manager = this._getManager()

    // Find the role entity by name
    const { data: roles } = await manager.list({
      filter: { [this._nameField]: name },
      limit: 1
    })
    if (roles.length === 0) {
      throw new Error(`Role '${name}' does not exist`)
    }

    await manager.delete(roles[0].id)
    this.invalidate()
  }
}
