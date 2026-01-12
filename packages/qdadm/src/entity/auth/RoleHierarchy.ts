/**
 * Role hierarchy configuration type
 */
export type RoleHierarchyConfig = Record<string, string[]>

/**
 * RoleHierarchy - Topological role resolution for Symfony-like permission system
 *
 * Roles form a Directed Acyclic Graph (DAG) where higher roles inherit
 * permissions from lower roles. This class resolves the complete set of
 * roles that a user effectively has based on their assigned roles.
 *
 * @example
 * ```ts
 * const hierarchy = new RoleHierarchy({
 *   ROLE_ADMIN: ['ROLE_USER'],           // Admin inherits from User
 *   ROLE_SUPER_ADMIN: ['ROLE_ADMIN'],    // Super admin inherits from Admin
 *   ROLE_MANAGER: ['ROLE_USER'],         // Manager also inherits from User
 * })
 *
 * hierarchy.getReachableRoles('ROLE_ADMIN')
 * // Returns: ['ROLE_ADMIN', 'ROLE_USER']
 * ```
 */
export class RoleHierarchy {
  readonly map: RoleHierarchyConfig

  constructor(hierarchy: RoleHierarchyConfig = {}) {
    this.map = hierarchy
  }

  /**
   * Resolve all roles reachable from a given role (topological traversal)
   *
   * Performs BFS traversal of the role graph to find all inherited roles.
   * Handles cycles gracefully by tracking visited nodes.
   */
  getReachableRoles(role: string): string[] {
    const visited = new Set<string>()
    const queue: string[] = [role]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      const parents = this.map[current] || []
      queue.push(...parents)
    }

    return [...visited]
  }

  /**
   * Check if user with given roles has the required role
   *
   * A user has a role if:
   * 1. They are directly assigned that role, OR
   * 2. They have a role that inherits from the required role
   */
  isGrantedRole(userRoles: string | string[], requiredRole: string): boolean {
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles]

    for (const role of roles) {
      const reachable = this.getReachableRoles(role)
      if (reachable.includes(requiredRole)) return true
    }

    return false
  }

  /**
   * Get all roles that can reach a given role (reverse lookup)
   *
   * Useful for finding which roles would grant a specific permission.
   */
  getRolesGranting(targetRole: string): string[] {
    const grantors: string[] = []

    for (const role of Object.keys(this.map)) {
      if (this.isGrantedRole([role], targetRole)) {
        grantors.push(role)
      }
    }

    // Also check the target role itself
    if (!grantors.includes(targetRole)) {
      grantors.push(targetRole)
    }

    return grantors
  }

  /**
   * Validate the hierarchy for cycles (optional sanity check)
   */
  validate(): boolean {
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const hasCycle = (role: string): boolean => {
      if (visited.has(role)) return false
      if (visiting.has(role)) return true

      visiting.add(role)
      const parents = this.map[role] || []
      for (const parent of parents) {
        if (hasCycle(parent)) return true
      }
      visiting.delete(role)
      visited.add(role)
      return false
    }

    for (const role of Object.keys(this.map)) {
      if (hasCycle(role)) return false
    }

    return true
  }
}

/**
 * Create a RoleHierarchy instance from config
 */
export function createRoleHierarchy(config: RoleHierarchyConfig = {}): RoleHierarchy {
  return new RoleHierarchy(config)
}
