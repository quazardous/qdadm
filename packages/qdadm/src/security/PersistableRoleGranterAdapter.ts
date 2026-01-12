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

import { RoleGranterAdapter } from './RoleGranterAdapter'
import type { RoleData, RoleHierarchyMap } from './RoleGranterAdapter'

/**
 * Role configuration structure
 */
export interface RoleConfig {
  role_hierarchy?: Record<string, string[]>
  role_permissions?: Record<string, string[]>
  role_labels?: Record<string, string>
}

/**
 * Merge strategy for combining defaults with loaded data
 */
export type MergeStrategy = 'extend' | 'replace' | 'defaults-only'

/**
 * Load callback type
 */
export type LoadCallback = () => Promise<RoleConfig | null> | RoleConfig | null

/**
 * Persist callback type
 */
export type PersistCallback = (data: RoleConfig) => Promise<void> | void

/**
 * Options for PersistableRoleGranterAdapter
 */
export interface PersistableRoleGranterOptions {
  load?: LoadCallback
  persist?: PersistCallback
  fixed?: RoleConfig
  defaults?: RoleConfig
  mergeStrategy?: MergeStrategy
  autoLoad?: boolean
}

/**
 * Options for createLocalStorageRoleGranter
 */
export interface LocalStorageRoleGranterOptions {
  key?: string
  fixed?: RoleConfig
  defaults?: RoleConfig
  mergeStrategy?: MergeStrategy
}

export class PersistableRoleGranterAdapter extends RoleGranterAdapter {
  private _loadFn: LoadCallback | null
  private _persistFn: PersistCallback | null
  private _mergeStrategy: MergeStrategy
  private _autoLoad: boolean

  // Fixed (incompressible, always applied on top)
  private _fixed: Required<RoleConfig>

  // Defaults (fallback)
  private _defaults: Required<RoleConfig>

  // Current state (starts with defaults)
  protected _hierarchy: Record<string, string[]>
  protected _permissions: Record<string, string[]>
  protected _labels: Record<string, string>

  // Loading state
  // Note: _loaded is public to allow createLocalStorageRoleGranter to set it
  public _loaded: boolean = false
  private _loading: Promise<void> | null = null
  private _dirty: boolean = false

  /**
   * Create a persistable role granter
   */
  constructor(options: PersistableRoleGranterOptions = {}) {
    super()

    this._loadFn = options.load || null
    this._persistFn = options.persist || null
    this._mergeStrategy = options.mergeStrategy || 'extend'
    this._autoLoad = options.autoLoad ?? true

    // Fixed (incompressible, always applied on top)
    this._fixed = {
      role_hierarchy: options.fixed?.role_hierarchy || {},
      role_permissions: options.fixed?.role_permissions || {},
      role_labels: options.fixed?.role_labels || {},
    }

    // Defaults (fallback)
    this._defaults = {
      role_hierarchy: options.defaults?.role_hierarchy || {},
      role_permissions: options.defaults?.role_permissions || {},
      role_labels: options.defaults?.role_labels || {},
    }

    // Current state (starts with defaults)
    this._hierarchy = { ...this._defaults.role_hierarchy }
    this._permissions = { ...this._defaults.role_permissions }
    this._labels = { ...this._defaults.role_labels }
  }

