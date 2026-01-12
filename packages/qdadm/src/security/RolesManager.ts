/**
 * RolesManager - System entity manager for roles
 *
 * Uses RoleGranterStorage as bridge to roleGranter.
 * Allows SecurityModule to use standard ctx.crud() pattern.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { EntityManager } from '../entity/EntityManager'
import { RoleGranterStorage } from './RoleGranterStorage'
import type { RoleGranterAdapter, RoleData } from './RoleGranterAdapter'
import type { PermissionRegistry } from './PermissionRegistry'
import type { IStorage, EntityRecord } from '../types'

/**
 * RoleData as EntityRecord (with id mapped to name)
 */
interface RoleRecord extends EntityRecord {
  name: string
  label: string
  permissions: string[]
  inherits: string[]
}

/**
 * Options for RolesManager
 */
export interface RolesManagerOptions {
  roleGranter?: RoleGranterAdapter | null
  permissionRegistry?: PermissionRegistry | null
  adminPermission?: string
  [key: string]: unknown
}

// Type for EntityManager base class
interface EntityManagerInstance {
  _hasSecurityChecker(): boolean
  authAdapter: {
    isGranted(permission: string): boolean
  }
}

export class RolesManager extends EntityManager<RoleRecord> {
  private _roleGranter: RoleGranterAdapter | null
  private _permissionRegistry: PermissionRegistry | null
  private _adminPermission: string

  /**
   * Protected system roles that cannot be deleted
   */
  static PROTECTED_ROLES = ['ROLE_ANONYMOUS']

  constructor(options: RolesManagerOptions = {}) {
    const {
      roleGranter = null,
      permissionRegistry = null,
      adminPermission = 'security:roles:manage',
      ...rest
    } = options

    const storage = new RoleGranterStorage(roleGranter) as unknown as IStorage<RoleRecord>

    super({
      name: 'roles',
      labelField: 'label',
      idField: 'name',
      system: true, // System-provided entity
      fields: {
        name: { type: 'text', label: 'Role Name', required: true },
        label: { type: 'text', label: 'Display Label' },
        permissions: { type: 'array', label: 'Permissions', default: [] },
        inherits: { type: 'array', label: 'Inherits From', default: [] },
      },
      storage,
      ...rest,
    })

    this._roleGranter = roleGranter
    this._permissionRegistry = permissionRegistry
    this._adminPermission = adminPermission
  }

  /**
   * Get roleGranter (for RoleForm permission picker)
   */
  get roleGranter(): RoleGranterAdapter | null {
    return this._roleGranter
  }

  /**
   * Get permission registry (for RoleForm permission picker)
   */
  get permissionRegistry(): PermissionRegistry | null {
    return this._permissionRegistry
  }

  /**
   * Get admin permission (for external registration)
   */
  get adminPermission(): string {
    return this._adminPermission
  }

  private _isAdmin(): boolean {
    const self = this as unknown as EntityManagerInstance
    if (self._hasSecurityChecker()) {
      return self.authAdapter.isGranted(this._adminPermission)
    }
    return false
  }

  canRead(): boolean {
    return this._isAdmin()
  }

  canCreate(): boolean {
    return this._isAdmin()
  }

  canUpdate(): boolean {
    return this._isAdmin()
  }

  /**
   * Check if can delete (general or row-specific)
   * Protected roles cannot be deleted even with permission
   */
  canDelete(item?: RoleRecord | null): boolean {
    if (!this._isAdmin()) return false
    if (item) {
      // Protected system roles cannot be deleted
      return !RolesManager.PROTECTED_ROLES.includes(item.name)
    }
    return true
  }
}
