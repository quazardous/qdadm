/**
 * SessionAuthAdapter - Base class for user authentication
 *
 * Applications extend this class to implement their authentication logic.
 * The adapter handles user sessions: login, logout, token management.
 *
 * This is different from EntityAuthAdapter which handles entity-level permissions.
 *
 * @example
 * ```ts
 * class MyAuthAdapter extends SessionAuthAdapter {
 *   async login({ username, password }: LoginCredentials) {
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

import type { SignalBus } from '../kernel/SignalBus'

/**
 * Login credentials interface
 */
export interface LoginCredentials {
  username: string
  password: string
  [key: string]: unknown
}

/**
 * Session data returned from login
 */
export interface SessionData<TUser = AuthUser> {
  token: string
  user: TUser
}

/**
 * Generic user object interface
 */
export interface AuthUser {
  id?: string | number
  username?: string
  email?: string
  name?: string
  roles?: string[]
  [key: string]: unknown
}

/**
 * Interface for session authentication adapters
 */
export interface ISessionAuthAdapter<TUser = AuthUser> {
  login(credentials: LoginCredentials): Promise<SessionData<TUser>>
  logout(): void
  isAuthenticated(): boolean
  getToken(): string | null
  getUser(): TUser | null
  readonly user: TUser | null
}

/**
 * Base class for session authentication
 */
export class SessionAuthAdapter<TUser extends AuthUser = AuthUser> implements ISessionAuthAdapter<TUser> {
  /**
   * Internal session state
   * @protected
   */
  protected _token: string | null = null
  protected _user: TUser | null = null

  /**
   * Authenticate user with credentials
   *
   * @param credentials - Login credentials
   * @returns Session data
   * @throws Error If authentication fails
   *
   * @example
   * const { token, user } = await adapter.login({ username: 'admin', password: 'secret' })
   */
  async login(_credentials: LoginCredentials): Promise<SessionData<TUser>> {
    throw new Error('[SessionAuthAdapter] login() must be implemented by subclass')
  }

  /**
   * End the current session
   *
   * Should clear all session data (tokens, user info).
   * Called by AppLayout logout button and useAuth().logout()
   */
  logout(): void {
    throw new Error('[SessionAuthAdapter] logout() must be implemented by subclass')
  }

  /**
   * Check if user is currently authenticated
   *
   * @returns True if user has valid session
   *
   * @example
   * if (adapter.isAuthenticated()) {
   *   // Show dashboard
   * } else {
   *   // Redirect to login
   * }
   */
  isAuthenticated(): boolean {
    throw new Error('[SessionAuthAdapter] isAuthenticated() must be implemented by subclass')
  }

  /**
   * Get the current authentication token
   *
   * Used by API clients to include in request headers.
   *
   * @returns JWT token or null if not authenticated
   *
   * @example
   * const token = adapter.getToken()
   * fetch('/api/data', {
   *   headers: { Authorization: `Bearer ${token}` }
   * })
   */
  getToken(): string | null {
    throw new Error('[SessionAuthAdapter] getToken() must be implemented by subclass')
  }

  /**
   * Get the current user object
   *
   * Returns user data from the session. The shape depends on your backend.
   *
   * @returns User object or null if not authenticated
   *
   * @example
   * const user = adapter.getUser()
   * console.log(user.username, user.email, user.roles)
   */
  getUser(): TUser | null {
    throw new Error('[SessionAuthAdapter] getUser() must be implemented by subclass')
  }

  /**
   * Synchronous user getter (optional)
   *
   * Some implementations prefer a property instead of method.
   * useAuth() supports both patterns.
   */
  get user(): TUser | null {
    return this.getUser()
  }

  // ─────────────────────────────────────────────────────────────────
  // Helper methods for subclasses
  // ─────────────────────────────────────────────────────────────────

  /**
   * Set session data (helper for subclasses)
   *
   * @param token - Authentication token
   * @param user - User object
   * @protected
   */
  protected setSession(token: string, user: TUser): void {
    this._token = token
    this._user = user
  }

  /**
   * Clear session data (helper for subclasses)
   *
   * @protected
   */
  protected clearSession(): void {
    this._token = null
    this._user = null
  }

  /**
   * Destroy session (catastrophic/silent logout)
   *
   * Clears token WITHOUT triggering normal logout signals.
   * Used by DebugBar to test how the app handles unexpected session loss.
   */
  destroySession(): void {
    this._token = null
  }

