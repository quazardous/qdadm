/**
 * EntityAuthAdapter - Interface for entity-level permission checks
 *
 * Applications implement this interface to plug their authorization
 * system into qdadm's EntityManager. The adapter provides two levels of permission checks:
 *
 * 1. **Scopes** (action-level): Can the user perform this action on this entity type?
 *    Example: Can user create invoices? Can user delete users?
 *
 * 2. **Silos** (record-level): Can the user access this specific record?
 *    Example: Can user see invoice #123? (ownership, team membership, etc.)
 *
 * Note: For user session authentication (login/logout), see SessionAuthAdapter.
 *
 * Usage:
 * ```js
 * class MyEntityAuthAdapter extends EntityAuthAdapter {
 *   canPerform(entity, action) {
 *     const user = this.getCurrentUser()
 *     return user?.permissions?.includes(`${entity}:${action}`)
 *   }
 *
 *   canAccessRecord(entity, record) {
 *     const user = this.getCurrentUser()
 *     return record.owner_id === user?.id || record.team_id === user?.team_id
 *   }
 *
 *   getCurrentUser() {
 *     return this._userStore.currentUser
 *   }
 * }
 * ```
 *
 * @interface
 */
export class EntityAuthAdapter {
  /**
   * SecurityChecker instance for isGranted() delegation
   * @type {import('./SecurityChecker.js').SecurityChecker|null}
   * @private
   */
  _securityChecker = null

  /**
   * Set the SecurityChecker instance for isGranted() delegation
   *
   * @param {import('./SecurityChecker.js').SecurityChecker} checker
   */
  setSecurityChecker(checker) {
    this._securityChecker = checker
  }

  /**
   * Check if current user is granted an attribute (Symfony-like contract)
   *
   * This is the unified permission check method. It delegates to SecurityChecker
   * if one is configured, otherwise returns true (permissive fallback).
   *
   * @param {string} attribute - Role (ROLE_*) or permission (entity:action)
   * @param {object} [subject] - Optional subject for context-aware checks
   * @returns {boolean} True if user is granted the attribute
   *
   * @example
   * adapter.isGranted('ROLE_ADMIN')           // Check role
   * adapter.isGranted('entity:delete')        // Check permission
   * adapter.isGranted('books:delete', book)   // Check with subject
   */
  isGranted(attribute, subject = null) {
    if (!this._securityChecker) return true // Permissive if not configured
    return this._securityChecker.isGranted(attribute, subject)
  }

  /**
   * Check if current user can assign a specific role
   *
   * Uses SecurityChecker's canAssignRole if available.
   *
   * @param {string} targetRole - Role to assign
   * @returns {boolean} True if user can assign this role
   */
  canAssignRole(targetRole) {
    if (!this._securityChecker) return true
    return this._securityChecker.canAssignRole(targetRole)
  }

  /**
   * Get all roles that current user can assign
   *
   * @returns {string[]} Array of assignable role names
   */
  getAssignableRoles() {
    if (!this._securityChecker) return []
    return this._securityChecker.getAssignableRoles()
  }

  /**
   * Check if the current user can perform an action on an entity type (scope check)
   *
   * This is the coarse-grained permission check. It determines if the user has
   * the right to perform a category of actions, regardless of which specific
   * record they want to act on.
   *
   * @param {string} entity - Entity name (e.g., 'users', 'invoices', 'products')
   * @param {string} action - Action to check: 'read', 'create', 'update', 'delete', 'list'
   * @returns {boolean} True if user can perform the action on this entity type
   *
   * @example
   * adapter.canPerform('invoices', 'create') // true/false
   * adapter.canPerform('users', 'delete') // true/false
   */
  canPerform(entity, action) {
    throw new Error('[EntityAuthAdapter] canPerform() must be implemented by subclass')
  }

  /**
   * Check if the current user can access a specific record (silo check)
   *
   * This is the fine-grained permission check. After the scope check passes,
   * this determines if the user can access a particular record based on
   * ownership, team membership, or other business rules.
   *
   * @param {string} entity - Entity name (e.g., 'users', 'invoices')
   * @param {object} record - The full entity record to check access for
   * @returns {boolean} True if user can access this specific record
   *
   * @example
   * adapter.canAccessRecord('invoices', { id: 123, owner_id: 456, ... })
   */
  canAccessRecord(entity, record) {
    throw new Error('[EntityAuthAdapter] canAccessRecord() must be implemented by subclass')
  }

  /**
   * Get the current authenticated user
   *
   * Returns the user object or null if not authenticated. The user object
   * should contain whatever information is needed for permission checks.
   *
   * @returns {object|null} Current user object or null if not authenticated
   */
  getCurrentUser() {
    throw new Error('[EntityAuthAdapter] getCurrentUser() must be implemented by subclass')
  }
}

/**
 * Valid action types for scope checks
 * @readonly
 * @enum {string}
 */
export const AuthActions = Object.freeze({
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list'
})
