/**
 * EntityAuthAdapter - Thin layer for entity-level permission checks
 *
 * Provides entity-level permission checking by delegating to SecurityChecker.
 * All methods have sensible defaults - subclass only if you need custom behavior.
 *
 * Default behavior (when SecurityChecker is configured):
 * - canPerform() → isGranted('entity:{entity}:{action}')
 * - canAccessRecord() → isGranted('entity:{entity}:read', record)
 * - getCurrentUser() → uses callback if provided, null otherwise
 *
 * Usage patterns:
 * ```js
 * // 1. Callback-based (simplest - no subclass needed)
 * const adapter = new EntityAuthAdapter({
 *   getCurrentUser: () => myAuthStore.user
 * })
 *
 * // 2. Subclass-based (for custom permission logic)
 * class MyAdapter extends EntityAuthAdapter {
 *   canPerform(entity, action) {
 *     if (['orders', 'invoices'].includes(entity) && !this.getCurrentUser()) {
 *       return false
 *     }
 *     return super.canPerform(entity, action)
 *   }
 * }
 * ```
 */
export class EntityAuthAdapter {
  /**
   * SecurityChecker instance for isGranted() delegation
   * @type {import('./SecurityChecker.js').SecurityChecker|null}
   * @private
   */
  _securityChecker = null

  /**
   * Callback to get current user (alternative to subclassing)
   * @type {Function|null}
   * @private
   */
  _getCurrentUserCallback = null

  /**
   * @param {object} [options]
   * @param {Function} [options.getCurrentUser] - Callback that returns current user or null
   */
  constructor(options = {}) {
    if (options.getCurrentUser) {
      this._getCurrentUserCallback = options.getCurrentUser
    }
  }

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
   * adapter.isGranted('entity:books:delete')  // Check permission
   * adapter.isGranted('books:delete', book)   // Check with subject
   */
  isGranted(attribute, subject = null) {
    if (!this._securityChecker) return true // Permissive if not configured
    return this._securityChecker.isGranted(attribute, subject)
  }

  /**
   * Check if current user can assign a specific role
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
   * Default: delegates to isGranted('entity:{entity}:{action}')
   * Override for custom authentication requirements or business rules.
   *
   * @param {string} entity - Entity name (e.g., 'users', 'invoices', 'products')
   * @param {string} action - Action to check: 'read', 'create', 'update', 'delete', 'list'
   * @returns {boolean} True if user can perform the action on this entity type
   */
  canPerform(entity, action) {
    return this.isGranted(`entity:${entity}:${action}`)
  }

  /**
   * Check if the current user can access a specific record (silo check)
   *
   * Default: delegates to isGranted('entity:{entity}:read', record)
   * Note: Ownership checks are typically handled via EntityManager's isOwn callback.
   *
   * @param {string} entity - Entity name (e.g., 'users', 'invoices')
   * @param {object} record - The full entity record to check access for
   * @returns {boolean} True if user can access this specific record
   */
  canAccessRecord(entity, record) {
    return this.isGranted(`entity:${entity}:read`, record)
  }

  /**
   * Get the current authenticated user
   *
   * Returns user from:
   * 1. _getCurrentUserCallback if provided in constructor
   * 2. Subclass override if using class extension pattern
   * 3. null if neither is configured
   *
   * Note: SecurityChecker calls this method, so it cannot delegate back to SecurityChecker.
   *
   * @returns {object|null} Current user object or null if not authenticated
   */
  getCurrentUser() {
    if (this._getCurrentUserCallback) {
      return this._getCurrentUserCallback()
    }
    // Subclasses can override this method
    return null
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
