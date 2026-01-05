import { RoleHierarchy } from './RoleHierarchy.js'
import { PermissionMatcher } from '../../security/PermissionMatcher.js'
import { StaticRoleGranterAdapter } from '../../security/StaticRoleGranterAdapter.js'

/**
 * SecurityChecker - Symfony-inspired permission checking
 *
 * Provides the `isGranted(attribute, subject?)` contract for checking permissions.
 * Supports both role checks (ROLE_*) and permission checks with wildcards.
 *
 * Permission format: namespace:target:action
 * - entity:books:read     - Entity CRUD
 * - auth:impersonate      - System feature
 * - admin:config:edit     - Admin feature
 *
 * Wildcard patterns (like signals):
 * - `*` matches exactly one segment
 * - `**` matches zero or more segments (greedy)
 *
 * @example
 * const checker = new SecurityChecker({
 *   roleGranter: new StaticRoleGranterAdapter({
 *     role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
 *     role_permissions: {
 *       ROLE_USER: ['entity:*:read', 'entity:*:list'],
 *       ROLE_ADMIN: ['entity:**', 'admin:**']
 *     }
 *   }),
 *   getCurrentUser: () => authStore.user
 * })
 *
 * checker.isGranted('ROLE_ADMIN')              // Check role
 * checker.isGranted('entity:books:read')       // Check permission
 * checker.isGranted('entity:books:delete')     // Matches 'entity:**' for ADMIN
 */
export class SecurityChecker {
  /**
   * @param {Object} options
   * @param {RoleGranterAdapter} [options.roleGranter] - Role granter adapter
   * @param {RoleHierarchy} [options.roleHierarchy] - Role hierarchy (legacy, prefer roleGranter)
   * @param {Object<string, string[]>} [options.rolePermissions] - Permissions per role (legacy)
   * @param {Function} options.getCurrentUser - Function returning current user or null
   */
  constructor({ roleGranter, roleHierarchy, rolePermissions, getCurrentUser }) {
    // Support both new roleGranter and legacy rolePermissions
    if (roleGranter) {
      this._roleGranter = roleGranter
      // Note: roleHierarchy is now a getter that reads dynamically from roleGranter
      // This ensures hierarchy changes after async load() are reflected
      this._legacyRoleHierarchy = null
    } else {
      // Legacy: create static granter from rolePermissions
      this._roleGranter = new StaticRoleGranterAdapter({
        role_hierarchy: roleHierarchy instanceof RoleHierarchy
          ? {} // Can't extract map from RoleHierarchy, use empty
          : (roleHierarchy || {}),
        role_permissions: rolePermissions || {}
      })
      this._legacyRoleHierarchy = roleHierarchy instanceof RoleHierarchy
        ? roleHierarchy
        : new RoleHierarchy(roleHierarchy || {})
    }

    this.getCurrentUser = getCurrentUser
  }

  /**
   * Get role hierarchy (dynamically resolved from roleGranter)
   *
   * This is a getter instead of a cached property to ensure that
   * hierarchy changes after async load() are reflected immediately.
   *
   * @returns {RoleHierarchy}
   */
  get roleHierarchy() {
    // Legacy mode: use cached hierarchy
    if (this._legacyRoleHierarchy) {
      return this._legacyRoleHierarchy
    }
    // Dynamic mode: create fresh RoleHierarchy from current granter state
    return new RoleHierarchy(this._roleGranter.getHierarchy())
  }

  /**
   * Get role granter adapter
   * @returns {RoleGranterAdapter}
   */
  get roleGranter() {
    return this._roleGranter
  }

  /**
   * Get role permissions (for backward compatibility / debug panel)
   * @returns {Object<string, string[]>}
   */
  get rolePermissions() {
    const roles = this._roleGranter.getRoles()
    const perms = {}
    for (const role of roles) {
      perms[role] = this._roleGranter.getPermissions(role)
    }
    return perms
  }

  /**
   * Check if current user is granted an attribute (role or permission)
   *
   * This is the main contract method, similar to Symfony's isGranted().
   *
   * Checking flow:
   * 1. If attribute starts with 'ROLE_' → check role hierarchy
   * 2. Check if user has the permission (with wildcard support)
   *
   * @param {string} attribute - Role (ROLE_*) or permission (namespace:target:action)
   * @param {object} [subject] - Optional subject for context-aware checks (reserved for future use)
   * @returns {boolean} True if user is granted the attribute
   *
   * @example
   * checker.isGranted('ROLE_ADMIN')              // true/false
   * checker.isGranted('entity:books:read')       // true/false
   * checker.isGranted('entity:books:delete', book)  // true/false (with subject)
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

    // 2. Check if it's a permission (with wildcard support)
    const userPerms = this.getUserPermissions(user)
    return PermissionMatcher.any(userPerms, attribute)
  }

  /**
   * Get all permissions for a user (resolved from roles + user overrides)
   *
   * Resolves permissions by:
   * 1. Getting all reachable roles from role hierarchy
   * 2. Collecting permissions from each role via roleGranter
   * 3. Adding any user-specific permission overrides
   *
   * @param {object} user - User object with role/roles and optional permissions
   * @returns {string[]} Array of all permissions (may include wildcards)
   */
  getUserPermissions(user) {
    const roles = user.roles || [user.role]
    const perms = new Set()

    for (const role of roles) {
      if (!role) continue
      const reachable = this.roleHierarchy.getReachableRoles(role)
      for (const r of reachable) {
        const rolePerms = this._roleGranter.getPermissions(r)
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
   * Rule: Can only assign roles if user has 'security:roles:assign' permission
   * AND has the target role (or higher) themselves.
   *
   * @param {string} targetRole - Role to assign
   * @returns {boolean} True if user can assign this role
   */
  canAssignRole(targetRole) {
    return this.isGranted('security:roles:assign') && this.isGranted(targetRole)
  }

  /**
   * Get all roles that current user can assign
   *
   * @returns {string[]} Array of assignable role names
   */
  getAssignableRoles() {
    if (!this.isGranted('security:roles:assign')) return []

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
 * @param {RoleGranterAdapter} [config.roleGranter] - Role granter adapter
 * @param {Object<string, string[]>} [config.role_hierarchy] - Role hierarchy config (legacy)
 * @param {Object<string, string[]>} [config.role_permissions] - Permissions per role (legacy)
 * @param {Function} config.getCurrentUser - User getter function
 * @returns {SecurityChecker}
 */
export function createSecurityChecker(config) {
  if (config.roleGranter) {
    return new SecurityChecker({
      roleGranter: config.roleGranter,
      getCurrentUser: config.getCurrentUser
    })
  }

  // Legacy config: auto-create static granter
  return new SecurityChecker({
    roleGranter: new StaticRoleGranterAdapter({
      role_hierarchy: config.role_hierarchy || {},
      role_permissions: config.role_permissions || {}
    }),
    getCurrentUser: config.getCurrentUser
  })
}
