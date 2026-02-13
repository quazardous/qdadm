import { authFactory, CompositeAuthAdapter } from '../entity/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Self = any

/**
 * Patch Kernel prototype with auth-related methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAuthMethods(KernelClass: { prototype: any }): void {
  const proto = KernelClass.prototype as Self

  /**
   * Resolve entityAuthAdapter through authFactory
   */
  proto._resolveEntityAuthAdapter = function (this: Self): void {
    const { entityAuthAdapter, authTypes } = this.options

    if (entityAuthAdapter == null) return

    const context = {
      authTypes: authTypes || {},
      CompositeAuthAdapter,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.options.entityAuthAdapter = authFactory(entityAuthAdapter, context as any)
  }

  /**
   * Register auth:ready deferred if auth is configured
   */
  proto._registerAuthDeferred = function (this: Self): void {
    const { authAdapter } = this.options
    if (!authAdapter) return

    this.deferred!.queue('auth:ready', () => {
      return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.signals!.once('auth:login', (event: any) => {
          resolve(event.data?.user)
        })
      })
    })
  }

  /**
   * Setup handler for auth:expired signal
   */
  proto._setupAuthExpiredHandler = function (this: Self): void {
    const { authAdapter, onAuthExpired } = this.options
    if (!authAdapter) return

    this.signals!.on('auth:expired', async (payload: { data: unknown }) => {
      const debug = this.options.debug ?? false
      if (debug) {
        console.warn('[Kernel] auth:expired received:', payload)
      }

      if (authAdapter.logout) {
        authAdapter.logout()
      }

      const payloadData = typeof payload.data === 'object' && payload.data !== null ? payload.data : {}
      await this.signals!.emit('auth:logout', { reason: 'expired', ...payloadData })

      if (this.router!.currentRoute.value.name !== 'login') {
        this.router!.push({ name: 'login', query: { expired: '1' } })
      }

      if (onAuthExpired) {
        onAuthExpired(payload)
      }
    })
  }

  /**
   * Setup authAdapter to react to impersonation signals
   */
  proto._setupAuthImpersonation = function (this: Self): void {
    const { authAdapter } = this.options
    if (!authAdapter?.connectSignals) return

    const debug = this.options.debug ?? false
    if (debug) {
      console.debug('[Kernel] Wiring authAdapter.connectSignals() for impersonation')
    }

    this._authImpersonationCleanup = authAdapter.connectSignals(this.signals!)
  }

  /**
   * Setup auth invalidation - remount entire app on auth changes
   */
  proto._setupAuthInvalidation = function (this: Self): void {
    const debug = this.options.debug ?? false
    const authSignals = [
      'auth:login',
      'auth:logout',
      'auth:impersonate',
      'auth:impersonate:stop',
    ]

    for (const signal of authSignals) {
      this.signals!.on(signal, () => {
        if (debug) {
          console.debug(`[Kernel] ${signal} → invalidateApp()`)
        }
        this.invalidateApp()
      })
    }
  }

  /**
   * Force full app remount
   */
  proto.invalidateApp = function (this: Self): void {
    this._appKey.value++
  }
}
