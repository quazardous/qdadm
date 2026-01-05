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
   */
  constructor(options = {}) {
    const storage = new RoleGranterStorage(options.roleGranter)

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
      storage
    })

    this._roleGranter = options.roleGranter
    this._permissionRegistry = options.permissionRegistry
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
   * Check if roles can be edited
   */
  get canPersist() {
    return this._roleGranter?.canPersist ?? false
  }

  /**
   * Protected system roles that cannot be deleted
   */
  static PROTECTED_ROLES = ['ROLE_ANONYMOUS']

  // Permission checks based on canPersist
  canCreate() { return this.canPersist }
  canUpdate() { return this.canPersist }

  /**
   * Check if can delete (general or row-specific)
   * @param {object} [item] - Optional role to check
   * @returns {boolean}
   */
  canDelete(item) {
    if (!this.canPersist) return false
    if (item) {
      // Protected system roles cannot be deleted
      return !RolesManager.PROTECTED_ROLES.includes(item.name)
    }
    return true
  }
}
