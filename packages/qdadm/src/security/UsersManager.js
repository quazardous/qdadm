/**
 * UsersManager - System entity manager for users
 *
 * Provides standard user entity with:
 * - username, password, role fields
 * - role linked to roles entity via reference
 * - Admin-only access by default (customizable)
 *
 * @example
 * // In a module:
 * ctx.userEntity({
 *   storage: new ApiStorage({ endpoint: '/api/users' }),
 *   extraFields: {
 *     email: { type: 'email', label: 'Email' }
 *   }
 * })
 */

import { EntityManager } from '../entity/EntityManager.js'

export class UsersManager extends EntityManager {
  /**
   * @param {Object} options
   * @param {Object} options.storage - Storage adapter (required)
   * @param {Object} [options.extraFields={}] - Additional fields beyond username/password/role
   * @param {string} [options.adminRole='ROLE_ADMIN'] - Role required for user management
   * @param {boolean} [options.adminOnly=true] - Restrict access to admin role only
   * @param {Object} [options.fieldOverrides={}] - Override default field configs
   */
  constructor(options = {}) {
    const {
      storage,
      extraFields = {},
      adminPermission = 'security:users:manage',
      fieldOverrides = {},
      ...rest
    } = options

    if (!storage) {
      throw new Error('[UsersManager] storage is required')
    }

    // Default fields for users
    const defaultFields = {
      username: {
        type: 'text',
        label: 'Username',
        required: true,
        default: '',
        ...fieldOverrides.username
      },
      password: {
        type: 'password',
        label: 'Password',
        required: true,
        default: '',
        listable: false,  // Don't show in list view
        ...fieldOverrides.password
      },
      role: {
        type: 'select',
        label: 'Role',
        reference: { entity: 'roles' },  // Links to roles entity
        default: 'ROLE_USER',
        ...fieldOverrides.role
      }
    }

    super({
      name: 'users',
      labelField: 'username',
      system: true,  // System-provided entity
      fields: {
        ...defaultFields,
        ...extraFields
      },
      storage,
      ...rest
    })

    this._adminPermission = adminPermission
  }

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
    return this._isAdmin();
  }

  canCreate() {
    // little dumb but should work for simple storages
    return this._isAdmin();
  }

  canUpdate() {
    // little dumb but should work for simple storages
    return this._isAdmin();
  }

  canDelete() {
    // little dumb but should work for simple storages
    return this._isAdmin();
  }

}
