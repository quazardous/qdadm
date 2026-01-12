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
 */

import { Collector, type CollectorContext, type CollectorEntry, type CollectorOptions } from './Collector'
import type { ISessionAuthAdapter, AuthUser } from '../../auth/SessionAuthAdapter'
import type { SecurityChecker } from '../../entity/auth/SecurityChecker'

/**
 * Auth event types
 */
export type AuthEventType = 'login' | 'logout' | 'impersonate' | 'impersonate-stop' | 'login-error'

/**
 * Auth event entry
 */
export interface AuthEvent {
  type: AuthEventType
  timestamp: Date
  id: number
  seen: boolean
  data: unknown
}

/**
 * Auth entry types
 */
export interface AuthEntry extends CollectorEntry {
  type: 'status' | 'user' | 'impersonated' | 'token' | 'user-permissions' | 'hierarchy' | 'role-permissions' | 'permissions' | 'adapter' | 'error'
  label?: string
  message?: string
  data?: unknown
}

/**
 * Auth collector options
 */
export interface AuthCollectorOptions extends CollectorOptions {
  eventTtl?: number
}

/**
 * Extended context for auth collector
 */
interface AuthCollectorContext extends CollectorContext {
  auth?: ISessionAuthAdapter
  authAdapter?: ISessionAuthAdapter
  security?: SecurityChecker
  permissionRegistry?: { size: number; getKeys: () => string[] }
  _kernel?: { permissionRegistry?: { size: number; getKeys: () => string[] } }
}

/**
 * Collector for authentication state visualization
 */
export class AuthCollector extends Collector<AuthEntry> {
  static override collectorName = 'auth'
  static override records = false

