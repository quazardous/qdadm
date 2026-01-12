/**
 * RoleGranterStorage - Storage bridge for roleGranter
 *
 * Implements Storage interface and delegates to roleGranter.
 * Allows RolesManager to use standard EntityManager patterns.
 */

import type { StorageCapabilities } from '../types'
import type { RoleGranterAdapter, RoleData } from './RoleGranterAdapter'

/**
 * List parameters for role listing
 */
export interface RoleListParams {
  search?: string
  [key: string]: unknown
}

/**
 * List result for roles
 */
export interface RoleListResult {
  items: RoleData[]
  total: number
}

/**
 * Role data for create/update operations
 */
export interface RoleInput {
  name: string
  label?: string
  permissions?: string[]
  inherits?: string[]
}

/**
 * Extended RoleGranterAdapter with optional mutation methods
 */
interface MutableRoleGranterAdapter extends RoleGranterAdapter {
  ensureReady?(): Promise<void>
  getLabels?(): Record<string, string>
  getRole?(name: string): RoleData | null
  createRole?(
    name: string,
    options: { label?: string; permissions?: string[]; inherits?: string[] }
  ): Promise<RoleData>
  updateRole?(
    name: string,
    options: { label?: string; permissions?: string[]; inherits?: string[] }
  ): Promise<RoleData>
  deleteRole?(name: string): Promise<void>
}

export class RoleGranterStorage {
  /**
   * Storage name for debug display (survives minification)
   */
  static storageName = 'RoleGranterStorage'

  /**
   * Static capabilities (standard storage pattern)
   */
  static capabilities: StorageCapabilities = {
    supportsTotal: true,
    supportsFilters: false,
    supportsPagination: false,
    supportsCaching: false, // In-memory via roleGranter, no need for EntityManager cache
  }

  private _roleGranter: MutableRoleGranterAdapter | null

  constructor(roleGranter: RoleGranterAdapter | null) {
    this._roleGranter = roleGranter as MutableRoleGranterAdapter | null
  }

  /**
   * Instance capabilities (merge static + dynamic)
   *
   * Dynamic properties:
   * - requiresAuth: false (roles are system data)
   * - readOnly: based on roleGranter.canPersist
   */
  get capabilities(): StorageCapabilities & { requiresAuth: boolean; readOnly: boolean } {
    return {
      ...RoleGranterStorage.capabilities,
      requiresAuth: false,
      readOnly: !this._roleGranter?.canPersist,
    }
  }

  /**
   * List all roles
   */
  async list(params: RoleListParams = {}): Promise<RoleListResult> {
    if (!this._roleGranter) {
      return { items: [], total: 0 }
    }

    // Ensure loaded for adapters that need it
    if (this._roleGranter.ensureReady) {
      await this._roleGranter.ensureReady()
    }

    const roleNames = this._roleGranter.getRoles()
    const roles = roleNames.map((name) => this._getRole(name)).filter((r): r is RoleData => r !== null)

    // Simple search filter
    let filtered = roles
    if (params.search) {
      const search = params.search.toLowerCase()
      filtered = roles.filter(
        (r) => r.name.toLowerCase().includes(search) || r.label?.toLowerCase().includes(search)
      )
    }

    return {
      items: filtered,
      total: filtered.length,
    }
  }

  /**
   * Get a single role by name
   */
  async get(name: string): Promise<RoleData | null> {
    if (!this._roleGranter) return null

    if (this._roleGranter.ensureReady) {
      await this._roleGranter.ensureReady()
    }

    return this._getRole(name)
  }

  /**
   * Get many roles by names
   */
  async getMany(names: string[]): Promise<RoleData[]> {
    if (!this._roleGranter) return []

    if (this._roleGranter.ensureReady) {
      await this._roleGranter.ensureReady()
    }

    return names.map((name) => this._getRole(name)).filter((r): r is RoleData => r !== null)
  }

  /**
   * Create a new role
   */
  async create(data: RoleInput): Promise<RoleData> {
    if (!this._roleGranter?.createRole) {
      throw new Error('Role creation not supported by this adapter')
    }
    return this._roleGranter.createRole(data.name, {
      label: data.label,
      permissions: data.permissions || [],
      inherits: data.inherits || [],
    })
  }

  /**
   * Update an existing role
   */
  async update(name: string, data: Partial<RoleInput>): Promise<RoleData> {
    if (!this._roleGranter?.updateRole) {
      throw new Error('Role update not supported by this adapter')
    }
    return this._roleGranter.updateRole(name, {
      label: data.label,
      permissions: data.permissions,
      inherits: data.inherits,
    })
  }

  /**
   * Patch a role (partial update)
   */
  async patch(name: string, data: Partial<RoleInput>): Promise<RoleData> {
    return this.update(name, data)
  }

  /**
   * Delete a role
   */
  async delete(name: string): Promise<void> {
    if (!this._roleGranter?.deleteRole) {
      throw new Error('Role deletion not supported by this adapter')
    }
    return this._roleGranter.deleteRole(name)
  }

  /**
   * Get role object from roleGranter
   */
  private _getRole(name: string): RoleData | null {
    if (!this._roleGranter) return null

    if (this._roleGranter.getRole) {
      return this._roleGranter.getRole(name)
    }
    // Fallback for adapters without getRole
    return {
      name,
      label: this._roleGranter.getLabels?.()[name] || name,
      permissions: this._roleGranter.getPermissions(name),
      inherits: this._roleGranter.getHierarchy()[name] || [],
    }
  }
}
