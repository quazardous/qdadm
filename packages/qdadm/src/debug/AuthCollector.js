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
    // Keep recent events to show stacked (last N events)
    this._recentEvents = [] // Array of { type: 'login'|'logout', timestamp: Date, seen: boolean }
    this._maxEvents = 5
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
    // Keep only last N events
    if (this._recentEvents.length > this._maxEvents) {
      this._recentEvents.pop()
    }
    this._scheduleExpiry()
    this.notifyChange()
  }

  /**
   * Schedule event expiry check
   * @private
   */
  _scheduleExpiry() {
    if (this._expiryTimer) return // Already scheduled
    this._expiryTimer = setTimeout(() => {
      this._expireOldEvents()
    }, this._eventTtl)
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
    if (!this._authAdapter) {
      return [{ type: 'status', message: 'No auth adapter configured' }]
    }

    const entries = []

    // User info
    try {
      const user = this._authAdapter.getUser?.()
      if (user) {
        entries.push({
          type: 'user',
          label: 'Current User',
          data: {
            id: user.id || user.userId,
            username: user.username || user.name || user.email,
            email: user.email,
            roles: user.roles || [],
            ...this._sanitizeUser(user)
          }
        })
      } else {
        entries.push({
          type: 'status',
          label: 'Status',
          message: 'Not authenticated'
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
      const token = this._authAdapter.getToken?.()
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

    // Permissions
    try {
      const permissions = this._authAdapter.getPermissions?.()
      if (permissions && permissions.length > 0) {
        entries.push({
          type: 'permissions',
          label: 'Permissions',
          data: permissions
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

    // Adapter info
    entries.push({
      type: 'adapter',
      label: 'Auth Adapter',
      data: {
        type: this._authAdapter.constructor?.name || 'Unknown',
        hasUser: !!this._authAdapter.getUser,
        hasToken: !!this._authAdapter.getToken,
        hasPermissions: !!this._authAdapter.getPermissions,
        hasLogin: !!this._authAdapter.login,
        hasLogout: !!this._authAdapter.logout
      }
    })

    return entries
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
