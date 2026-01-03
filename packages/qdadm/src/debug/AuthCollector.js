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
    this._ctx = null
    this._signalCleanups = []
    // Activity tracking for login/logout events
    this._hasActivity = false
    this._lastEvent = null // 'login' | 'logout' | null
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
    const loginCleanup = signals.on('auth:login', () => {
      this._hasActivity = true
      this._lastEvent = 'login'
      this.notifyChange()
    })
    this._signalCleanups.push(loginCleanup)

    const logoutCleanup = signals.on('auth:logout', () => {
      this._hasActivity = true
      this._lastEvent = 'logout'
      this.notifyChange()
    })
    this._signalCleanups.push(logoutCleanup)
  }

  /**
   * Internal uninstall - cleanup
   * @protected
   */
  _doUninstall() {
    for (const cleanup of this._signalCleanups) {
      if (typeof cleanup === 'function') cleanup()
    }
    this._signalCleanups = []
    this._authAdapter = null
    this._ctx = null
  }

  /**
   * Get badge - show 1 if there's unseen auth activity
   * @returns {number} 1 if activity unseen, 0 otherwise
   */
  getBadge() {
    return this._hasActivity ? 1 : 0
  }

  /**
   * Check if there's unseen activity
   * @returns {boolean}
   */
  hasActivity() {
    return this._hasActivity
  }

  /**
   * Get the last auth event type
   * @returns {string|null} 'login' | 'logout' | null
   */
  getLastEvent() {
    return this._lastEvent
  }

  /**
   * Mark activity as seen (clear activity state)
   * Note: Does not call notifyChange() to avoid re-render loop
   */
  markSeen() {
    this._hasActivity = false
    this._lastEvent = null
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
