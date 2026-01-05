/**
 * PersistableRoleGranterAdapter - Role granter with load/persist callbacks
 *
 * Flexible adapter that can load role→permissions mapping from any source
 * (localStorage, API, entity) and persist changes back.
 *
 * Features:
 * - Fixed permissions (incompressible, always applied, never overridden)
 * - Default mapping as fallback
 * - Async load/persist callbacks
 * - Merge strategy for defaults + loaded data
 * - Cache invalidation on persist
 *
 * Permission priority (highest to lowest):
 * 1. fixed - System permissions, always present, never overridden
 * 2. loaded - Data from load() callback
 * 3. defaults - Fallback when load returns null/fails
 *
 * @example
 * // With fixed system permissions + API loading
 * const adapter = new PersistableRoleGranterAdapter({
 *   // Fixed: ALWAYS present, even if API returns different data
 *   fixed: {
 *     role_permissions: {
 *       ROLE_ANONYMOUS: ['auth:login', 'auth:register'],
 *       ROLE_USER: ['auth:authenticated', 'auth:logout', 'profile:read']
 *     }
 *   },
 *   // Defaults: used before load() or if load fails
 *   defaults: {
 *     role_permissions: {
 *       ROLE_USER: ['entity:*:read'],
 *       ROLE_ADMIN: ['entity:**']
 *     }
 *   },
 *   // Load from API (requires auth, called after login)
 *   load: async () => {
 *     const res = await fetch('/api/config/roles')
 *     return res.json()
 *   },
 *   autoLoad: false  // Load manually after auth
 * })
 *
 * // After user authenticates
 * signals.on('auth:login', () => adapter.load())
 *
 * @example
 * // With localStorage
 * const adapter = new PersistableRoleGranterAdapter({
 *   load: () => JSON.parse(localStorage.getItem('roles') || 'null'),
 *   persist: (data) => localStorage.setItem('roles', JSON.stringify(data)),
 *   defaults: {
 *     role_permissions: {
 *       ROLE_USER: ['entity:*:read', 'entity:*:list'],
 *       ROLE_ADMIN: ['entity:**', 'admin:**']
 *     }
 *   }
 * })
 */

import { RoleGranterAdapter } from './RoleGranterAdapter.js'

export class PersistableRoleGranterAdapter extends RoleGranterAdapter {
  /**
   * Create a persistable role granter
   *
   * @param {Object} options
   * @param {Function} [options.load] - Load callback: () => Promise<RoleConfig>|RoleConfig|null
   * @param {Function} [options.persist] - Persist callback: (data: RoleConfig) => Promise<void>|void
   * @param {Object} [options.fixed={}] - Fixed/system configuration (incompressible, never overridden)
   * @param {Object} [options.fixed.role_hierarchy={}] - Fixed role hierarchy
   * @param {Object} [options.fixed.role_permissions={}] - Fixed role permissions (e.g., auth:login)
   * @param {Object} [options.fixed.role_labels={}] - Fixed role labels
   * @param {Object} [options.defaults={}] - Default configuration (fallback)
   * @param {Object} [options.defaults.role_hierarchy={}] - Default role hierarchy
   * @param {Object} [options.defaults.role_permissions={}] - Default role permissions
   * @param {Object} [options.defaults.role_labels={}] - Default role labels
   * @param {string} [options.mergeStrategy='extend'] - How to merge defaults with loaded data
   *   - 'extend': Loaded data extends defaults (loaded takes priority)
   *   - 'replace': Loaded data replaces defaults entirely
   *   - 'defaults-only': Use defaults, ignore loaded (for fallback mode)
   * @param {boolean} [options.autoLoad=true] - Auto-load on first access
   */
  constructor(options = {}) {
    super()

    this._loadFn = options.load || null
    this._persistFn = options.persist || null
    this._mergeStrategy = options.mergeStrategy || 'extend'
    this._autoLoad = options.autoLoad ?? true

    // Fixed (incompressible, always applied on top)
    this._fixed = {
      role_hierarchy: options.fixed?.role_hierarchy || {},
      role_permissions: options.fixed?.role_permissions || {},
      role_labels: options.fixed?.role_labels || {}
    }

    // Defaults (fallback)
    this._defaults = {
      role_hierarchy: options.defaults?.role_hierarchy || {},
      role_permissions: options.defaults?.role_permissions || {},
      role_labels: options.defaults?.role_labels || {}
    }

    // Current state (starts with defaults)
    this._hierarchy = { ...this._defaults.role_hierarchy }
    this._permissions = { ...this._defaults.role_permissions }
    this._labels = { ...this._defaults.role_labels }

    // Loading state
    this._loaded = false
    this._loading = null // Promise when loading
    this._dirty = false // Has unsaved changes
  }

