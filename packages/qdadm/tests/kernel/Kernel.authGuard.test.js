/**
 * Unit tests for the nav permission check in the auth guard (qdadm #1190).
 *
 * A failing access check must fail CLOSED (deny navigation), not silently
 * allow. The only pass-through is "entity not registered" (manager not
 * loaded yet), which is checked explicitly.
 *
 * The guard is return-style (#1384): allow = returns undefined,
 * deny/redirect = returns a route location. No next() callback.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'

function makeKernel({ manager, registered = true, judge = null, readyTimeoutMs } = {}) {
  let guard = null
  const kernel = {
    options: {
      authAdapter: { isAuthenticated: () => true },
      debug: false,
      security: readyTimeoutMs === undefined ? {} : { readyTimeoutMs },
    },
    securityChecker: judge ? { grant: judge } : null,
    signals: { on: vi.fn(), emit: vi.fn() },
    orchestrator: {
      isRegistered: vi.fn(() => registered),
      get: vi.fn(() => manager),
      toast: { error: vi.fn(), warn: vi.fn() },
    },
    router: {
      beforeEach: vi.fn((fn) => { guard = fn }),
      hasRoute: () => false,
    },
  }
  Kernel.prototype._setupAuthGuard.call(kernel)
  return { kernel, guard: (...args) => guard(...args) }
}

const to = (entity) => ({ path: `/${entity}`, matched: [], meta: { entity } })

let errorSpy
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('auth guard entity access check (#1190)', () => {
  it('DENIES navigation when the access check throws (fail closed)', () => {
    const { guard } = makeKernel({
      manager: { canRead: () => { throw new Error('security backend down') } },
    })
    const result = guard(to('books'), {})

    expect(result).toEqual({ path: '/' })
    expect(errorSpy).toHaveBeenCalled()
    expect(String(errorSpy.mock.calls[0][0])).toContain('Access check failed')
  })

  it('allows navigation when the entity is not registered (manager not loaded yet)', () => {
    const { kernel, guard } = makeKernel({ registered: false })
    const result = guard(to('books'), {})

    expect(result).toBeUndefined()
    expect(kernel.orchestrator.get).not.toHaveBeenCalled()
  })

  it('denies navigation when canRead() returns false (existing behavior)', () => {
    const { kernel, guard } = makeKernel({
      manager: { canRead: () => false, labelPlural: 'Books' },
    })
    const result = guard(to('books'), {})

    expect(result).toEqual({ path: '/' })
    expect(kernel.signals.emit).toHaveBeenCalledWith(
      'auth:access-denied',
      expect.objectContaining({ entity: 'books' }),
    )
  })

  it('allows navigation when canRead() returns true', () => {
    const { guard } = makeKernel({ manager: { canRead: () => true } })
    const result = guard(to('books'), {})

    expect(result).toBeUndefined()
  })

})

describe('auth guard redirect to login (#2292)', () => {
  const withLogin = (authenticated) => {
    let guard = null
    const auth = { authenticated }
    const kernel = {
      options: {
        authAdapter: { isAuthenticated: () => auth.authenticated },
        debug: false,
      },
      signals: { on: vi.fn(), emit: vi.fn() },
      orchestrator: { isRegistered: vi.fn(), get: vi.fn(), toast: { error: vi.fn(), warn: vi.fn() } },
      router: {
        beforeEach: vi.fn((fn) => { guard = fn }),
        hasRoute: (name) => name === 'login',
      },
    }
    Kernel.prototype._setupAuthGuard.call(kernel)
    return { kernel, auth, guard: (...args) => guard(...args) }
  }
  const privateRoute = { path: '/books', matched: [{ meta: { requiresAuth: true } }], meta: {} }

  it('a first visit goes to login without session_lost, and signals no lost session', () => {
    const { kernel, guard } = withLogin(false)

    expect(guard(privateRoute, {})).toEqual({ name: 'login' })
    expect(kernel.signals.emit).not.toHaveBeenCalledWith('auth:session-lost', expect.anything())
  })

  it('a session this tab had and lost goes to login with session_lost=1, signalled once', () => {
    const { kernel, auth, guard } = withLogin(true)
    auth.authenticated = false

    expect(guard(privateRoute, {})).toEqual({ name: 'login', query: { session_lost: '1' } })
    expect(kernel.signals.emit).toHaveBeenCalledWith(
      'auth:session-lost',
      expect.objectContaining({ reason: 'token_missing' }),
    )
    // Already told: the next redirect is a plain one.
    expect(guard(privateRoute, {})).toEqual({ name: 'login' })
  })
})

describe('an asynchronous judge holds the first navigation (#2412)', () => {
  // The reload case: the navigation starts inside createApp(), before the
  // judge's request can answer. Deciding then reads a cache miss as a refusal.
  const deferred = () => {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }

  it('waits for the answers, then lets a granted page through', async () => {
    const load = deferred()
    let answers = null
    const manager = { canRead: vi.fn(() => answers?.read === true), labelPlural: 'Offers' }
    const { guard } = makeKernel({ manager, judge: { isGranted: () => undefined, ready: () => load.promise } })

    const result = guard(to('offers'), {})
    expect(result).toBeInstanceOf(Promise)
    // Nothing decided while the answers are on their way.
    await Promise.resolve()
    expect(manager.canRead).not.toHaveBeenCalled()

    answers = { read: true }
    load.resolve()
    expect(await result).toBeUndefined()
  })

  it('still denies a real refusal once the answers are in', async () => {
    const manager = { canRead: () => false, labelPlural: 'Offers' }
    const { kernel, guard } = makeKernel({ manager, judge: { isGranted: () => false, ready: () => Promise.resolve() } })

    expect(await guard(to('offers'), {})).toEqual({ path: '/' })
    expect(kernel.signals.emit).toHaveBeenCalledWith('auth:access-denied', expect.objectContaining({ entity: 'offers' }))
  })

  it('denies when the judge never answers — bounded, and saying why', async () => {
    const manager = { canRead: vi.fn(() => true) }
    const { guard } = makeKernel({
      manager,
      judge: { isGranted: () => undefined, ready: () => new Promise(() => {}) },
      readyTimeoutMs: 20,
    })

    expect(await guard(to('offers'), {})).toEqual({ path: '/' })
    // The unknown is never allowed, even though canRead would have said yes.
    expect(manager.canRead).not.toHaveBeenCalled()
    expect(String(errorSpy.mock.calls.at(-1)[0])).toMatch(/security\.grant never became ready .* no answer within 20 ms/)
  })

  it('denies when the load fails', async () => {
    const { guard } = makeKernel({
      manager: { canRead: () => true },
      judge: { isGranted: () => undefined, ready: () => Promise.reject(new Error('permissions API down')) },
    })

    expect(await guard(to('offers'), {})).toEqual({ path: '/' })
    expect(String(errorSpy.mock.calls.at(-1)[0])).toContain('permissions API down')
  })

  it('denies when ready() itself throws', async () => {
    const { guard } = makeKernel({
      manager: { canRead: () => true },
      judge: { isGranted: () => undefined, ready: () => { throw new Error('not wired') } },
    })

    expect(await guard(to('offers'), {})).toEqual({ path: '/' })
  })

  it('leaves a judge without ready() exactly as it was: synchronous', () => {
    const { guard } = makeKernel({ manager: { canRead: () => true }, judge: { isGranted: () => true } })

    expect(guard(to('offers'), {})).toBeUndefined()
  })

  it('does not wait on routes that need no entity check', () => {
    const ready = vi.fn(() => new Promise(() => {}))
    const { guard } = makeKernel({ manager: { canRead: () => true }, judge: { isGranted: () => undefined, ready } })

    expect(guard({ path: '/about', matched: [], meta: {} }, {})).toBeUndefined()
    expect(ready).not.toHaveBeenCalled()
  })
})
