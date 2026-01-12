/**
 * Unit tests for KernelContext
 *
 * Tests the fluent API wrapper for module registration including
 * getter delegation, registration methods, and signal cleanup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KernelContext, createKernelContext } from '../../src/kernel/KernelContext.js'
import { Module } from '../../src/kernel/Module'
import { SignalBus, createSignalBus } from '../../src/kernel/SignalBus'

/**
 * Create a minimal mock kernel for testing
 */
function createMockKernel(overrides = {}) {
  const signals = createSignalBus()
  const zones = {
    defineZone: vi.fn(),
    registerBlock: vi.fn(),
  }
  const hooks = {
    register: vi.fn(),
  }
  const deferred = {
    queue: vi.fn(),
  }
  const orchestrator = {
    register: vi.fn(),
    get: vi.fn(),
  }
  const vueApp = {
    provide: vi.fn(),
    component: vi.fn(),
  }
  const router = {
    push: vi.fn(),
    currentRoute: { value: { name: 'test' } },
  }

  return {
    signals,
    zoneRegistry: zones,
    hookRegistry: hooks,
    deferred,
    orchestrator,
    vueApp,
    router,
    options: {
      debug: false,
      storageResolver: vi.fn(),
      managerResolver: vi.fn(),
      managerRegistry: {},
    },
    // For graceful handling when vueApp is null
    _pendingProvides: new Map(),
    _pendingComponents: new Map(),
    ...overrides,
  }
}

