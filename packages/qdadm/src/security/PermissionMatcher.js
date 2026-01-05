/**
 * PermissionMatcher - Wildcard permission matching
 *
 * Supports two wildcard patterns (similar to signals):
 * - `*` matches exactly one segment
 * - `**` matches zero or more segments (greedy)
 *
 * Permission format: namespace:target:action
 * Examples:
 *   entity:books:read      - specific permission
 *   entity:books:*         - any action on books
 *   entity:*:read          - read on any entity
 *   entity:**              - all entity permissions
 *   **                     - super admin (matches everything)
 *
 * @example
 * PermissionMatcher.matches('entity:*:read', 'entity:books:read')  // true
 * PermissionMatcher.matches('entity:**', 'entity:books:read')      // true
 * PermissionMatcher.matches('**', 'anything:here')                 // true
 */
export class PermissionMatcher {
  /**
   * Check if a permission pattern matches a required permission
   *
   * @param {string} pattern - Pattern with wildcards (e.g., 'entity:*:read')
   * @param {string} required - Required permission (e.g., 'entity:books:read')
   * @returns {boolean} True if pattern matches required
   *
   * @example
   * PermissionMatcher.matches('entity:books:read', 'entity:books:read')  // true (exact)
   * PermissionMatcher.matches('entity:books:*', 'entity:books:read')     // true (* = one segment)
   * PermissionMatcher.matches('entity:*:read', 'entity:books:read')      // true
   * PermissionMatcher.matches('entity:**', 'entity:books:read')          // true (** = greedy)
   * PermissionMatcher.matches('**', 'entity:books:read')                 // true (super admin)
   * PermissionMatcher.matches('entity:*:read', 'entity:a:b:read')        // false (* = exactly one)
   */
  static matches(pattern, required) {
    // Super admin
    if (pattern === '**') return true

    // Exact match
    if (pattern === required) return true

    const patternParts = pattern.split(':')
    const requiredParts = required.split(':')

    return this._matchParts(patternParts, requiredParts, 0, 0)
  }

  /**
   * Recursive matching of pattern parts against required parts
   * @private
   */
  static _matchParts(pattern, required, pi, ri) {
    // Both exhausted = match
    if (pi === pattern.length && ri === required.length) {
      return true
    }

    // Pattern exhausted but required has more = no match
    if (pi === pattern.length) {
      return false
    }

    const p = pattern[pi]

    // ** matches zero or more remaining segments
    if (p === '**') {
      // ** at end matches everything remaining
      if (pi === pattern.length - 1) {
        return true
      }

      // Try matching ** against 0, 1, 2, ... segments
      for (let skip = 0; skip <= required.length - ri; skip++) {
        if (this._matchParts(pattern, required, pi + 1, ri + skip)) {
          return true
        }
      }
      return false
    }

    // Required exhausted but pattern has more (and not **)
    if (ri === required.length) {
      return false
    }

    // * matches exactly one segment
    if (p === '*') {
      return this._matchParts(pattern, required, pi + 1, ri + 1)
    }

    // Literal match
    if (p === required[ri]) {
      return this._matchParts(pattern, required, pi + 1, ri + 1)
    }

    return false
  }

  /**
   * Check if any pattern in array matches the required permission
   *
   * @param {string[]} patterns - Array of patterns (user's permissions)
   * @param {string} required - Required permission to check
   * @returns {boolean} True if any pattern matches
   *
   * @example
   * const userPerms = ['entity:*:read', 'entity:*:list', 'auth:impersonate']
   * PermissionMatcher.any(userPerms, 'entity:books:read')  // true
   * PermissionMatcher.any(userPerms, 'entity:books:delete') // false
   */
  static any(patterns, required) {
    if (!patterns || patterns.length === 0) return false
    return patterns.some(p => this.matches(p, required))
  }

  /**
   * Filter permissions that match a pattern
   *
   * @param {string[]} permissions - Array of specific permissions
   * @param {string} pattern - Pattern to filter by
   * @returns {string[]} Permissions that match the pattern
   *
   * @example
   * const allPerms = ['entity:books:read', 'entity:books:create', 'auth:login']
   * PermissionMatcher.filter(allPerms, 'entity:books:*')  // ['entity:books:read', 'entity:books:create']
   */
  static filter(permissions, pattern) {
    return permissions.filter(p => this.matches(pattern, p))
  }

  /**
   * Expand a pattern against registered permissions
   * Useful for UI: show what a wildcard pattern actually grants
   *
   * @param {string} pattern - Pattern to expand
   * @param {string[]} allPermissions - All registered permissions
   * @returns {string[]} Permissions that the pattern would grant
   *
   * @example
   * const registry = ['entity:books:read', 'entity:books:create', 'entity:loans:read']
   * PermissionMatcher.expand('entity:*:read', registry)  // ['entity:books:read', 'entity:loans:read']
   */
  static expand(pattern, allPermissions) {
    return allPermissions.filter(p => this.matches(pattern, p))
  }
}
