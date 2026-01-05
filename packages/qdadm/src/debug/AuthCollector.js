/**
 * AuthCollector - Debug collector for authentication state
 *
 * This collector displays current authentication information:
 * - Current user details
 * - Permissions/roles
 * - Token info (expiry, claims)
 * - Auth adapter status
 *
 * Only shows content when auth is configured in the application.
 *
 * @example
 * const collector = new AuthCollector()
 * collector.install(ctx)
 * collector.getAuthInfo() // { user: {...}, permissions: [...], ... }
 */

import { Collector } from './Collector.js'

/**
 * Collector for authentication state visualization
 */
export class AuthCollector extends Collector {
  /**
   * Collector name identifier
   * @type {string}
   */
  static name = 'auth'

  /**
   * This collector shows state, not events
   * @type {boolean}
   */
  static records = false

  constructor(options = {}) {
    super(options)
    this._authAdapter = null
    this._securityChecker = null
    this._ctx = null
    this._signalCleanups = []
    // Activity tracking for login/logout events
    // Events auto-expire after TTL (no max limit)
    this._recentEvents = [] // Array of { type: 'login'|'logout', timestamp: Date, seen: boolean }
    this._eventTtl = options.eventTtl ?? 60000 // Events expire after 60s by default
    this._expiryTimer = null
  }

  /**
   * Internal install - get auth adapter reference and subscribe to signals
   * @param {object} ctx - Context object
   * @protected
   */
  _doInstall(ctx) {
    this._ctx = ctx
    this._authAdapter = ctx.auth
    if (!this._authAdapter) {
      // Try alternate locations
      this._authAdapter = ctx.authAdapter
    }
    this._securityChecker = ctx.security
    this._setupSignals()
  }

  /**
   * Setup signal listeners for auth changes
   * @private
   */
  _setupSignals() {
    const signals = this._ctx?.signals
    if (!signals) {
      setTimeout(() => this._setupSignals(), 100)
      return
    }

    // Listen to auth events and track activity
    const loginCleanup = signals.on('auth:login', (event) => {
      // QuarKernel wraps payload in KernelEvent - extract data from event.data
      const data = event?.data || event
      const user = data?.user || this._authAdapter?.getUser?.()
      this._addEvent('login', { user })
    })
    this._signalCleanups.push(loginCleanup)

    const logoutCleanup = signals.on('auth:logout', () => {
      this._addEvent('logout')
    })
    this._signalCleanups.push(logoutCleanup)

    const impersonateCleanup = signals.on('auth:impersonate', (payload) => {
      this._addEvent('impersonate', payload)
    })
    this._signalCleanups.push(impersonateCleanup)

    const impersonateStopCleanup = signals.on('auth:impersonate:stop', (payload) => {
      this._addEvent('impersonate-stop', payload)
    })
    this._signalCleanups.push(impersonateStopCleanup)

    const loginErrorCleanup = signals.on('auth:login:error', (payload) => {
      this._addEvent('login-error', payload)
    })
    this._signalCleanups.push(loginErrorCleanup)
  }

  /**
   * Add an auth event to the recent events list
   * @param {string} type - 'login' | 'logout' | 'impersonate' | 'impersonate-stop'
   * @param {object} [data] - Optional event data (e.g., { user } for impersonate)
   * @private
   */
  _addEvent(type, data = null) {
    this._recentEvents.unshift({
      type,
      timestamp: new Date(),
      id: Date.now(), // Unique ID for Vue key
      seen: false,
      data
    })
    // Events auto-expire via TTL, no max limit
    this._scheduleExpiry()
    this.notifyChange()
  }

  /**
   * Schedule event expiry check based on oldest event
   * @private
   */
  _scheduleExpiry() {
    // Clear existing timer
    if (this._expiryTimer) {
      clearTimeout(this._expiryTimer)
      this._expiryTimer = null
    }

    if (this._recentEvents.length === 0) return

    // Find the oldest event and calculate when it expires
    const now = Date.now()
    const oldest = this._recentEvents[this._recentEvents.length - 1]
    const age = now - oldest.timestamp.getTime()
    const delay = Math.max(100, this._eventTtl - age) // At least 100ms

    this._expiryTimer = setTimeout(() => {
      this._expireOldEvents()
    }, delay)
  }

  /**
   * Remove expired events
   * @private
   */
  _expireOldEvents() {
    this._expiryTimer = null
    const now = Date.now()
    const before = this._recentEvents.length
    this._recentEvents = this._recentEvents.filter(
      e => (now - e.timestamp.getTime()) < this._eventTtl
    )
    if (this._recentEvents.length < before) {
      this.notifyChange()
    }
    // Reschedule if still have events
    if (this._recentEvents.length > 0) {
      this._scheduleExpiry()
    }
  }

