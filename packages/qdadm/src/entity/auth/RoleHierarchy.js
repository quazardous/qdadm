/**
 * RoleHierarchy - Topological role resolution for Symfony-like permission system
 *
 * Roles form a Directed Acyclic Graph (DAG) where higher roles inherit
 * permissions from lower roles. This class resolves the complete set of
 * roles that a user effectively has based on their assigned roles.
 *
 * @example
 * ```js
 * const hierarchy = new RoleHierarchy({
 *   ROLE_ADMIN: ['ROLE_USER'],           // Admin inherits from User
 *   ROLE_SUPER_ADMIN: ['ROLE_ADMIN'],    // Super admin inherits from Admin
 *   ROLE_MANAGER: ['ROLE_USER'],         // Manager also inherits from User
 * })
 *
 * hierarchy.getReachableRoles('ROLE_ADMIN')
 * // Returns: ['ROLE_ADMIN', 'ROLE_USER']
 *
 * hierarchy.isGrantedRole(['ROLE_ADMIN'], 'ROLE_USER')
 * // Returns: true (admin has user permissions)
 * ```
 */
export class RoleHierarchy {
  /**
   * @param {Object<string, string[]>} hierarchy - Role inheritance map
   *        Keys are role names, values are arrays of parent roles they inherit from
   */
  constructor(hierarchy = {}) {
    this.map = hierarchy
  }

  /**
   * Resolve all roles reachable from a given role (topological traversal)
   *
   * Performs BFS traversal of the role graph to find all inherited roles.
   * Handles cycles gracefully by tracking visited nodes.
   *
   * @param {string} role - Starting role to resolve
   * @returns {string[]} All roles including the starting role and all inherited roles
   *
   * @example
   * // With hierarchy: { ROLE_ADMIN: ['ROLE_USER'] }
   * hierarchy.getReachableRoles('ROLE_ADMIN')
   * // Returns: ['ROLE_ADMIN', 'ROLE_USER']
   */
  getReachableRoles(role) {
    const visited = new Set()
    const queue = [role]

    while (queue.length > 0) {
      const current = queue.shift()
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
   *
   * @param {string|string[]} userRoles - Role(s) assigned to the user
   * @param {string} requiredRole - The role to check for
   * @returns {boolean} True if user has the required role (directly or inherited)
   *
   * @example
   * // With hierarchy: { ROLE_ADMIN: ['ROLE_USER'] }
   * hierarchy.isGrantedRole(['ROLE_ADMIN'], 'ROLE_USER')  // true
   * hierarchy.isGrantedRole(['ROLE_USER'], 'ROLE_ADMIN')  // false
   */
  isGrantedRole(userRoles, requiredRole) {
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
   *
   * @param {string} targetRole - The role to find grantors for
   * @returns {string[]} All roles that have the target role in their reachable set
   */
  getRolesGranting(targetRole) {
    const grantors = []

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
   *
   * @returns {boolean} True if hierarchy is valid (no cycles)
   */
  validate() {
    const visiting = new Set()
    const visited = new Set()

    const hasCycle = (role) => {
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
 *
 * @param {Object<string, string[]>} config - Role hierarchy configuration
 * @returns {RoleHierarchy}
 */
export function createRoleHierarchy(config = {}) {
  return new RoleHierarchy(config)
}
