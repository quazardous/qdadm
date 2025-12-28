/**
 * PermissiveAuthAdapter - Default adapter that allows all operations
 *
 * This adapter is used when no custom AuthAdapter is provided to EntityManager.
 * It returns `true` for all permission checks, effectively disabling authorization.
 *
 * Use cases:
 * - Development/prototyping without auth setup
 * - Backward compatibility with existing apps that don't use auth
 * - Internal admin tools with implicit trust
 * - Testing environments
 *
 * @example
 * // Explicit usage (rarely needed)
 * const adapter = new PermissiveAuthAdapter()
 *
 * adapter.canPerform('users', 'delete') // true
 * adapter.canAccessRecord('invoices', { id: 123, secret: true }) // true
 * adapter.getCurrentUser() // null
 *
 * @extends AuthAdapter
 */
import { AuthAdapter } from './AuthAdapter.js'

export class PermissiveAuthAdapter extends AuthAdapter {
  /**
   * Always allows any action on any entity type
   *
   * @param {string} entity - Entity name (ignored)
   * @param {string} action - Action to check (ignored)
   * @returns {boolean} Always returns true
   */
  canPerform(entity, action) {
    return true
  }

  /**
   * Always allows access to any record
   *
   * @param {string} entity - Entity name (ignored)
   * @param {object} record - The record (ignored)
   * @returns {boolean} Always returns true
   */
  canAccessRecord(entity, record) {
    return true
  }

  /**
   * Returns null (no authenticated user in permissive mode)
   *
   * @returns {null} Always returns null
   */
  getCurrentUser() {
    return null
  }
}

/**
 * Factory function to create a PermissiveAuthAdapter
 * @returns {PermissiveAuthAdapter}
 */
export function createPermissiveAdapter() {
  return new PermissiveAuthAdapter()
}
