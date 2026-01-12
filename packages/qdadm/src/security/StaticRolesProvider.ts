import { RoleProvider } from './RolesProvider'
import type {
  RoleMeta,
  RoleHierarchyMap,
  RolePermissionsMap,
  RoleLabelsMap,
} from './RolesProvider'

/**
 * Static role granter configuration
 */
export interface StaticRoleGranterConfig {
  role_hierarchy?: RoleHierarchyMap
  role_permissions?: RolePermissionsMap
  role_labels?: RoleLabelsMap
}

/**
 * StaticRoleProvider - Role granter from config object
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
 * const granter = new StaticRoleProvider({
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
export class StaticRoleProvider extends RoleProvider {
  protected _hierarchy: RoleHierarchyMap
  protected _permissions: RolePermissionsMap
  protected _labels: RoleLabelsMap

  constructor(config: StaticRoleGranterConfig = {}) {
    super()
    this._hierarchy = config.role_hierarchy || {}
    this._permissions = config.role_permissions || {}
    this._labels = config.role_labels || {}
  }

  /**
   * Get permissions for a role
   */
  getPermissions(role: string): string[] {
    return this._permissions[role] || []
  }

  /**
   * Get all defined roles
   */
  getRoles(): string[] {
    // Combine roles from permissions and hierarchy
    const roles = new Set<string>([
      ...Object.keys(this._permissions),
      ...Object.keys(this._hierarchy),
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
   */
  getHierarchy(): RoleHierarchyMap {
    return this._hierarchy
  }

  /**
   * Get role metadata
   */
  getRoleMeta(role: string): RoleMeta | null {
    const label = this._labels[role]
    if (!label) return null
    return { label }
  }

  /**
   * Update role permissions at runtime (for testing or hot-reload)
   */
  setPermissions(role: string, permissions: string[]): void {
    this._permissions[role] = permissions
  }

  /**
   * Update role hierarchy at runtime
   */
  setHierarchy(role: string, inherits: string[]): void {
    this._hierarchy[role] = inherits
  }
}
