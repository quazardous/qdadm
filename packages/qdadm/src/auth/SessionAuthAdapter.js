/**
 * SessionAuthAdapter - Base class for user authentication
 *
 * Applications extend this class to implement their authentication logic.
 * The adapter handles user sessions: login, logout, token management.
 *
 * This is different from EntityAuthAdapter which handles entity-level permissions.
 *
 * @example
 * ```js
 * class MyAuthAdapter extends SessionAuthAdapter {
 *   async login({ username, password }) {
 *     const response = await api.post('/auth/login', { username, password })
 *     this.setSession(response.token, response.user)
 *     return { token: response.token, user: response.user }
 *   }
 *
 *   logout() {
 *     this.clearSession()
 *   }
 * }
 * ```
 *
 * @abstract
 */
export class SessionAuthAdapter {
  /**
   * Internal session state
   * @protected
   */
  _token = null
  _user = null

  /**
   * Authenticate user with credentials
   *
   * @param {object} credentials - Login credentials
   * @param {string} credentials.username - Username or email
   * @param {string} credentials.password - Password
   * @returns {Promise<{token: string, user: object}>} Session data
   * @throws {Error} If authentication fails
   *
   * @example
   * const { token, user } = await adapter.login({ username: 'admin', password: 'secret' })
   */
  async login(credentials) {
    throw new Error('[SessionAuthAdapter] login() must be implemented by subclass')
  }

  /**
   * End the current session
   *
   * Should clear all session data (tokens, user info).
   * Called by AppLayout logout button and useAuth().logout()
   */
  logout() {
    throw new Error('[SessionAuthAdapter] logout() must be implemented by subclass')
  }

  /**
   * Check if user is currently authenticated
   *
   * @returns {boolean} True if user has valid session
   *
   * @example
   * if (adapter.isAuthenticated()) {
   *   // Show dashboard
   * } else {
   *   // Redirect to login
   * }
   */
  isAuthenticated() {
    throw new Error('[SessionAuthAdapter] isAuthenticated() must be implemented by subclass')
  }

  /**
   * Get the current authentication token
   *
   * Used by API clients to include in request headers.
   *
   * @returns {string|null} JWT token or null if not authenticated
   *
   * @example
   * const token = adapter.getToken()
   * fetch('/api/data', {
   *   headers: { Authorization: `Bearer ${token}` }
   * })
   */
  getToken() {
    throw new Error('[SessionAuthAdapter] getToken() must be implemented by subclass')
  }

  /**
   * Get the current user object
   *
   * Returns user data from the session. The shape depends on your backend.
   *
   * @returns {object|null} User object or null if not authenticated
   *
   * @example
   * const user = adapter.getUser()
   * console.log(user.username, user.email, user.roles)
   */
  getUser() {
    throw new Error('[SessionAuthAdapter] getUser() must be implemented by subclass')
  }

  /**
   * Synchronous user getter (optional)
   *
   * Some implementations prefer a property instead of method.
   * useAuth() supports both patterns.
   *
   * @type {object|null}
   */
  get user() {
    return this.getUser()
  }

  // ─────────────────────────────────────────────────────────────────
  // Helper methods for subclasses
  // ─────────────────────────────────────────────────────────────────

  /**
   * Set session data (helper for subclasses)
   *
   * @param {string} token - Authentication token
   * @param {object} user - User object
   * @protected
   */
  setSession(token, user) {
    this._token = token
    this._user = user
  }

  /**
   * Clear session data (helper for subclasses)
   *
   * @protected
   */
  clearSession() {
    this._token = null
    this._user = null
  }

  /**
   * Validate that the adapter is properly configured
   *
   * Called during bootstrap to catch configuration errors early.
   *
   * @throws {Error} If required methods are not implemented
   */
  static validate(adapter) {
    const required = ['login', 'logout', 'isAuthenticated', 'getToken', 'getUser']
    const missing = required.filter(method => typeof adapter[method] !== 'function')

    if (missing.length > 0) {
      throw new Error(
        `[SessionAuthAdapter] Missing required methods: ${missing.join(', ')}\n` +
        'Ensure your authAdapter implements all required methods or extends SessionAuthAdapter.'
      )
    }
  }
}

/**
 * LocalStorage-based SessionAuthAdapter implementation
 *
 * Ready-to-use adapter that stores session in localStorage.
 * Extend and override login() to add your API call.
 *
 * @example
 * ```js
 * class MyAuthAdapter extends LocalStorageSessionAuthAdapter {
 *   constructor() {
 *     super('my_app_auth') // localStorage key
 *   }
 *
 *   async login({ username, password }) {
 *     const res = await fetch('/api/login', {
 *       method: 'POST',
 *       body: JSON.stringify({ username, password })
 *     })
 *     const data = await res.json()
 *     this.setSession(data.token, data.user)
 *     this.persist()
 *     return data
 *   }
 * }
 * ```
 */
export class LocalStorageSessionAuthAdapter extends SessionAuthAdapter {
  /**
   * @param {string} storageKey - localStorage key for session data
   */
  constructor(storageKey = 'qdadm_auth') {
    super()
    this._storageKey = storageKey
    this._restore()
  }

  /**
   * Restore session from localStorage on init
   * @private
   */
  _restore() {
    try {
      const stored = localStorage.getItem(this._storageKey)
      if (stored) {
        const { token, user } = JSON.parse(stored)
        this._token = token
        this._user = user
      }
    } catch {
      // Invalid stored data, ignore
    }
  }

  /**
   * Persist session to localStorage
   * Call after login() to save session
   * @protected
   */
  persist() {
    if (this._token && this._user) {
      localStorage.setItem(this._storageKey, JSON.stringify({
        token: this._token,
        user: this._user
      }))
    } else {
      localStorage.removeItem(this._storageKey)
    }
  }

  // Arrow functions to preserve `this` when used as callbacks
  logout = () => {
    this.clearSession()
    localStorage.removeItem(this._storageKey)
  }

  isAuthenticated = () => {
    return !!this._token
  }

  getToken = () => {
    return this._token
  }

  getUser = () => {
    return this._user
  }
}

export default SessionAuthAdapter
