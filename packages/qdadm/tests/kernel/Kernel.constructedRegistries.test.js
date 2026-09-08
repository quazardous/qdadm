/**
 * What can exist at construction, does (#1906 lot B1).
 *
 * Seventeen public Kernel properties were `null` until `createApp()`, through
 * a window nothing documented. Someone reached for `kernel.signals` right
 * after `new Kernel()`, got `null`, and `null?.emit?.()` swallowed it without
 * a word — the report that started #1906.
 *
 * Five of them had no reason to wait: they depend on nothing but `options`
 * and each other. Closing the window beats warning about it — that is the
 * first of ADR 0011's three answers, and the only one that removes defensive
 * code instead of adding it.
 *
 * The rest (vueApp, router, moduleLoader…) genuinely cannot exist before the
 * app is mounted, and are a different problem with a different answer.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { Kernel } from '../../src/kernel/Kernel'

const CONSTRUCTED = ['signals', 'hookRegistry', 'zoneRegistry', 'deferred', 'permissionRegistry']

function makeKernel(options = {}) {
  return new Kernel({ root: {}, moduleDefs: [], ...options })
}

describe('the five registries exist the moment the Kernel does', () => {
  it.each(CONSTRUCTED)('kernel.%s is usable right after new Kernel()', (prop) => {
    const kernel = makeKernel()

    expect(kernel[prop]).toBeTruthy()
  })

  it('the bus can be wired before createApp(), which is the reported case', () => {
    const kernel = makeKernel()
    const heard = vi.fn()

    // No `?.` needed any more — that optional chaining is what hid the bug.
    kernel.signals.on('something', heard)
    kernel.signals.emit('something', { ok: true })

    expect(heard).toHaveBeenCalled()
  })

  it('hooks registered before createApp() are still there after it', () => {
    // The idempotence that matters: rebuilding a registry in createApp()
    // would orphan everything registered in between, silently.
    const kernel = makeKernel()
    const handler = vi.fn()
    kernel.hookRegistry.register('some:hook', handler)
    const before = kernel.hookRegistry

    kernel._createHookRegistry()

    expect(kernel.hookRegistry).toBe(before)
    expect(kernel.hookRegistry.hasHook('some:hook')).toBe(true)
  })

  it.each(CONSTRUCTED)('_create* is idempotent for %s', (prop) => {
    const kernel = makeKernel()
    const first = kernel[prop]

    kernel._createSignalBus()
    kernel._createHookRegistry()
    kernel._createZoneRegistry()
    kernel._createDeferredRegistry()
    kernel._createPermissionRegistry()

    expect(kernel[prop]).toBe(first)
  })

  it('core permissions are there, and are not duplicated by a second call', () => {
    const kernel = makeKernel()
    const before = kernel.permissionRegistry.getKeys().length

    kernel._createPermissionRegistry()
    kernel._createPermissionRegistry()

    expect(kernel.permissionRegistry.exists('auth:impersonate')).toBe(true)
    expect(kernel.permissionRegistry.getKeys()).toHaveLength(before)
  })
})

describe('what still cannot exist yet is left alone', () => {
  it.each(['vueApp', 'router', 'moduleLoader', 'orchestrator'])(
    'kernel.%s is still null before createApp()',
    (prop) => {
      // Not an oversight: these need the mounted app. Their answer is to
      // refuse the READ with a message naming the moment, not to fake a value.
      expect(makeKernel()[prop]).toBeNull()
    }
  )
})