  /**
   * Internal uninstall - cleanup
   * @protected
   */
  _doUninstall() {
    if (this._expiryTimer) {
      clearTimeout(this._expiryTimer)
      this._expiryTimer = null
    }
    for (const cleanup of this._signalCleanups) {
      if (typeof cleanup === 'function') cleanup()
    }
    this._signalCleanups = []
    this._authAdapter = null
    this._securityChecker = null
    this._ctx = null
  }

  /**
   * Get badge - show count of unseen auth events
   * @returns {number} Number of unseen events
   */
  getBadge() {
    return this._recentEvents.filter(e => !e.seen).length
  }

  /**
   * Check if there's unseen activity
   * @returns {boolean}
   */
  hasActivity() {
    return this._recentEvents.some(e => !e.seen)
  }

  /**
   * Get all recent auth events (newest first)
   * @returns {Array<{type: string, timestamp: Date, id: number, seen: boolean}>}
   */
  getRecentEvents() {
    return this._recentEvents
  }

  /**
   * Get the last auth event type (for backward compatibility)
   * @returns {string|null} 'login' | 'logout' | null
   */
  getLastEvent() {
    return this._recentEvents[0]?.type || null
  }

  /**
   * Mark all events as seen (badge resets but events stay visible)
   * Note: Does not call notifyChange() to avoid re-render loop
   */
  markSeen() {
    for (const event of this._recentEvents) {
      event.seen = true
    }
  }

  /**
   * Clear all events (for explicit dismissal)
   */
  clearEvents() {
    this._recentEvents = []
    this.notifyChange()
  }

  /**
   * Get auth information for display
   * @returns {Array<object>} Auth info as entries
   */
  getEntries() {
    // Always get fresh authAdapter from ctx (may have updated state)
    const authAdapter = this._ctx?.auth || this._ctx?.authAdapter || this._authAdapter
    if (!authAdapter) {
      return [{ type: 'status', message: 'No auth adapter configured' }]
    }

    const entries = []

    // User info with effective permissions
    try {
      const user = authAdapter.getUser?.()
      // Always get fresh security (created after collector install)
      const securityChecker = this._ctx?.security || this._securityChecker

      if (user) {
        // Check if impersonating (use fresh authAdapter)
        const isImpersonating = authAdapter.isImpersonating?.() || false
        const originalUser = isImpersonating ? authAdapter.getOriginalUser?.() : null

        // Current User = the real logged in user (original when impersonating)
        const realUser = originalUser || user
        const realRoles = this._normalizeRoles(realUser.roles || realUser.role)
        const realPermissions = this._getEffectivePermissions(securityChecker, realRoles)

        entries.push({
          type: 'user',
          label: 'Current User',
          data: {
            id: realUser.id || realUser.userId,
            username: realUser.username || realUser.name || realUser.email,
            email: realUser.email,
            roles: realRoles,
            permissions: realPermissions
          }
        })

        // Impersonated User (when active) - shown separately with type 'impersonated'
        if (isImpersonating) {
          const impersonatedRoles = this._normalizeRoles(user.roles || user.role)
          const impersonatedPermissions = this._getEffectivePermissions(securityChecker, impersonatedRoles)

          entries.push({
            type: 'impersonated',
            label: 'Impersonated User',
            data: {
              id: user.id || user.userId,
              username: user.username || user.name || user.email,
              roles: impersonatedRoles,
              permissions: impersonatedPermissions  // These are the ACTIVE permissions!
            }
          })
        }
      } else {
        // Show anonymous role when not authenticated
        const anonymousRole = securityChecker?.roleGranter?.getAnonymousRole?.() || 'ROLE_ANONYMOUS'
        const effectivePermissions = this._getEffectivePermissions(securityChecker, [anonymousRole])

        entries.push({
          type: 'user',
          label: 'Anonymous',
          data: {
            role: anonymousRole,
            authenticated: false,
            permissions: effectivePermissions
          }
        })
      }
    } catch (e) {
      entries.push({
        type: 'error',
        label: 'User Error',
        message: e.message
      })
    }

    // Token info
    try {
      const token = authAdapter.getToken?.()
      if (token) {
        const decoded = this._decodeToken(token)
        entries.push({
          type: 'token',
          label: 'Token',
          data: {
            preview: token.substring(0, 20) + '...',
            expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toLocaleString() : 'Unknown',
            issuedAt: decoded?.iat ? new Date(decoded.iat * 1000).toLocaleString() : 'Unknown',
            claims: decoded
          }
        })
      }
    } catch (e) {
      // Token not available or decode failed
    }

    // User's effective permissions (from authAdapter)
    try {
      const userPermissions = authAdapter.getPermissions?.()
      if (userPermissions && userPermissions.length > 0) {
        entries.push({
          type: 'user-permissions',
          label: 'User Permissions',
          data: userPermissions
        })
      }
    } catch (e) {
      // Permissions not available
    }

    // Role hierarchy & permissions (lazy fetch - securityChecker created after module connect)
    try {
      const securityChecker = this._securityChecker || this._ctx?.security
      const hierarchy = securityChecker?.roleHierarchy?.map
      if (hierarchy && Object.keys(hierarchy).length > 0) {
        entries.push({
          type: 'hierarchy',
          label: 'Role Hierarchy',
          data: hierarchy
        })
      }
      const rolePermissions = securityChecker?.rolePermissions
      if (rolePermissions && Object.keys(rolePermissions).length > 0) {
        entries.push({
          type: 'role-permissions',
          label: 'Role Permissions',
          data: rolePermissions
        })
      }
    } catch (e) {
      // Security checker not available
    }

    // Registered permissions from PermissionRegistry (flat list of all permission keys)
    try {
      // Try multiple paths to find permissionRegistry
      const permissionRegistry = this._ctx?.permissionRegistry
        || this._ctx?._kernel?.permissionRegistry
        || this._ctx?.orchestrator?.kernel?.permissionRegistry
      if (permissionRegistry && permissionRegistry.size > 0) {
        // Get flat list of permission keys (e.g., ['entity:books:read', 'auth:impersonate'])
        const permissions = permissionRegistry.getKeys()
        entries.push({
          type: 'permissions',
          label: 'Permissions',
          data: permissions
        })
      }
    } catch (e) {
      // Permission registry not available
      console.warn('[AuthCollector] Error accessing permissionRegistry:', e)
    }

    // Adapter info
    entries.push({
      type: 'adapter',
      label: 'Auth Adapter',
      data: {
        type: authAdapter.constructor?.name || 'Unknown',
        hasUser: !!authAdapter.getUser,
        hasToken: !!authAdapter.getToken,
        hasPermissions: !!authAdapter.getPermissions,
        hasLogin: !!authAdapter.login,
        hasLogout: !!authAdapter.logout,
        hasImpersonate: !!authAdapter.impersonate,
        isImpersonating: authAdapter.isImpersonating?.() || false
      }
    })

    return entries
  }

