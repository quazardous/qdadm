/**
 * RolesManager - System entity manager for roles
 *
 * Uses RoleGranterStorage as bridge to roleGranter.
 * Allows SecurityModule to use standard ctx.crud() pattern.
 */

import { EntityManager } from '../entity/EntityManager.js'
import { RoleGranterStorage } from './RoleGranterStorage.js'

export class RolesManager extends EntityManager {
  /**
   * @param {Object} options
   * @param {import('./RoleGranterAdapter.js').RoleGranterAdapter} options.roleGranter
   * @param {import('./PermissionRegistry.js').PermissionRegistry} options.permissionRegistry
   * @param {string} [options.adminPermission='security:roles:manage'] - Permission required for role management
   */
  constructor(options = {}) {
    const {
      roleGranter,
      permissionRegistry,
      adminPermission = 'security:roles:manage',
      ...rest
    } = options

    const storage = new RoleGranterStorage(roleGranter)

    super({
      name: 'roles',
      labelField: 'label',
      idField: 'name',
      system: true,  // System-provided entity
      fields: {
        name: { type: 'text', label: 'Role Name', required: true },
        label: { type: 'text', label: 'Display Label' },
        permissions: { type: 'array', label: 'Permissions', default: [] },
        inherits: { type: 'array', label: 'Inherits From', default: [] }
      },
      storage,
      ...rest
    })

    this._roleGranter = roleGranter
    this._permissionRegistry = permissionRegistry
    this._adminPermission = adminPermission
  }

  /**
   * Get roleGranter (for RoleForm permission picker)
   */
  get roleGranter() {
    return this._roleGranter
  }

  /**
   * Get permission registry (for RoleForm permission picker)
   */
  get permissionRegistry() {
    return this._permissionRegistry
  }

  /**
   * Protected system roles that cannot be deleted
   */
  static PROTECTED_ROLES = ['ROLE_ANONYMOUS']

  /**
   * Get admin permission (for external registration)
   */
  get adminPermission() {
    return this._adminPermission
  }

  _isAdmin() {
    if (this._hasSecurityChecker()) {
      return this.authAdapter.isGranted(this._adminPermission)
    }
    return false
  }

  canRead() {
    return this._isAdmin()
  }

  canCreate() {
    return this._isAdmin()
  }

  canUpdate() {
    return this._isAdmin()
  }

  /**
   * Check if can delete (general or row-specific)
   * Protected roles cannot be deleted even with permission
   * @param {object} [item] - Optional role to check
   * @returns {boolean}
   */
  canDelete(item) {
    if (!this._isAdmin()) return false
    if (item) {
      // Protected system roles cannot be deleted
      return !RolesManager.PROTECTED_ROLES.includes(item.name)
    }
    return true
  }
}
