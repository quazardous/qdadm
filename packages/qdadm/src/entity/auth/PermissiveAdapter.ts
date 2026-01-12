/**
 * PermissiveAuthAdapter - Default adapter that allows all operations
 *
 * This adapter is used when no custom EntityAuthAdapter is provided to EntityManager.
 * It returns `true` for all permission checks, effectively disabling authorization.
 *
 * Use cases:
 * - Development/prototyping without auth setup
 * - Backward compatibility with existing apps that don't use auth
 * - Internal admin tools with implicit trust
 * - Testing environments
 */
import { EntityAuthAdapter, type AuthUser } from './EntityAuthAdapter'

export class PermissiveAuthAdapter extends EntityAuthAdapter {
  /**
   * Always allows any action on any entity type
   */
  canPerform(_entity: string, _action: string): boolean {
    return true
  }

  /**
   * Always allows access to any record
   */
  canAccessRecord(_entity: string, _record: unknown): boolean {
    return true
  }

  /**
   * Returns null (no authenticated user in permissive mode)
   */
  getCurrentUser(): AuthUser | null {
    return null
  }
}

/**
 * Factory function to create a PermissiveAuthAdapter
 */
export function createPermissiveAdapter(): PermissiveAuthAdapter {
  return new PermissiveAuthAdapter()
}