describe('KernelContext', () => {
  describe('factory function', () => {
    it('createKernelContext returns KernelContext instance', () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = createKernelContext(kernel, module)
      expect(ctx).toBeInstanceOf(KernelContext)
    })
  })

  describe('constructor', () => {
    it('stores kernel reference', () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = new KernelContext(kernel, module)
      expect(ctx._kernel).toBe(kernel)
    })

    it('stores module reference', () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = new KernelContext(kernel, module)
      expect(ctx._module).toBe(module)
    })
  })

  describe('getters for kernel services', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('app getter returns vueApp', () => {
      expect(ctx.app).toBe(kernel.vueApp)
    })

    it('router getter returns router', () => {
      expect(ctx.router).toBe(kernel.router)
    })

    it('signals getter returns signals', () => {
      expect(ctx.signals).toBe(kernel.signals)
    })

    it('orchestrator getter returns orchestrator', () => {
      expect(ctx.orchestrator).toBe(kernel.orchestrator)
    })

    it('zones getter returns zoneRegistry', () => {
      expect(ctx.zones).toBe(kernel.zoneRegistry)
    })

    it('hooks getter returns hookRegistry', () => {
      expect(ctx.hooks).toBe(kernel.hookRegistry)
    })

    it('deferred getter returns deferred', () => {
      expect(ctx.deferred).toBe(kernel.deferred)
    })

    it('debug getter returns kernel.options.debug', () => {
      expect(ctx.debug).toBe(false)

      kernel.options.debug = true
      expect(ctx.debug).toBe(true)
    })

    it('debug defaults to false if options missing', () => {
      kernel.options = null
      expect(ctx.debug).toBe(false)
    })
  })

  describe('routes() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
      // Clear any routes from previous tests
      vi.resetModules()
    })

    it('returns this for chaining', () => {
      const result = ctx.routes('test', [])
      expect(result).toBe(ctx)
    })

    it('supports chaining multiple calls', () => {
      const result = ctx
        .routes('users', [])
        .routes('posts', [])
        .routes('comments', [])

      expect(result).toBe(ctx)
    })
  })

  describe('navItem() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('returns this for chaining', () => {
      const result = ctx.navItem({
        section: 'Admin',
        route: 'users',
        icon: 'pi pi-users',
        label: 'Users',
      })
      expect(result).toBe(ctx)
    })
  })

  describe('routeFamily() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('returns this for chaining', () => {
      const result = ctx.routeFamily('users', ['users-', 'user-'])
      expect(result).toBe(ctx)
    })
  })

  describe('zone() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('delegates to zoneRegistry.defineZone', () => {
      ctx.zone('my-zone', { default: {} })

      expect(kernel.zoneRegistry.defineZone).toHaveBeenCalledWith('my-zone', { default: {} })
    })

    it('returns this for chaining', () => {
      const result = ctx.zone('test-zone')
      expect(result).toBe(ctx)
    })

    it('handles missing zoneRegistry gracefully', () => {
      kernel.zoneRegistry = null
      expect(() => ctx.zone('test')).not.toThrow()
    })
  })

  describe('block() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('delegates to zoneRegistry.registerBlock', () => {
      const config = { component: {}, weight: 10 }
      ctx.block('my-zone', config)

      expect(kernel.zoneRegistry.registerBlock).toHaveBeenCalledWith('my-zone', config)
    })

    it('returns this for chaining', () => {
      const result = ctx.block('test-zone', { component: {} })
      expect(result).toBe(ctx)
    })

    it('handles missing zoneRegistry gracefully', () => {
      kernel.zoneRegistry = null
      expect(() => ctx.block('test', {})).not.toThrow()
    })
  })

  describe('provide() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('delegates to vueApp.provide', () => {
      const value = { test: true }
      ctx.provide('myKey', value)

      expect(kernel.vueApp.provide).toHaveBeenCalledWith('myKey', value)
    })

    it('returns this for chaining', () => {
      const result = ctx.provide('key', 'value')
      expect(result).toBe(ctx)
    })

    it('handles missing vueApp gracefully', () => {
      kernel.vueApp = null
      expect(() => ctx.provide('key', 'value')).not.toThrow()
    })

    it('supports symbol keys', () => {
      const key = Symbol('test')
      ctx.provide(key, 'value')

      expect(kernel.vueApp.provide).toHaveBeenCalledWith(key, 'value')
    })
  })

  describe('component() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('delegates to vueApp.component', () => {
      const comp = { template: '<div>test</div>' }
      ctx.component('MyComponent', comp)

      expect(kernel.vueApp.component).toHaveBeenCalledWith('MyComponent', comp)
    })

    it('returns this for chaining', () => {
      const result = ctx.component('Test', {})
      expect(result).toBe(ctx)
    })

    it('handles missing vueApp gracefully', () => {
      kernel.vueApp = null
      expect(() => ctx.component('Test', {})).not.toThrow()
    })
  })

  describe('on() method - signal subscription', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('subscribes to signal via signals.on()', async () => {
      const handler = vi.fn()
      ctx.on('test:signal', handler)

      await kernel.signals.emit('test:signal', { value: 42 })

      expect(handler).toHaveBeenCalled()
    })

    it('passes options to signals.on()', async () => {
      const handler = vi.fn()
      ctx.on('test:signal', handler, { once: true })

      await kernel.signals.emit('test:signal', { first: true })
      await kernel.signals.emit('test:signal', { second: true })

      // Once option should limit to one call
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('returns this for chaining', () => {
      const result = ctx.on('test:signal', () => {})
      expect(result).toBe(ctx)
    })

    it('registers cleanup with module for auto-unsubscribe', () => {
      const handler = vi.fn()
      ctx.on('test:signal', handler)

      expect(module._signalCleanups).toHaveLength(1)
      expect(typeof module._signalCleanups[0]).toBe('function')
    })

    it('cleanup function unsubscribes handler', async () => {
      const handler = vi.fn()
      ctx.on('test:signal', handler)

      // Get the cleanup function and call it
      const cleanup = module._signalCleanups[0]
      cleanup()

      // Handler should not be called after cleanup
      await kernel.signals.emit('test:signal', { value: 1 })
      expect(handler).not.toHaveBeenCalled()
    })

    it('disconnect() unsubscribes all handlers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      ctx.on('signal:one', handler1)
      ctx.on('signal:two', handler2)

      expect(module._signalCleanups).toHaveLength(2)

      await module.disconnect()

      await kernel.signals.emit('signal:one', {})
      await kernel.signals.emit('signal:two', {})

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(module._signalCleanups).toHaveLength(0)
    })

    it('handles missing signals gracefully', () => {
      kernel.signals = null
      expect(() => ctx.on('test', () => {})).not.toThrow()
    })

    it('handles module without _addSignalCleanup gracefully', () => {
      const bareModule = {} // Not a real Module instance
      const bareCtx = new KernelContext(kernel, bareModule)

      expect(() => bareCtx.on('test', () => {})).not.toThrow()
    })
  })

  describe('hook() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('delegates to hookRegistry.register', () => {
      const handler = vi.fn()
      ctx.hook('users:presave', handler, { priority: 10 })

      expect(kernel.hookRegistry.register).toHaveBeenCalledWith(
        'users:presave',
        handler,
        { priority: 10 }
      )
    })

    it('returns this for chaining', () => {
      const result = ctx.hook('test:hook', () => {})
      expect(result).toBe(ctx)
    })

    it('handles missing hookRegistry gracefully', () => {
      kernel.hookRegistry = null
      expect(() => ctx.hook('test', () => {})).not.toThrow()
    })
  })

  describe('defer() method', () => {
    let kernel
    let module
    let ctx

    beforeEach(() => {
      kernel = createMockKernel()
      module = new Module()
      ctx = new KernelContext(kernel, module)
    })

    it('delegates to deferred.queue', () => {
      const factory = vi.fn()
      ctx.defer('users:warmup', factory)

      expect(kernel.deferred.queue).toHaveBeenCalledWith('users:warmup', factory)
    })

    it('returns this for chaining', () => {
      const result = ctx.defer('test', () => {})
      expect(result).toBe(ctx)
    })

    it('handles missing deferred gracefully', () => {
      kernel.deferred = null
      expect(() => ctx.defer('test', () => {})).not.toThrow()
    })
  })

  describe('chaining multiple methods', () => {
    it('supports full fluent chain', () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = new KernelContext(kernel, module)

      const result = ctx
        .zone('users-header')
        .block('users-header', { component: {}, weight: 10 })
        .on('users:created', () => {})
        .hook('users:presave', () => {})
        .defer('users:warmup', () => {})
        .provide('usersService', {})
        .component('UserCard', {})

      expect(result).toBe(ctx)
      expect(kernel.zoneRegistry.defineZone).toHaveBeenCalled()
      expect(kernel.zoneRegistry.registerBlock).toHaveBeenCalled()
      expect(kernel.hookRegistry.register).toHaveBeenCalled()
      expect(kernel.deferred.queue).toHaveBeenCalled()
      expect(kernel.vueApp.provide).toHaveBeenCalled()
      expect(kernel.vueApp.component).toHaveBeenCalled()
      expect(module._signalCleanups).toHaveLength(1)
    })
  })

  describe('real Module subclass integration', () => {
    it('module connect() receives KernelContext with all services', async () => {
      let receivedCtx = null

      class TestModule extends Module {
        static name = 'test'

        async connect(ctx) {
          receivedCtx = ctx
          // Use various context methods
          ctx
            .zone('test-zone')
            .on('test:signal', () => {})
            .hook('test:presave', () => {})
        }
      }

      const kernel = createMockKernel()
      const module = new TestModule()
      const ctx = createKernelContext(kernel, module)

      await module.connect(ctx)

      expect(receivedCtx).toBe(ctx)
      expect(kernel.zoneRegistry.defineZone).toHaveBeenCalledWith('test-zone', {})
      expect(kernel.hookRegistry.register).toHaveBeenCalled()
      expect(module._signalCleanups).toHaveLength(1)
    })

    it('signal handlers are cleaned up on disconnect', async () => {
      const handler = vi.fn()

      class TestModule extends Module {
        static name = 'test'

        async connect(ctx) {
          ctx.on('test:signal', handler)
        }
      }

      const kernel = createMockKernel()
      const module = new TestModule()
      const ctx = createKernelContext(kernel, module)

      await module.connect(ctx)
      expect(module._signalCleanups).toHaveLength(1)

      // Emit before disconnect - handler should be called
      await kernel.signals.emit('test:signal', { before: true })
      expect(handler).toHaveBeenCalledTimes(1)

      // Disconnect
      await module.disconnect()
      expect(module._signalCleanups).toHaveLength(0)

      // Emit after disconnect - handler should NOT be called
      await kernel.signals.emit('test:signal', { after: true })
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, not 2
    })
  })
})