  /**
   * Validate that the adapter is properly configured
   *
   * Called during bootstrap to catch configuration errors early.
   *
   * @throws Error If required methods are not implemented
   */
  static validate(adapter: ISessionAuthAdapter): void {
    const required: (keyof ISessionAuthAdapter)[] = ['login', 'logout', 'isAuthenticated', 'getToken', 'getUser']
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
 * Stored session data structure
 */
interface StoredSessionData<TUser = AuthUser> {
  token: string
  user: TUser
  originalUser?: TUser
}

/**
 * LocalStorage-based SessionAuthAdapter implementation
 *
 * Ready-to-use adapter that stores session in localStorage.
 * Extend and override login() to add your API call.
 *
 * @example
 * ```ts
 * class MyAuthAdapter extends LocalStorageSessionAuthAdapter {
 *   constructor() {
 *     super('my_app_auth') // localStorage key
 *   }
 *
 *   async login({ username, password }: LoginCredentials) {
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
export class LocalStorageSessionAuthAdapter<TUser extends AuthUser = AuthUser> extends SessionAuthAdapter<TUser> {
  protected _storageKey: string
  protected _originalUser: TUser | null = null  // Stores original user during impersonation

  /**
   * @param storageKey - localStorage key for session data
   */
  constructor(storageKey: string = 'qdadm_auth') {
    super()
    this._storageKey = storageKey
    this._restore()
  }

  /**
   * Restore session from localStorage on init
   * @private
   */
  private _restore(): void {
    try {
      const stored = localStorage.getItem(this._storageKey)
      if (stored) {
        const { token, user, originalUser } = JSON.parse(stored) as StoredSessionData<TUser>
        this._token = token
        this._user = user
        this._originalUser = originalUser ?? null
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
  protected persist(): void {
    if (this._token && this._user) {
      const data: StoredSessionData<TUser> = {
        token: this._token,
        user: this._user
      }
      if (this._originalUser) {
        data.originalUser = this._originalUser
      }
      localStorage.setItem(this._storageKey, JSON.stringify(data))
    } else {
      localStorage.removeItem(this._storageKey)
    }
  }

  // Arrow functions to preserve `this` when used as callbacks
  logout = (): void => {
    this._originalUser = null
    this.clearSession()
    localStorage.removeItem(this._storageKey)
  }

  isAuthenticated = (): boolean => {
    return !!this._token
  }

  getToken = (): string | null => {
    return this._token
  }

  getUser = (): TUser | null => {
    return this._user
  }

  // ─────────────────────────────────────────────────────────────────
  // Impersonation support
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check if currently impersonating another user
   */
  isImpersonating = (): boolean => {
    return this._originalUser !== null
  }

  /**
   * Get the original user (admin) when impersonating
   * @returns Original user or null if not impersonating
   */
  getOriginalUser = (): TUser | null => {
    return this._originalUser
  }

  /**
   * Start impersonating another user
   *
   * @param targetUser - User to impersonate
   * @returns The impersonated user
   */
  impersonate = (targetUser: TUser): TUser => {
    if (!this._user) {
      throw new Error('Must be authenticated to impersonate')
    }
    if (this._originalUser) {
      throw new Error('Already impersonating. Stop first.')
    }

    this._originalUser = this._user
    this._user = targetUser
    this.persist()

    return targetUser
  }

  /**
   * Stop impersonating and return to original user
   *
   * @returns The original user
   */
  stopImpersonating = (): TUser => {
    if (!this._originalUser) {
      throw new Error('Not currently impersonating')
    }

    const original = this._originalUser
    this._user = this._originalUser
    this._originalUser = null
    this.persist()

    return original
  }

  /**
   * Destroy session - clears token and localStorage
   * @override
   */
  destroySession = (): void => {
    this._token = null
    localStorage.removeItem(this._storageKey)
  }

  // ─────────────────────────────────────────────────────────────────
  // Signal integration
  // ─────────────────────────────────────────────────────────────────

  /**
   * Connect authAdapter to signals for reactive impersonation
   *
   * Call this during kernel boot to enable signal-driven impersonation.
   * The adapter will listen to auth:impersonate and auth:impersonate:stop
   * signals and update its internal state automatically.
   *
   * @param signals - Signals instance (from orchestrator.signals)
   * @returns Cleanup function to unsubscribe
   */
  connectSignals(signals: SignalBus | null): () => void {
    if (!signals) return () => {}

    const cleanups: Array<() => void> = []

    // Listen for impersonate signal
    cleanups.push(signals.on('auth:impersonate', (event) => {
      const data = event.data as { target?: TUser } | undefined
      const targetUser = data?.target
      if (targetUser && !this._originalUser) {
        this._originalUser = this._user
        this._user = targetUser
        this.persist()
      }
    }))

    // Listen for stop impersonation signal
    cleanups.push(signals.on('auth:impersonate:stop', () => {
      if (this._originalUser) {
        this._user = this._originalUser
        this._originalUser = null
        this.persist()
      }
    }))

    // Return cleanup function
    return () => {
      cleanups.forEach(cleanup => cleanup?.())
    }
  }
}

export default SessionAuthAdapter
