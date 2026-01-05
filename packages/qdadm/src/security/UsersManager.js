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
      adminRole = 'ROLE_ADMIN',
      adminOnly = true,
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

    this._adminRole = adminRole
    this._adminOnly = adminOnly
  }

  /**
   * Check if current user has admin role
   * @returns {boolean}
   * @private
   */
  _isAdmin() {
    const user = this.authAdapter?.getCurrentUser?.()
    if (!user) return false

    // Check role directly or in roles array
    const userRole = user.role || user.roles?.[0]
    if (!userRole) return false

    // Normalize to uppercase with ROLE_ prefix
    const normalized = userRole.toUpperCase()
    const roleToCheck = normalized.startsWith('ROLE_') ? normalized : `ROLE_${normalized}`

    return roleToCheck === this._adminRole
  }

  // Permission checks - admin only by default
  canRead() {
    return this._adminOnly ? this._isAdmin() : true
  }

  canCreate() {
    return this._adminOnly ? this._isAdmin() : true
  }

  canUpdate() {
    return this._adminOnly ? this._isAdmin() : true
  }

  canDelete() {
    return this._adminOnly ? this._isAdmin() : true
  }
}
