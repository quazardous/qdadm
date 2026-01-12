/**
 * RoleProviderStorage - Storage bridge for rolesProvider
 *
 * Implements Storage interface and delegates to rolesProvider.
 * Allows RolesManager to use standard EntityManager patterns.
 */

import type { StorageCapabilities } from '../types'
import type { RoleProvider, RoleData } from './RolesProvider'

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
 * Extended RoleProvider with optional mutation methods
 */
interface MutableRoleProvider extends RoleProvider {
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

export class RoleProviderStorage {
  /**
   * Storage name for debug display (survives minification)
   */
  static storageName = 'RoleProviderStorage'

  /**
   * Static capabilities (standard storage pattern)
   */
  static capabilities: StorageCapabilities = {
    supportsTotal: true,
    supportsFilters: false,
    supportsPagination: false,
    supportsCaching: false, // In-memory via rolesProvider, no need for EntityManager cache
  }

  private _rolesProvider: MutableRoleProvider | null

  constructor(rolesProvider: RoleProvider | null) {
    this._rolesProvider = rolesProvider as MutableRoleProvider | null
  }

  /**
   * Instance capabilities (merge static + dynamic)
   *
   * Dynamic properties:
   * - requiresAuth: false (roles are system data)
   * - readOnly: based on rolesProvider.canPersist
   */
  get capabilities(): StorageCapabilities & { requiresAuth: boolean; readOnly: boolean } {
    return {
      ...RoleProviderStorage.capabilities,
      requiresAuth: false,
      readOnly: !this._rolesProvider?.canPersist,
    }
  }

  /**
   * List all roles
   */
  async list(params: RoleListParams = {}): Promise<RoleListResult> {
    if (!this._rolesProvider) {
      return { items: [], total: 0 }
    }

    // Ensure loaded for adapters that need it
    if (this._rolesProvider.ensureReady) {
      await this._rolesProvider.ensureReady()
    }

    const roleNames = this._rolesProvider.getRoles()
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
    if (!this._rolesProvider) return null

    if (this._rolesProvider.ensureReady) {
      await this._rolesProvider.ensureReady()
    }

    return this._getRole(name)
  }

  /**
   * Get many roles by names
   */
  async getMany(names: string[]): Promise<RoleData[]> {
    if (!this._rolesProvider) return []

    if (this._rolesProvider.ensureReady) {
      await this._rolesProvider.ensureReady()
    }

    return names.map((name) => this._getRole(name)).filter((r): r is RoleData => r !== null)
  }

  /**
   * Create a new role
   */
  async create(data: RoleInput): Promise<RoleData> {
    if (!this._rolesProvider?.createRole) {
      throw new Error('Role creation not supported by this adapter')
    }
    return this._rolesProvider.createRole(data.name, {
      label: data.label,
      permissions: data.permissions || [],
      inherits: data.inherits || [],
    })
  }

  /**
   * Update an existing role
   */
  async update(name: string, data: Partial<RoleInput>): Promise<RoleData> {
    if (!this._rolesProvider?.updateRole) {
      throw new Error('Role update not supported by this adapter')
    }
    return this._rolesProvider.updateRole(name, {
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
    if (!this._rolesProvider?.deleteRole) {
      throw new Error('Role deletion not supported by this adapter')
    }
    return this._rolesProvider.deleteRole(name)
  }

  /**
   * Get role object from rolesProvider
   */
  private _getRole(name: string): RoleData | null {
    if (!this._rolesProvider) return null

    if (this._rolesProvider.getRole) {
      return this._rolesProvider.getRole(name)
    }
    // Fallback for adapters without getRole
    return {
      name,
      label: this._rolesProvider.getLabels?.()[name] || name,
      permissions: this._rolesProvider.getPermissions(name),
      inherits: this._rolesProvider.getHierarchy()[name] || [],
    }
  }
}
