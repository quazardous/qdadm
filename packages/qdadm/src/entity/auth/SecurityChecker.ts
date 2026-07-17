import { RoleHierarchy, type RoleHierarchyConfig } from './RoleHierarchy'
import { PermissionMatcher } from '../../security/PermissionMatcher'
import { StaticRoleProvider } from '../../security/StaticRolesProvider'
import type { AuthUser } from './EntityAuthAdapter'

/**
 * RolesProvider adapter interface (from security module)
 */
export interface RoleProvider {
  getPermissions(role: string): string[]
  getRoles(): string[]
  getHierarchy(): RoleHierarchyConfig
  getAnonymousRole(): string
  getRoleMeta(role: string): { label?: string; description?: string } | null
  readonly canPersist: boolean
}

/**
 * SecurityChecker constructor options
 */
export interface SecurityCheckerOptions {
  rolesProvider?: RoleProvider
  roleHierarchy?: RoleHierarchy | RoleHierarchyConfig
  rolePermissions?: Record<string, string[]>
  getCurrentUser: () => AuthUser | null
}

/**
 * SecurityChecker config for factory
 */
export interface SecurityCheckerConfig {
  rolesProvider?: RoleProvider
  role_hierarchy?: RoleHierarchyConfig
  role_permissions?: Record<string, string[]>
  getCurrentUser: () => AuthUser | null
}

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
 */
export class SecurityChecker {
  protected _rolesProvider: RoleProvider
  readonly getCurrentUser: () => AuthUser | null
  /** Roles already warned about (warn-once, #1388) */
  protected _warnedRoles = new Set<string>()

  constructor({ rolesProvider, roleHierarchy, rolePermissions, getCurrentUser }: SecurityCheckerOptions) {
    if (rolesProvider) {
      this._rolesProvider = rolesProvider
    } else {
      // Legacy options (roleHierarchy/rolePermissions) are normalized ONCE
      // into a static provider (#1196) — the parallel _legacyRoleHierarchy
      // branch is gone; only the provider path remains.
      const hierarchyConfig =
        roleHierarchy instanceof RoleHierarchy
          ? roleHierarchy.map
          : (roleHierarchy as RoleHierarchyConfig) || {}

      this._rolesProvider = new StaticRoleProvider({
        role_hierarchy: hierarchyConfig,
        role_permissions: rolePermissions || {},
      })
    }

    this.getCurrentUser = getCurrentUser
  }

  /**
   * Get role hierarchy (dynamically resolved from rolesProvider)
   */
  get roleHierarchy(): RoleHierarchy {
    return new RoleHierarchy(this._rolesProvider.getHierarchy())
  }

  /**
   * Get roles provider adapter
   */
  get rolesProvider(): RoleProvider {
    return this._rolesProvider
  }

  /**
   * Get role permissions (for backward compatibility / debug panel)
   */
  get rolePermissions(): Record<string, string[]> {
    const roles = this._rolesProvider.getRoles()
    const perms: Record<string, string[]> = {}
    for (const role of roles) {
      perms[role] = this._rolesProvider.getPermissions(role)
    }
    return perms
  }

  /**
   * Check if current user is granted an attribute (role or permission)
   *
   * This is the main contract method, similar to Symfony's isGranted().
   */
  isGranted(attribute: string, _subject: unknown = null): boolean {
    const user = this.getCurrentUser()
    if (!user) return false

    // 1. Check if it's a role (ROLE_*)
    if (attribute.startsWith('ROLE_')) {
      return this.roleHierarchy.isGrantedRole(user.roles || [user.role || ''], attribute)
    }

    // 2. Check if it's a permission (with wildcard support)
    const userPerms = this.getUserPermissions(user)
    return PermissionMatcher.any(userPerms, attribute)
  }

  /**
   * Get all permissions for a user (resolved from roles + user overrides)
   */
  getUserPermissions(user: AuthUser): string[] {
    const roles = user.roles || [user.role || '']
    const perms = new Set<string>()

    for (const role of roles) {
      if (!role) continue
      const reachable = this.roleHierarchy.getReachableRoles(role)
      for (const r of reachable) {
        const rolePerms = this._rolesProvider.getPermissions(r)
        rolePerms.forEach((p) => perms.add(p))
      }
      this._warnUnknownRole(role)
    }

    // User-specific permission overrides
    if (user.permissions && Array.isArray(user.permissions)) {
      user.permissions.forEach((p) => perms.add(p))
    }

    return [...perms]
  }

  /**
   * A user role that matches NO configured role silently yields zero
   * permissions (e.g. `admin` instead of `ROLE_ADMIN`) — surface it once
   * per role so the misconfiguration is debuggable (#1388).
   */
  protected _warnUnknownRole(role: string): void {
    if (this._warnedRoles.has(role)) return
    const known = this._rolesProvider.getRoles()
    if (known.includes(role)) return
    // Hierarchy-only roles (declared in role_hierarchy without own
    // permissions) still count as known.
    if (Object.keys(this._rolesProvider.getHierarchy()).includes(role)) return
    this._warnedRoles.add(role)
    console.warn(
      `[qdadm] SecurityChecker: user role "${role}" matches no configured role ` +
        `(known: ${known.join(', ') || 'none'}) — the user gets NO permissions. ` +
        `Roles must match role_permissions/role_hierarchy keys exactly.`
    )
  }

  /**
   * Check if user can assign a role to another user
   */
  canAssignRole(targetRole: string): boolean {
    return this.isGranted('security:roles:assign') && this.isGranted(targetRole)
  }

  /**
   * Get all roles that current user can assign
   */
  getAssignableRoles(): string[] {
    if (!this.isGranted('security:roles:assign')) return []

    const user = this.getCurrentUser()
    if (!user) return []

    const userRoles = user.roles || [user.role || '']
    const assignable = new Set<string>()

    for (const role of userRoles) {
      if (!role) continue
      const reachable = this.roleHierarchy.getReachableRoles(role)
      reachable.forEach((r) => assignable.add(r))
    }

    return [...assignable]
  }
}

/**
 * Create a SecurityChecker instance from config
 */
export function createSecurityChecker(config: SecurityCheckerConfig): SecurityChecker {
  if (config.rolesProvider) {
    return new SecurityChecker({
      rolesProvider: config.rolesProvider,
      getCurrentUser: config.getCurrentUser,
    })
  }

  // Legacy config: auto-create static provider
  return new SecurityChecker({
    rolesProvider: new StaticRoleProvider({
      role_hierarchy: config.role_hierarchy || {},
      role_permissions: config.role_permissions || {},
    }),
    getCurrentUser: config.getCurrentUser,
  })
}
