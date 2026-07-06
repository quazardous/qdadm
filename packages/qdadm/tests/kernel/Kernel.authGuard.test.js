/**
 * Unit tests for the nav permission check in the auth guard (qdadm #1190).
 *
 * A failing access check must fail CLOSED (deny navigation), not silently
 * allow. The only pass-through is "entity not registered" (manager not
 * loaded yet), which is checked explicitly.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'

function makeKernel({ manager, registered = true } = {}) {
  let guard = null
  const kernel = {
    options: {
      authAdapter: { isAuthenticated: () => true },
      debug: false,
    },
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
    const next = vi.fn()
    guard(to('books'), {}, next)

    expect(next).toHaveBeenCalledWith({ path: '/' })
    expect(errorSpy).toHaveBeenCalled()
    expect(String(errorSpy.mock.calls[0][0])).toContain('Access check failed')
  })

  it('allows navigation when the entity is not registered (manager not loaded yet)', () => {
    const { kernel, guard } = makeKernel({ registered: false })
    const next = vi.fn()
    guard(to('books'), {}, next)

    expect(next).toHaveBeenCalledWith()
    expect(kernel.orchestrator.get).not.toHaveBeenCalled()
  })

  it('denies navigation when canRead() returns false (existing behavior)', () => {
    const { kernel, guard } = makeKernel({
      manager: { canRead: () => false, labelPlural: 'Books' },
    })
    const next = vi.fn()
    guard(to('books'), {}, next)

    expect(next).toHaveBeenCalledWith({ path: '/' })
    expect(kernel.signals.emit).toHaveBeenCalledWith(
      'auth:access-denied',
      expect.objectContaining({ entity: 'books' }),
    )
  })

  it('allows navigation when canRead() returns true', () => {
    const { guard } = makeKernel({ manager: { canRead: () => true } })
    const next = vi.fn()
    guard(to('books'), {}, next)

    expect(next).toHaveBeenCalledWith()
  })
})