  /**
   * Load configuration from source
   */
  async load(): Promise<void> {
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
   */
  private async _doLoad(): Promise<void> {
    try {
      const data = await this._loadFn!()

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
   */
  _applyData(data: RoleConfig): void {
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
          ...(data.role_hierarchy || {}),
        }
        this._permissions = {
          ...this._defaults.role_permissions,
          ...(data.role_permissions || {}),
        }
        this._labels = {
          ...this._defaults.role_labels,
          ...(data.role_labels || {}),
        }
        break
    }
  }

  /**
   * Persist current configuration to source
   */
  async persist(): Promise<void> {
    if (!this._persistFn) {
      console.warn('[PersistableRoleGranterAdapter] No persist function configured')
      return
    }

    const data: RoleConfig = {
      role_hierarchy: this._hierarchy,
      role_permissions: this._permissions,
      role_labels: this._labels,
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
   */
  private async _ensureLoaded(): Promise<void> {
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
   */
  getPermissions(role: string): string[] {
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
   */
  getRoles(): string[] {
    const roles = new Set<string>([
      ...Object.keys(this._permissions),
      ...Object.keys(this._fixed.role_permissions),
    ])
    return [...roles]
  }

  /**
   * Get role hierarchy
   *
   * Merges: current hierarchy + fixed hierarchy
   */
  getHierarchy(): RoleHierarchyMap {
    return {
      ...this._hierarchy,
      ...this._fixed.role_hierarchy,
    }
  }

  /**
   * Get role labels for display
   *
   * Merges: current labels + fixed labels
   */
  getLabels(): Record<string, string> {
    return {
      ...this._labels,
      ...this._fixed.role_labels,
    }
  }

  // getAnonymousRole() inherited from RoleGranterAdapter (returns 'ROLE_ANONYMOUS')

  // ─────────────────────────────────────────────────────────────────────────────
  // Role query methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a role exists (in current or fixed)
   */
  roleExists(role: string): boolean {
    return (
      this._permissions[role] !== undefined || this._fixed.role_permissions[role] !== undefined
    )
  }

  /**
   * Get complete role object
   */
  getRole(role: string): RoleData | null {
    if (!this.roleExists(role)) {
      return null
    }
    return {
      name: role,
      label: this._labels[role] || this._fixed.role_labels[role] || role,
      permissions: this.getPermissions(role),
      inherits: this._hierarchy[role] || this._fixed.role_hierarchy[role] || [],
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutation methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new role (async, auto-persists)
   */
  async createRole(
    name: string,
    { label, permissions = [], inherits = [] }: { label?: string; permissions?: string[]; inherits?: string[] } = {}
  ): Promise<RoleData> {
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

    return this.getRole(name)!
  }

  /**
   * Update an existing role (async, auto-persists)
   */
  async updateRole(
    name: string,
    { label, permissions, inherits }: { label?: string; permissions?: string[]; inherits?: string[] } = {}
  ): Promise<RoleData> {
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

    return this.getRole(name)!
  }

  /**
   * Set permissions for a role
   */
  setRolePermissions(role: string, permissions: string[]): this {
    this._permissions[role] = [...permissions]
    this._dirty = true
    return this
  }

  /**
   * Add permissions to a role
   */
  addRolePermissions(role: string, permissions: string[]): this {
    const current = this._permissions[role] || []
    const newPerms = permissions.filter((p) => !current.includes(p))
    this._permissions[role] = [...current, ...newPerms]
    this._dirty = true
    return this
  }

  /**
   * Remove permissions from a role
   */
  removeRolePermissions(role: string, permissions: string[]): this {
    const current = this._permissions[role] || []
    this._permissions[role] = current.filter((p) => !permissions.includes(p))
    this._dirty = true
    return this
  }

  /**
   * Set role hierarchy
   */
  setRoleHierarchy(role: string, inherits: string[]): this {
    this._hierarchy[role] = [...inherits]
    this._dirty = true
    return this
  }

  /**
   * Set role label
   */
  setRoleLabel(role: string, label: string): this {
    this._labels[role] = label
    this._dirty = true
    return this
  }

  /**
   * Delete a role entirely (async, auto-persists)
   */
  async deleteRole(name: string): Promise<void> {
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
   */
  reset(): this {
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
   */
  get isLoaded(): boolean {
    return this._loaded
  }

  /**
   * Check if there are unsaved changes
   */
  get isDirty(): boolean {
    return this._dirty
  }

  /**
   * Check if adapter supports persistence
   * Returns true if a persist function was provided
   */
  get canPersist(): boolean {
    return !!this._persistFn
  }

  /**
   * Get current configuration as object
   */
  toJSON(): RoleConfig {
    return {
      role_hierarchy: this._hierarchy,
      role_permissions: this._permissions,
      role_labels: this._labels,
    }
  }

  /**
   * Get a ready promise (resolves when loaded)
   */
  async ensureReady(): Promise<this> {
    await this._ensureLoaded()
    return this
  }
}

/**
 * Create a localStorage-backed role granter
 *
 * Unlike async sources, localStorage is synchronous so data is loaded
 * immediately at construction time. No need to call ensureReady().
 */
export function createLocalStorageRoleGranter(
  options: LocalStorageRoleGranterOptions = {}
): PersistableRoleGranterAdapter {
  const key = options.key || 'qdadm_roles'

  // Load data synchronously from localStorage (localStorage is sync)
  let initialData: RoleConfig | null = null
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
    autoLoad: false, // We load synchronously below
  })

  // Apply initial data immediately (synchronous load)
  if (initialData) {
    adapter._applyData(initialData)
  }
  adapter._loaded = true

  return adapter
}
