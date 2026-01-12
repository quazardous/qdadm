/**
 * RoleProvider - Interface for role → permissions mapping
 *
 * The framework provides StaticRoleProvider (from config object).
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
 *   rolesProvider: new EntityRoleProvider({ entityName: 'roles' })
 * }
 */

/**
 * Role metadata for display purposes
 */
export interface RoleMeta {
  label?: string
  description?: string
}

/**
 * Complete role data object
 *
 * Note: `id` is optional and maps to `name` for EntityManager compatibility
 * when using idField: 'name'
 */
export interface RoleData {
  name: string
  label: string
  permissions: string[]
  inherits: string[]
  /** Virtual id field (equals name) for EntityRecord compatibility */
  id?: string
}

/**
 * Role hierarchy mapping
 */
export type RoleHierarchyMap = Record<string, string[]>

/**
 * Role permissions mapping
 */
export type RolePermissionsMap = Record<string, string[]>

/**
 * Role labels mapping
 */
export type RoleLabelsMap = Record<string, string>

/**
 * Kernel context interface (minimal for adapter needs)
 */
export interface RoleProviderContext {
  signals?: {
    on: (pattern: string, handler: () => void) => () => void
  }
  orchestrator?: {
    get: (name: string) => unknown
  }
  [key: string]: unknown
}

export class RoleProvider {
  /**
   * Get permissions granted to a role
   *
   * @param role - Role name (e.g., 'ROLE_USER')
   * @returns Array of permission strings (may include wildcards)
   *
   * @example
   * adapter.getPermissions('ROLE_ADMIN')
   * // ['entity:**', 'admin:**']
   */
  getPermissions(_role: string): string[] {
    throw new Error('RoleProvider.getPermissions() must be implemented')
  }

  /**
   * Get all defined roles
   *
   * @returns Array of role names
   *
   * @example
   * adapter.getRoles()
   * // ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN']
   */
  getRoles(): string[] {
    throw new Error('RoleProvider.getRoles() must be implemented')
  }

  /**
   * Get role hierarchy map
   *
   * @returns Role → inherited roles
   *
   * @example
   * adapter.getHierarchy()
   * // { ROLE_ADMIN: ['ROLE_USER'], ROLE_SUPER_ADMIN: ['ROLE_ADMIN'] }
   */
  getHierarchy(): RoleHierarchyMap {
    throw new Error('RoleProvider.getHierarchy() must be implemented')
  }

  /**
   * Get the role for unauthenticated users
   *
   * Always returns 'ROLE_ANONYMOUS' (convention)
   *
   * @returns Anonymous role name
   */
  getAnonymousRole(): string {
    return 'ROLE_ANONYMOUS'
  }

  /**
   * Get role metadata (label, description)
   * Optional - for display purposes
   *
   * @param role - Role name
   * @returns Role metadata or null
   */
  getRoleMeta(_role: string): RoleMeta | null {
    return null
  }

  /**
   * Install adapter (called by Kernel when context is ready)
   * Override for adapters that need initialization
   *
   * @param ctx - Kernel context
   */
  install(_ctx: RoleProviderContext): void {
    // Override if needed
  }

  /**
   * Uninstall adapter (cleanup)
   */
  uninstall(): void {
    // Override if needed
  }

  /**
   * Check if adapter supports persistence (editing + saving)
   *
   * When true, the adapter supports mutations (setRolePermissions, etc.)
   * AND can persist changes. UI should show edit controls.
   *
   * When false, the adapter is read-only. UI should hide edit controls.
   */
  get canPersist(): boolean {
    return false
  }
}
