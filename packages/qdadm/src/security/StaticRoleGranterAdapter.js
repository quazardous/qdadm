import { RoleGranterAdapter } from './RoleGranterAdapter.js'

/**
 * StaticRoleGranterAdapter - Role granter from config object
 *
 * Default implementation for simple apps and demos.
 * Auto-created when passing role_permissions object to Kernel.
 *
 * @example
 * // Auto-created by Kernel
 * const kernel = new Kernel({
 *   security: {
 *     role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
 *     role_permissions: {
 *       ROLE_USER: ['entity:*:read'],
 *       ROLE_ADMIN: ['**']
 *     }
 *   }
 * })
 *
 * // Or explicit creation
 * const granter = new StaticRoleGranterAdapter({
 *   role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
 *   role_permissions: {
 *     ROLE_USER: ['entity:*:read'],
 *     ROLE_ADMIN: ['**']
 *   },
 *   role_labels: {
 *     ROLE_USER: 'User',
 *     ROLE_ADMIN: 'Administrator'
 *   }
 * })
 */
export class StaticRoleGranterAdapter extends RoleGranterAdapter {
  /**
   * @param {Object} config
   * @param {Object<string, string[]>} [config.role_hierarchy={}] - Role hierarchy
   * @param {Object<string, string[]>} [config.role_permissions={}] - Role permissions
   * @param {Object<string, string>} [config.role_labels={}] - Role display labels
   */
  constructor(config = {}) {
    super()
    this._hierarchy = config.role_hierarchy || {}
    this._permissions = config.role_permissions || {}
    this._labels = config.role_labels || {}
  }

  /**
   * Get permissions for a role
   * @param {string} role
   * @returns {string[]}
   */
  getPermissions(role) {
    return this._permissions[role] || []
  }

  /**
   * Get all defined roles
   * @returns {string[]}
   */
  getRoles() {
    // Combine roles from permissions and hierarchy
    const roles = new Set([
      ...Object.keys(this._permissions),
      ...Object.keys(this._hierarchy)
    ])

    // Also include inherited roles
    for (const inherits of Object.values(this._hierarchy)) {
      for (const r of inherits) {
        roles.add(r)
      }
    }

    return [...roles]
  }

  /**
   * Get role hierarchy
   * @returns {Object<string, string[]>}
   */
  getHierarchy() {
    return this._hierarchy
  }

  /**
   * Get role metadata
   * @param {string} role
   * @returns {RoleMeta|null}
   */
  getRoleMeta(role) {
    const label = this._labels[role]
    if (!label) return null
    return { label }
  }

  /**
   * Update role permissions at runtime (for testing or hot-reload)
   * @param {string} role
   * @param {string[]} permissions
   */
  setPermissions(role, permissions) {
    this._permissions[role] = permissions
  }

  /**
   * Update role hierarchy at runtime
   * @param {string} role
   * @param {string[]} inherits
   */
  setHierarchy(role, inherits) {
    this._hierarchy[role] = inherits
  }
}