  private _authAdapter: ISessionAuthAdapter | null = null
  private _securityChecker: SecurityChecker | null = null
  private _signalCleanups: Array<() => void> = []
  private _recentEvents: AuthEvent[] = []
  private _eventTtl: number
  private _expiryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: AuthCollectorOptions = {}) {
    super(options)
    this._eventTtl = options.eventTtl ?? 60000
  }

  protected override _doInstall(ctx: CollectorContext): void {
    this._ctx = ctx
    const authCtx = ctx as AuthCollectorContext
    this._authAdapter = authCtx.auth ?? authCtx.authAdapter ?? null
    this._securityChecker = authCtx.security ?? null
    this._setupSignals()
  }

  private _setupSignals(): void {
    const signals = this._ctx?.signals
    if (!signals) {
      setTimeout(() => this._setupSignals(), 100)
      return
    }

    const loginCleanup = signals.on('auth:login', (event) => {
      const data = (event.data ?? event) as { user?: AuthUser }
      const user = data?.user ?? (this._authAdapter as { getUser?: () => AuthUser })?.getUser?.()
      this._addEvent('login', { user })
    })
    this._signalCleanups.push(loginCleanup)

    const logoutCleanup = signals.on('auth:logout', () => {
      this._addEvent('logout')
    })
    this._signalCleanups.push(logoutCleanup)

    const impersonateCleanup = signals.on('auth:impersonate', (payload) => {
      this._addEvent('impersonate', payload.data)
    })
    this._signalCleanups.push(impersonateCleanup)

    const impersonateStopCleanup = signals.on('auth:impersonate:stop', (payload) => {
      this._addEvent('impersonate-stop', payload.data)
    })
    this._signalCleanups.push(impersonateStopCleanup)

    const loginErrorCleanup = signals.on('auth:login:error', (payload) => {
      this._addEvent('login-error', payload.data)
    })
    this._signalCleanups.push(loginErrorCleanup)
  }

  private _addEvent(type: AuthEventType, data: unknown = null): void {
    this._recentEvents.unshift({
      type,
      timestamp: new Date(),
      id: Date.now(),
      seen: false,
      data
    })
    this._scheduleExpiry()
    this.notifyChange()
  }

  private _scheduleExpiry(): void {
    if (this._expiryTimer) {
      clearTimeout(this._expiryTimer)
      this._expiryTimer = null
    }

    if (this._recentEvents.length === 0) return

    const now = Date.now()
    const oldest = this._recentEvents[this._recentEvents.length - 1]
    if (!oldest) return
    const age = now - oldest.timestamp.getTime()
    const delay = Math.max(100, this._eventTtl - age)

    this._expiryTimer = setTimeout(() => {
      this._expireOldEvents()
    }, delay)
  }

  private _expireOldEvents(): void {
    this._expiryTimer = null
    const now = Date.now()
    const before = this._recentEvents.length
    this._recentEvents = this._recentEvents.filter(
      e => (now - e.timestamp.getTime()) < this._eventTtl
    )
    if (this._recentEvents.length < before) {
      this.notifyChange()
    }
    if (this._recentEvents.length > 0) {
      this._scheduleExpiry()
    }
  }

  protected override _doUninstall(): void {
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

  override getBadge(): number {
    return this._recentEvents.filter(e => !e.seen).length
  }

  hasActivity(): boolean {
    return this._recentEvents.some(e => !e.seen)
  }

  getRecentEvents(): AuthEvent[] {
    return this._recentEvents
  }

  getLastEvent(): AuthEventType | null {
    return this._recentEvents[0]?.type ?? null
  }

  markSeen(): void {
    for (const event of this._recentEvents) {
      event.seen = true
    }
  }

  clearEvents(): void {
    this._recentEvents = []
    this.notifyChange()
  }

  override getEntries(): AuthEntry[] {
    const authCtx = this._ctx as AuthCollectorContext
    const authAdapter = authCtx?.auth ?? authCtx?.authAdapter ?? this._authAdapter
    if (!authAdapter) {
      return [{ timestamp: Date.now(), type: 'status', message: 'No auth adapter configured' }]
    }

    const entries: AuthEntry[] = []
    const adapter = authAdapter as ISessionAuthAdapter & {
      getUser?: () => AuthUser | null
      getToken?: () => string | null
      getPermissions?: () => string[]
      isImpersonating?: () => boolean
      getOriginalUser?: () => AuthUser | null
      impersonate?: (user: AuthUser) => void
    }

    // User info
    try {
      const user = adapter.getUser?.()
      const securityChecker = authCtx?.security ?? this._securityChecker

      if (user) {
        const isImpersonating = adapter.isImpersonating?.() ?? false
        const originalUser = isImpersonating ? adapter.getOriginalUser?.() : null

        const realUser = originalUser ?? user
        const realRoles = this._normalizeRoles((realUser as AuthUser & { role?: string }).roles ?? (realUser as AuthUser & { role?: string }).role)
        const realPermissions = this._getEffectivePermissions(securityChecker, realRoles)

        entries.push({
          timestamp: Date.now(),
          type: 'user',
          label: 'Current User',
          data: {
            id: realUser.id,
            username: realUser.username ?? realUser.name ?? realUser.email,
            email: realUser.email,
            roles: realRoles,
            permissions: realPermissions
          }
        })

        if (isImpersonating) {
          const impersonatedRoles = this._normalizeRoles((user as AuthUser & { role?: string }).roles ?? (user as AuthUser & { role?: string }).role)
          const impersonatedPermissions = this._getEffectivePermissions(securityChecker, impersonatedRoles)

          entries.push({
            timestamp: Date.now(),
            type: 'impersonated',
            label: 'Impersonated User',
            data: {
              id: user.id,
              username: user.username ?? user.name ?? user.email,
              roles: impersonatedRoles,
              permissions: impersonatedPermissions
            }
          })
        }
      } else {
        const checker = securityChecker as SecurityChecker & { roleGranter?: { getAnonymousRole?: () => string } }
        const anonymousRole = checker?.roleGranter?.getAnonymousRole?.() ?? 'ROLE_ANONYMOUS'
        const effectivePermissions = this._getEffectivePermissions(securityChecker, [anonymousRole])

        entries.push({
          timestamp: Date.now(),
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
        timestamp: Date.now(),
        type: 'error',
        label: 'User Error',
        message: (e as Error).message
      })
    }

    // Token info
    try {
      const token = adapter.getToken?.()
      if (token) {
        const decoded = this._decodeToken(token)
        entries.push({
          timestamp: Date.now(),
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
    } catch {
      // Token not available
    }

    // User permissions
    try {
      const userPermissions = adapter.getPermissions?.()
      if (userPermissions && userPermissions.length > 0) {
        entries.push({
          timestamp: Date.now(),
          type: 'user-permissions',
          label: 'User Permissions',
          data: userPermissions
        })
      }
    } catch {
      // Permissions not available
    }

    // Role hierarchy & permissions
    try {
      const securityChecker = this._securityChecker ?? authCtx?.security
      const checker = securityChecker as SecurityChecker & { roleHierarchy?: { map: Record<string, string[]> }; rolePermissions?: Record<string, string[]> }
      const hierarchy = checker?.roleHierarchy?.map
      if (hierarchy && Object.keys(hierarchy).length > 0) {
        entries.push({
          timestamp: Date.now(),
          type: 'hierarchy',
          label: 'Role Hierarchy',
          data: hierarchy
        })
      }
      const rolePermissions = checker?.rolePermissions
      if (rolePermissions && Object.keys(rolePermissions).length > 0) {
        entries.push({
          timestamp: Date.now(),
          type: 'role-permissions',
          label: 'Role Permissions',
          data: rolePermissions
        })
      }
    } catch {
      // Security checker not available
    }

    // Registered permissions
    try {
      const permissionRegistry = authCtx?.permissionRegistry
        ?? authCtx?._kernel?.permissionRegistry
      if (permissionRegistry && permissionRegistry.size > 0) {
        const permissions = permissionRegistry.getKeys()
        entries.push({
          timestamp: Date.now(),
          type: 'permissions',
          label: 'Permissions',
          data: permissions
        })
      }
    } catch (e) {
      console.warn('[AuthCollector] Error accessing permissionRegistry:', e)
    }

    // Adapter info
    entries.push({
      timestamp: Date.now(),
      type: 'adapter',
      label: 'Auth Adapter',
      data: {
        type: adapter.constructor?.name ?? 'Unknown',
        hasUser: !!adapter.getUser,
        hasToken: !!adapter.getToken,
        hasPermissions: !!adapter.getPermissions,
        hasLogin: !!(adapter as { login?: unknown }).login,
        hasLogout: !!(adapter as { logout?: unknown }).logout,
        hasImpersonate: !!adapter.impersonate,
        isImpersonating: adapter.isImpersonating?.() ?? false
      }
    })

    return entries
  }

  private _getEffectivePermissions(securityChecker: SecurityChecker | null | undefined, roles: string[]): string[] {
    if (!securityChecker || !roles || roles.length === 0) {
      return []
    }

    try {
      const checker = securityChecker as SecurityChecker & {
        getUserPermissions?: (user: { roles: string[] }) => string[]
        roleGranter?: { getPermissions?: (role: string) => string[] }
        roleHierarchy?: { getReachableRoles?: (role: string) => string[] }
      }

      if (checker.getUserPermissions) {
        const mockUser = { roles }
        const perms = checker.getUserPermissions(mockUser)
        return [...new Set(perms)].sort()
      }

      const roleGranter = checker.roleGranter
      if (!roleGranter) return []

      const permissions = new Set<string>()
      for (const role of roles) {
        const reachable = checker.roleHierarchy?.getReachableRoles?.(role) ?? [role]
        for (const r of reachable) {
          const rolePerms = roleGranter.getPermissions?.(r) ?? []
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

  private _normalizeRoles(roles: string | string[] | undefined): string[] {
    if (!roles) return []
    const arr = Array.isArray(roles) ? roles : [roles]
    return arr.map(role => {
      if (!role) return null
      const upper = role.toUpperCase()
      return upper.startsWith('ROLE_') ? upper : `ROLE_${upper}`
    }).filter((r): r is string => r !== null)
  }

  private _decodeToken(token: string): { exp?: number; iat?: number; [key: string]: unknown } | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const payload = parts[1]
      if (!payload) return null
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }
}
