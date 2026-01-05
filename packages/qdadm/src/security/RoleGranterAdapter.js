/**
 * RoleGranterAdapter - Interface for role → permissions mapping
 *
 * The framework provides StaticRoleGranterAdapter (from config object).
 * Apps can implement custom adapters (entity-based, API-backed, etc.)
 *
 * This interface abstracts HOW roles and permissions are stored/retrieved,
 * allowing apps to use:
 * - Static config (simple apps, demos)
 * - Database/entity storage (apps with role management UI)
 * - External API (microservices architecture)
 *
 * @example
 * // Static adapter (auto-created from config)
 * security: {
 *   role_permissions: { ROLE_USER: ['entity:*:read'] }
 * }
 *
 * // Custom adapter
 * security: {
 *   roleGranter: new EntityRoleGranterAdapter({ entityName: 'roles' })
 * }
 */
export class RoleGranterAdapter {
  /**
   * Get permissions granted to a role
   *
   * @param {string} role - Role name (e.g., 'ROLE_USER')
   * @returns {string[]} Array of permission strings (may include wildcards)
   *
   * @example
   * adapter.getPermissions('ROLE_ADMIN')
   * // ['entity:**', 'admin:**']
   */
  getPermissions(role) {
    throw new Error('RoleGranterAdapter.getPermissions() must be implemented')
  }

  /**
   * Get all defined roles
   *
   * @returns {string[]} Array of role names
   *
   * @example
   * adapter.getRoles()
   * // ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN']
   */
  getRoles() {
    throw new Error('RoleGranterAdapter.getRoles() must be implemented')
  }

  /**
   * Get role hierarchy map
   *
   * @returns {Object<string, string[]>} Role → inherited roles
   *
   * @example
   * adapter.getHierarchy()
   * // { ROLE_ADMIN: ['ROLE_USER'], ROLE_SUPER_ADMIN: ['ROLE_ADMIN'] }
   */
  getHierarchy() {
    throw new Error('RoleGranterAdapter.getHierarchy() must be implemented')
  }

  /**
   * Get the role for unauthenticated users
   *
   * Always returns 'ROLE_ANONYMOUS' (convention)
   *
   * @returns {string} Anonymous role name
   */
  getAnonymousRole() {
    return 'ROLE_ANONYMOUS'
  }

  /**
   * Get role metadata (label, description)
   * Optional - for display purposes
   *
   * @param {string} role - Role name
   * @returns {RoleMeta|null}
   */
  getRoleMeta(role) {
    return null
  }

  /**
   * Install adapter (called by Kernel when context is ready)
   * Override for adapters that need initialization
   *
   * @param {Object} ctx - Kernel context
   */
  install(ctx) {
    // Override if needed
  }

  /**
   * Uninstall adapter (cleanup)
   */
  uninstall() {
    // Override if needed
  }

  /**
   * Check if adapter supports persistence (editing + saving)
   *
   * When true, the adapter supports mutations (setRolePermissions, etc.)
   * AND can persist changes. UI should show edit controls.
   *
   * When false, the adapter is read-only. UI should hide edit controls.
   *
   * @returns {boolean}
   */
  get canPersist() {
    return false
  }
}

/**
 * @typedef {Object} RoleMeta
 * @property {string} [label] - Human-readable label
 * @property {string} [description] - Description
 */
