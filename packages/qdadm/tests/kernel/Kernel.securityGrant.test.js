/**
 * The application provides the permission judgement (#2225).
 *
 * From a consumer whose backend is the authority on who may do what: qdadm's
 * role matrix is kept as the default, the app's judge answers first, and a
 * signal makes every screen re-evaluate when those answers change.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'
import { SIGNALS } from '../../src/kernel/SignalBus'

afterEach(() => vi.restoreAllMocks())

const user = { id: 1, roles: ['ROLE_USER'] }

function makeKernel(security) {
  const kernel = new Kernel({
    root: {},
    moduleDefs: [],
    security,
    entityAuthAdapter: { getCurrentUser: () => user },
  })
  kernel._createOrchestrator()
  return kernel
}

describe('security.grant is wired into the checker', () => {
  it('the kernel checker asks the judge first', () => {
    const kernel = makeKernel({
      role_permissions: { ROLE_USER: ['entity:books:read'] },
      grant: { isGranted: (attribute) => (attribute === 'entity:books:read' ? false : undefined) },
    })
    kernel._setupSecurity()

    expect(kernel.securityChecker.isGranted('entity:books:read')).toBe(false)
  })

  it('works with no role matrix at all — the backend is the only authority', () => {
    const kernel = makeKernel({ grant: { isGranted: () => true } })
    kernel._setupSecurity()

    expect(kernel.securityChecker.isGranted('entity:books:delete')).toBe(true)
  })

  it('refuses a grant that cannot judge, instead of silently skipping it', () => {
    const kernel = makeKernel({ grant: { is_granted: () => true } })

    expect(() => kernel._setupSecurity()).toThrow(/security\.grant must provide isGranted/)
  })

  it('is a recognised security key', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const kernel = makeKernel({ grant: { isGranted: () => undefined } })
    kernel._setupSecurity()

    expect(spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('security.grant'))).toHaveLength(0)
  })
})

describe('install(ctx) can pre-warm in one batch', () => {
  it('the judge and the provider get the same context, with the live permission registry', () => {
    const seen = {}
    const kernel = makeKernel({
      rolesProvider: {
        getHierarchy: () => ({}), getPermissions: () => [], getRoles: () => [], getLabels: () => ({}),
        install: (ctx) => { seen.provider = ctx },
      },
      grant: { isGranted: () => undefined, install: (ctx) => { seen.grant = ctx } },
    })
    kernel._setupSecurity()

    expect(seen.grant).toBe(seen.provider)
    expect(seen.grant.signals).toBe(kernel.signals)
    expect(seen.grant.orchestrator).toBe(kernel.orchestrator)
    expect(seen.grant.permissionRegistry).toBe(kernel.permissionRegistry)
  })

  it('the registry is a reference: keys registered after install are visible at fetch time', () => {
    let registry
    const kernel = makeKernel({ grant: { isGranted: () => undefined, install: (ctx) => { registry = ctx.permissionRegistry } } })
    kernel._setupSecurity()

    // modules register their entities AFTER install (boot order)
    kernel.permissionRegistry.registerEntity('books')

    expect(registry.getKeys()).toContain('entity:books:read')
  })
})

describe('security:changed makes every screen re-evaluate', () => {
  it('is a declared signal', () => {
    expect(SIGNALS.SECURITY_CHANGED).toBe('security:changed')
  })

  it('remounts the app, like a login does', () => {
    const kernel = makeKernel({ grant: { isGranted: () => undefined } })
    kernel.invalidateApp = vi.fn()
    kernel._setupAuthInvalidation()

    kernel.signals.emit(SIGNALS.SECURITY_CHANGED)

    expect(kernel.invalidateApp).toHaveBeenCalledTimes(1)
  })
})