  /**
   * Load configuration from source
   *
   * @returns {Promise<void>}
   */
  async load() {
    if (!this._loadFn) {
      this._loaded = true
      return
    }

    // Prevent concurrent loads
    if (this._loading) {
      return this._loading
    }

    this._loading = this._doLoad()
    try {
      await this._loading
    } finally {
      this._loading = null
    }
  }

  /**
   * Internal load implementation
   * @private
   */
  async _doLoad() {
    try {
      const data = await this._loadFn()

      if (data) {
        this._applyData(data)
      }

      this._loaded = true
      this._dirty = false
    } catch (err) {
      console.error('[PersistableRoleGranterAdapter] Load failed:', err)
      // Keep defaults on error
      this._loaded = true
    }
  }

  /**
   * Apply loaded data according to merge strategy
   *
   * @param {Object} data - Loaded data
   * @private
   */
  _applyData(data) {
    switch (this._mergeStrategy) {
      case 'replace':
        // Loaded data replaces everything
        this._hierarchy = data.role_hierarchy || {}
        this._permissions = data.role_permissions || {}
        this._labels = data.role_labels || {}
        break

      case 'defaults-only':
        // Ignore loaded data, use defaults
        break

      case 'extend':
      default:
        // Loaded extends defaults (loaded takes priority)
        this._hierarchy = {
          ...this._defaults.role_hierarchy,
          ...(data.role_hierarchy || {})
        }
        this._permissions = {
          ...this._defaults.role_permissions,
          ...(data.role_permissions || {})
        }
        this._labels = {
          ...this._defaults.role_labels,
          ...(data.role_labels || {})
        }
        break
    }
  }

  /**
   * Persist current configuration to source
   *
   * @returns {Promise<void>}
   */
  async persist() {
    if (!this._persistFn) {
      console.warn('[PersistableRoleGranterAdapter] No persist function configured')
      return
    }

    const data = {
      role_hierarchy: this._hierarchy,
      role_permissions: this._permissions,
      role_labels: this._labels
    }

    try {
      await this._persistFn(data)
      this._dirty = false
    } catch (err) {
      console.error('[PersistableRoleGranterAdapter] Persist failed:', err)
      throw err
    }
  }