  /**
   * Get effective permissions for a set of roles
   * Uses SecurityChecker.getUserPermissions() which resolves hierarchy
   *
   * @param {object} securityChecker - SecurityChecker instance
   * @param {string[]} roles - User's roles
   * @returns {string[]} Effective permissions (deduplicated, sorted)
   * @private
   */
  _getEffectivePermissions(securityChecker, roles) {
    if (!securityChecker || !roles || roles.length === 0) {
      return []
    }

    try {
      // Use SecurityChecker.getUserPermissions with a mock user
      if (securityChecker.getUserPermissions) {
        const mockUser = { roles }
        const perms = securityChecker.getUserPermissions(mockUser)
        return [...new Set(perms)].sort()
      }

      // Fallback: direct access to roleGranter
      const roleGranter = securityChecker.roleGranter
      if (!roleGranter) return []

      const permissions = new Set()
      for (const role of roles) {
        // Get reachable roles (includes inherited)
        const reachable = securityChecker.roleHierarchy?.getReachableRoles?.(role) || [role]
        for (const r of reachable) {
          const rolePerms = roleGranter.getPermissions?.(r) || []
          for (const perm of rolePerms) {
            permissions.add(perm)
          }
        }
      }

      return [...permissions].sort()
    } catch (e) {
      console.warn('[AuthCollector] Error getting effective permissions:', e)
      return []
    }
  }

  /**
   * Normalize roles to array with ROLE_ prefix
   * Supports: 'admin' → ['ROLE_ADMIN'], ['user'] → ['ROLE_USER'], ['ROLE_ADMIN'] → ['ROLE_ADMIN']
   *
   * @param {string|string[]} roles - Role(s) to normalize
   * @returns {string[]} Normalized roles array
   * @private
   */
  _normalizeRoles(roles) {
    if (!roles) return []

    // Convert to array
    const arr = Array.isArray(roles) ? roles : [roles]

    // Add ROLE_ prefix if missing and uppercase
    return arr.map(role => {
      if (!role) return null
      const upper = role.toUpperCase()
      return upper.startsWith('ROLE_') ? upper : `ROLE_${upper}`
    }).filter(Boolean)
  }

  /**
   * Sanitize user object - remove sensitive fields
   * @param {object} user - User object
   * @returns {object} Sanitized user
   * @private
   */
  _sanitizeUser(user) {
    const { password, token, accessToken, refreshToken, ...safe } = user
    return safe
  }

  /**
   * Decode JWT token (basic decode, no verification)
   * @param {string} token - JWT token
   * @returns {object|null} Decoded payload
   * @private
   */
  _decodeToken(token) {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const payload = parts[1]
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }
}
