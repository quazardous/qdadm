import { RoleHierarchy } from './RoleHierarchy.js'

/**
 * SecurityChecker - Symfony-inspired permission checking
 *
 * Provides the `isGranted(attribute, subject?)` contract for checking permissions.
 * Supports both role checks (ROLE_*) and permission checks (entity:action).
 *
 * Note: Symfony's full security system includes "voters" for custom business logic
 * (e.g., "owner can edit their own posts"). This implementation focuses on
 * role hierarchy + declarative permissions. For complex rules, override
 * EntityManager.canRead/canWrite methods directly.
 *
 * @example
 * ```js
 * const checker = new SecurityChecker({
 *   roleHierarchy: new RoleHierarchy({ ROLE_ADMIN: ['ROLE_USER'] }),
 *   rolePermissions: {
 *     ROLE_USER: ['entity:read', 'entity:list'],
 *     ROLE_ADMIN: ['entity:create', 'entity:update', 'entity:delete'],
 *   },
 *   getCurrentUser: () => authStore.user
 * })
 *
 * checker.isGranted('ROLE_ADMIN')           // Check role
 * checker.isGranted('entity:delete')        // Check permission
 * checker.isGranted('books:delete', book)   // Check with subject
 * ```
 */
export class SecurityChecker {
  /**
   * @param {Object} options
   * @param {RoleHierarchy} options.roleHierarchy - Role hierarchy instance
   * @param {Object<string, string[]>} options.rolePermissions - Permissions per role
   * @param {Function} options.getCurrentUser - Function returning current user or null
   */
  constructor({ roleHierarchy, rolePermissions = {}, getCurrentUser }) {
    this.roleHierarchy = roleHierarchy instanceof RoleHierarchy
      ? roleHierarchy
      : new RoleHierarchy(roleHierarchy || {})
    this.rolePermissions = rolePermissions
    this.getCurrentUser = getCurrentUser
  }

  /**
   * Check if current user is granted an attribute (role or permission)
   *
   * This is the main contract method, similar to Symfony's isGranted().
   *
   * Checking flow:
   * 1. If attribute starts with 'ROLE_' → check role hierarchy
   * 2. Check if user has the permission (from role or direct)
   *
   * @param {string} attribute - Role (ROLE_*) or permission (entity:action)
   * @param {object} [subject] - Optional subject for context-aware checks (reserved for future use)
   * @returns {boolean} True if user is granted the attribute
   *
   * @example
   * checker.isGranted('ROLE_ADMIN')           // true/false
   * checker.isGranted('entity:delete')        // true/false
   * checker.isGranted('books:delete', book)   // true/false (with subject)
   */
  isGranted(attribute, subject = null) {
    const user = this.getCurrentUser()
    if (!user) return false

    // 1. Check if it's a role (ROLE_*)
    if (attribute.startsWith('ROLE_')) {
      return this.roleHierarchy.isGrantedRole(
        user.roles || [user.role],
        attribute
      )
    }

    // 2. Check if it's a permission
    const userPerms = this.getUserPermissions(user)
    if (userPerms.includes('*')) return true
    if (userPerms.includes(attribute)) return true

    return false
  }

  /**
   * Get all permissions for a user (resolved from roles + user overrides)
   *
   * Resolves permissions by:
   * 1. Getting all reachable roles from role hierarchy
   * 2. Collecting permissions from each role
   * 3. Adding any user-specific permission overrides
   *
   * @param {object} user - User object with role/roles and optional permissions
   * @returns {string[]} Array of all permissions
   */
  getUserPermissions(user) {
    const roles = user.roles || [user.role]
    const perms = new Set()

    for (const role of roles) {
      if (!role) continue
      const reachable = this.roleHierarchy.getReachableRoles(role)
      for (const r of reachable) {
        const rolePerms = this.rolePermissions[r] || []
        rolePerms.forEach(p => perms.add(p))
      }
    }

    // User-specific permission overrides
    if (user.permissions && Array.isArray(user.permissions)) {
      user.permissions.forEach(p => perms.add(p))
    }

    return [...perms]
  }

  /**
   * Check if user can assign a role to another user
   *
   * Rule: Can only assign roles if user has 'role:assign' permission
   * AND has the target role (or higher) themselves.
   *
   * @param {string} targetRole - Role to assign
   * @returns {boolean} True if user can assign this role
   */
  canAssignRole(targetRole) {
    return this.isGranted('role:assign') && this.isGranted(targetRole)
  }

  /**
   * Get all roles that current user can assign
   *
   * @returns {string[]} Array of assignable role names
   */
  getAssignableRoles() {
    if (!this.isGranted('role:assign')) return []

    const user = this.getCurrentUser()
    if (!user) return []

    const userRoles = user.roles || [user.role]
    const assignable = new Set()

    for (const role of userRoles) {
      if (!role) continue
      const reachable = this.roleHierarchy.getReachableRoles(role)
      reachable.forEach(r => assignable.add(r))
    }

    return [...assignable]
  }
}

/**
 * Create a SecurityChecker instance from config
 *
 * @param {Object} config
 * @param {Object<string, string[]>} config.role_hierarchy - Role hierarchy config
 * @param {Object<string, string[]>} config.role_permissions - Permissions per role
 * @param {Function} config.getCurrentUser - User getter function
 * @returns {SecurityChecker}
 */
export function createSecurityChecker(config) {
  return new SecurityChecker({
    roleHierarchy: new RoleHierarchy(config.role_hierarchy || {}),
    rolePermissions: config.role_permissions || {},
    getCurrentUser: config.getCurrentUser
  })
}