  /**
   * Ensure data is loaded (auto-load if needed)
   *
   * @returns {Promise<void>}
   * @private
   */
  async _ensureLoaded() {
    if (!this._loaded && this._autoLoad) {
      await this.load()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RoleGranterAdapter interface
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get permissions for a role
   *
   * Merges: current permissions + fixed permissions (fixed always wins)
   *
   * @param {string} role - Role name
   * @returns {string[]} Permission patterns
   */
  getPermissions(role) {
    // Note: This is synchronous. For async sources, call load() first
    // or use autoLoad + await ensureReady() before first use
    const base = this._permissions[role] || []
    const fixed = this._fixed.role_permissions[role] || []

    // Merge: base + fixed (deduplicated)
    if (fixed.length === 0) return base
    if (base.length === 0) return fixed

    const merged = [...base]
    for (const perm of fixed) {
      if (!merged.includes(perm)) {
        merged.push(perm)
      }
    }
    return merged
  }

  /**
   * Get all defined roles
   *
   * Includes roles from: current + fixed
   *
   * @returns {string[]} Role names
   */
  getRoles() {
    const roles = new Set([
      ...Object.keys(this._permissions),
      ...Object.keys(this._fixed.role_permissions)
    ])
    return [...roles]
  }

  /**
   * Get role hierarchy
   *
   * Merges: current hierarchy + fixed hierarchy
   *
   * @returns {Object} Hierarchy map { role: [inheritedRoles] }
   */
  getHierarchy() {
    return {
      ...this._hierarchy,
      ...this._fixed.role_hierarchy
    }
  }

  /**
   * Get role labels for display
   *
   * Merges: current labels + fixed labels
   *
   * @returns {Object} Labels map { role: label }
   */
  getLabels() {
    return {
      ...this._labels,
      ...this._fixed.role_labels
    }
  }

  // getAnonymousRole() inherited from RoleGranterAdapter (returns 'ROLE_ANONYMOUS')

  // ─────────────────────────────────────────────────────────────────────────────
  // Role query methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a role exists (in current or fixed)
   *
   * @param {string} role - Role name
   * @returns {boolean}
   */
  roleExists(role) {
    return this._permissions[role] !== undefined ||
      this._fixed.role_permissions[role] !== undefined
  }

  /**
   * Get complete role object
   *
   * @param {string} role - Role name
   * @returns {RoleData|null} Role data or null if not found
   */
  getRole(role) {
    if (!this.roleExists(role)) {
      return null
    }
    return {
      name: role,
      label: this._labels[role] || this._fixed.role_labels[role] || role,
      permissions: this.getPermissions(role),
      inherits: this._hierarchy[role] || this._fixed.role_hierarchy[role] || []
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutation methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new role (async, auto-persists)
   *
   * @param {string} name - Role name
   * @param {Object} [options]
   * @param {string} [options.label] - Display label
   * @param {string[]} [options.permissions=[]] - Permission patterns
   * @param {string[]} [options.inherits=[]] - Roles to inherit from
   * @returns {Promise<RoleData>} Created role data
   * @throws {Error} If role already exists
   */
  async createRole(name, { label, permissions = [], inherits = [] } = {}) {
    if (this.roleExists(name)) {
      throw new Error(`Role '${name}' already exists`)
    }
    this._permissions[name] = [...permissions]
    if (label) this._labels[name] = label
    if (inherits.length > 0) this._hierarchy[name] = [...inherits]
    this._dirty = true

    if (this._persistFn) {
      await this.persist()
    }

    return this.getRole(name)
  }

  /**
   * Update an existing role (async, auto-persists)
   *
   * @param {string} name - Role name
   * @param {Object} [options] - Only provided properties are updated
   * @param {string} [options.label] - Display label
   * @param {string[]} [options.permissions] - Permission patterns
   * @param {string[]} [options.inherits] - Roles to inherit from
   * @returns {Promise<RoleData>} Updated role data
   * @throws {Error} If role doesn't exist
   */
  async updateRole(name, { label, permissions, inherits } = {}) {
    if (!this.roleExists(name)) {
      throw new Error(`Role '${name}' does not exist`)
    }
    if (permissions !== undefined) this._permissions[name] = [...permissions]
    if (label !== undefined) this._labels[name] = label
    if (inherits !== undefined) this._hierarchy[name] = [...inherits]
    this._dirty = true

    if (this._persistFn) {
      await this.persist()
    }

    return this.getRole(name)
  }

  /**
   * Set permissions for a role
   *
   * @param {string} role - Role name
   * @param {string[]} permissions - Permission patterns
   * @returns {this}
   */
  setRolePermissions(role, permissions) {
    this._permissions[role] = [...permissions]
    this._dirty = true
    return this
  }

  /**
   * Add permissions to a role
   *
   * @param {string} role - Role name
   * @param {string[]} permissions - Permissions to add
   * @returns {this}
   */
  addRolePermissions(role, permissions) {
    const current = this._permissions[role] || []
    const newPerms = permissions.filter(p => !current.includes(p))
    this._permissions[role] = [...current, ...newPerms]
    this._dirty = true
    return this
  }

  /**
   * Remove permissions from a role
   *
   * @param {string} role - Role name
   * @param {string[]} permissions - Permissions to remove
   * @returns {this}
   */
  removeRolePermissions(role, permissions) {
    const current = this._permissions[role] || []
    this._permissions[role] = current.filter(p => !permissions.includes(p))
    this._dirty = true
    return this
  }

  /**
   * Set role hierarchy
   *
   * @param {string} role - Role name
   * @param {string[]} inherits - Roles this role inherits from
   * @returns {this}
   */
  setRoleHierarchy(role, inherits) {
    this._hierarchy[role] = [...inherits]
    this._dirty = true
    return this
  }

  /**
   * Set role label
   *
   * @param {string} role - Role name
   * @param {string} label - Display label
   * @returns {this}
   */
  setRoleLabel(role, label) {
    this._labels[role] = label
    this._dirty = true
    return this
  }

  /**
   * Delete a role entirely (async, auto-persists)
   *
   * @param {string} name - Role name
   * @returns {Promise<void>}
   * @throws {Error} If role doesn't exist
   */
  async deleteRole(name) {
    if (!this.roleExists(name)) {
      throw new Error(`Role '${name}' does not exist`)
    }
    delete this._permissions[name]
    delete this._hierarchy[name]
    delete this._labels[name]
    this._dirty = true

    if (this._persistFn) {
      await this.persist()
    }
  }

  /**
   * Reset to defaults
   *
   * @returns {this}
   */
  reset() {
    this._hierarchy = { ...this._defaults.role_hierarchy }
    this._permissions = { ...this._defaults.role_permissions }
    this._labels = { ...this._defaults.role_labels }
    this._dirty = true
    return this
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // State inspection
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if data has been loaded
   * @returns {boolean}
   */
  get isLoaded() {
    return this._loaded
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean}
   */
  get isDirty() {
    return this._dirty
  }

  /**
   * Check if adapter supports persistence
   * Returns true if a persist function was provided
   * @returns {boolean}
   */
  get canPersist() {
    return !!this._persistFn
  }

  /**
   * Get current configuration as object
   *
   * @returns {Object} Current config
   */
  toJSON() {
    return {
      role_hierarchy: this._hierarchy,
      role_permissions: this._permissions,
      role_labels: this._labels
    }
  }

  /**
   * Get a ready promise (resolves when loaded)
   *
   * @returns {Promise<this>}
   */
  async ensureReady() {
    await this._ensureLoaded()
    return this
  }
}

/**
 * Create a localStorage-backed role granter
 *
 * Unlike async sources, localStorage is synchronous so data is loaded
 * immediately at construction time. No need to call ensureReady().
 *
 * @param {Object} options
 * @param {string} [options.key='qdadm_roles'] - localStorage key
 * @param {Object} [options.fixed] - Fixed/system configuration (incompressible)
 * @param {Object} [options.defaults] - Default configuration
 * @param {string} [options.mergeStrategy] - Merge strategy
 * @returns {PersistableRoleGranterAdapter}
 */
export function createLocalStorageRoleGranter(options = {}) {
  const key = options.key || 'qdadm_roles'

  // Load data synchronously from localStorage (localStorage is sync)
  let initialData = null
  try {
    const stored = localStorage.getItem(key)
    initialData = stored ? JSON.parse(stored) : null
  } catch {
    // Ignore parse errors, will use defaults
  }

  const adapter = new PersistableRoleGranterAdapter({
    load: () => {
      try {
        const stored = localStorage.getItem(key)
        return stored ? JSON.parse(stored) : null
      } catch {
        return null
      }
    },
    persist: (data) => {
      localStorage.setItem(key, JSON.stringify(data))
    },
    fixed: options.fixed,
    defaults: options.defaults,
    mergeStrategy: options.mergeStrategy,
    autoLoad: false // We load synchronously below
  })

  // Apply initial data immediately (synchronous load)
  if (initialData) {
    adapter._applyData(initialData)
  }
  adapter._loaded = true

  return adapter
}

/**
 * @typedef {Object} RoleData
 * @property {string} name - Role name
 * @property {string} label - Display label
 * @property {string[]} permissions - Permission patterns (includes fixed)
 * @property {string[]} inherits - Roles this role inherits from
 */
