/**
 * RoleGranterStorage - Storage bridge for roleGranter
 *
 * Implements Storage interface and delegates to roleGranter.
 * Allows RolesManager to use standard EntityManager patterns.
 */

export class RoleGranterStorage {
  /**
   * Static capabilities (standard storage pattern)
   * @type {import('../entity/storage/index.js').StorageCapabilities}
   */
  static capabilities = {
    supportsTotal: true,
    supportsFilters: false,
    supportsPagination: false,
    supportsCaching: false  // In-memory via roleGranter, no need for EntityManager cache
  }

  /**
   * @param {import('./RoleGranterAdapter.js').RoleGranterAdapter} roleGranter
   */
  constructor(roleGranter) {
    this._roleGranter = roleGranter
  }

  /**
   * Instance capabilities (merge static + dynamic)
   *
   * Dynamic properties:
   * - requiresAuth: false (roles are system data)
   * - readOnly: based on roleGranter.canPersist
   */
  get capabilities() {
    return {
      ...RoleGranterStorage.capabilities,
      requiresAuth: false,
      readOnly: !this._roleGranter?.canPersist
    }
  }

  /**
   * List all roles
   */
  async list(params = {}) {
    if (!this._roleGranter) {
      return { data: [], total: 0 }
    }

    // Ensure loaded for adapters that need it
    if (this._roleGranter.ensureReady) {
      await this._roleGranter.ensureReady()
    }

    const roleNames = this._roleGranter.getRoles()
    const roles = roleNames.map(name => this._getRole(name))

    // Simple search filter
    let filtered = roles
    if (params.search) {
      const search = params.search.toLowerCase()
      filtered = roles.filter(r =>
        r.name.toLowerCase().includes(search) ||
        r.label?.toLowerCase().includes(search)
      )
    }

    return {
      items: filtered,
      total: filtered.length
    }
  }

  /**
   * Get a single role by name
   */
  async get(name) {
    if (!this._roleGranter) return null

    if (this._roleGranter.ensureReady) {
      await this._roleGranter.ensureReady()
    }

    return this._getRole(name)
  }

  /**
   * Get many roles by names
   */
  async getMany(names) {
    if (!this._roleGranter) return []

    if (this._roleGranter.ensureReady) {
      await this._roleGranter.ensureReady()
    }

    return names.map(name => this._getRole(name)).filter(Boolean)
  }

  /**
   * Create a new role
   */
  async create(data) {
    if (!this._roleGranter?.createRole) {
      throw new Error('Role creation not supported by this adapter')
    }
    return this._roleGranter.createRole(data.name, {
      label: data.label,
      permissions: data.permissions || [],
      inherits: data.inherits || []
    })
  }

  /**
   * Update an existing role
   */
  async update(name, data) {
    if (!this._roleGranter?.updateRole) {
      throw new Error('Role update not supported by this adapter')
    }
    return this._roleGranter.updateRole(name, {
      label: data.label,
      permissions: data.permissions,
      inherits: data.inherits
    })
  }

  /**
   * Patch a role (partial update)
   */
  async patch(name, data) {
    return this.update(name, data)
  }

  /**
   * Delete a role
   */
  async delete(name) {
    if (!this._roleGranter?.deleteRole) {
      throw new Error('Role deletion not supported by this adapter')
    }
    return this._roleGranter.deleteRole(name)
  }

  /**
   * Get role object from roleGranter
   * @private
   */
  _getRole(name) {
    if (this._roleGranter.getRole) {
      return this._roleGranter.getRole(name)
    }
    // Fallback for adapters without getRole
    return {
      name,
      label: this._roleGranter.getLabels?.()[name] || name,
      permissions: this._roleGranter.getPermissions(name),
      inherits: this._roleGranter.getHierarchy()[name] || []
    }
  }
}
