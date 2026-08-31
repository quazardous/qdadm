/**
 * Expired-session detection (#1905 lots E, F, A, B).
 *
 * From a consumer incident: a fetch-based SDK never triggered expiry at all,
 * and the axios path over-triggered it — once per failing response, each one
 * remounting the whole app.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'
import { SignalBus } from '../../src/kernel/SignalBus'
import { EntityManager } from '../../src/entity/EntityManager'
import { StorageError } from '../../src/entity/storage/errors'

function makeKernel(options = {}) {
  const kernel = new Kernel({ root: {}, moduleDefs: [], ...options })
  kernel._createOrchestrator()
  kernel.router = { currentRoute: { value: { name: 'runs' } }, push: vi.fn() }
  return kernel
}

const adapter = (isAuth = true) => ({
  isAuthenticated: () => isAuth,
  getToken: () => 't',
  logout: vi.fn(),
})

describe('Kernel — the signal bus exists from construction (lot B)', () => {
  it('is usable right after new Kernel(), where consumers wire it', () => {
    const kernel = new Kernel({ root: {}, moduleDefs: [] })

    // Was null until createApp(), and null?.emit?.() does not throw — so
    // wiring here silently did nothing.
    expect(kernel.signals).toBeInstanceOf(SignalBus)
  })

  it('keeps listeners registered before createApp()', () => {
    const kernel = new Kernel({ root: {}, moduleDefs: [] })
    const seen = []
    kernel.signals.on('custom:thing', () => seen.push(1))

    kernel._createSignalBus() // as createApp() would

    kernel.signals.emit('custom:thing')
    expect(seen).toHaveLength(1)
  })
})

describe('Kernel — one expiry per session (lot E)', () => {
  let kernel
  let authAdapter

  beforeEach(() => {
    authAdapter = adapter()
    kernel = makeKernel({ authAdapter })
    kernel._setupAuthExpiredHandler()
  })

  it('handles the first auth:expired', async () => {
    await kernel.signals.emit('auth:expired', { status: 401 })

    expect(authAdapter.logout).toHaveBeenCalledTimes(1)
    expect(kernel.router.push).toHaveBeenCalledTimes(1)
  })

  it('ignores the ones that follow — four concurrent 401s are one logout', async () => {
    // The reported symptom: a page firing four requests remounted the app four
    // times, because auth:logout triggers invalidateApp().
    for (let i = 0; i < 4; i++) await kernel.signals.emit('auth:expired', { status: 401 })

    expect(authAdapter.logout).toHaveBeenCalledTimes(1)
    expect(kernel.router.push).toHaveBeenCalledTimes(1)
  })

  it('re-arms on the next login', async () => {
    await kernel.signals.emit('auth:expired', { status: 401 })
    await kernel.signals.emit('auth:login', { user: {} })
    await kernel.signals.emit('auth:expired', { status: 401 })

    expect(authAdapter.logout).toHaveBeenCalledTimes(2)
  })

  it('redirects even when the emitter cleared its session first', async () => {
    // The case an earlier draft would have broken: guarding on
    // isAuthenticated() would skip the very first signal for any consumer that
    // clears auth state before emitting.
    const cleared = makeKernel({ authAdapter: adapter(false) })
    cleared._setupAuthExpiredHandler()

    await cleared.signals.emit('auth:expired', { status: 401 })

    expect(cleared.router.push).toHaveBeenCalledTimes(1)
  })
})

describe('EntityManager — expiry for any transport (lot A)', () => {
  function managerWith(error) {
    const signals = new SignalBus()
    const storage = {
      list: vi.fn().mockRejectedValue(error),
      get: vi.fn().mockRejectedValue(error),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }
    const manager = new EntityManager({ name: 'runs', storage })
    manager.setSignals(signals)
    const seen = []
    signals.on('auth:expired', (e) => seen.push(e.data))
    return { manager, seen }
  }

  it('announces a 401 from a storage that is not axios', async () => {
    const { manager, seen } = managerWith(new StorageError('unauthorised', 401))

    await expect(manager.list()).rejects.toThrow()
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ status: 401, entity: 'runs' })
  })

  it('stays silent on a 403 — a closed door is not an expired session', async () => {
    const { manager, seen } = managerWith(new StorageError('forbidden', 403))

    await expect(manager.list()).rejects.toThrow()
    expect(seen).toHaveLength(0)
  })

  it('stays silent on a plain failure', async () => {
    const { manager, seen } = managerWith(new StorageError('boom', 500))

    await expect(manager.list()).rejects.toThrow()
    expect(seen).toHaveLength(0)
  })

  it('lets the error through — watching must not swallow', async () => {
    const { manager } = managerWith(new StorageError('unauthorised', 401))

    await expect(manager.list()).rejects.toThrow('unauthorised')
  })
})
