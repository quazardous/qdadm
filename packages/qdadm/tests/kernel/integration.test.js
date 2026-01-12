/**
 * Integration tests for Module System v2
 *
 * Tests the complete flow of module discovery, loading, context delegation,
 * signal cleanup, error handling, and multi-module dependency scenarios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { Module } from '../../src/kernel/Module'
import {
  ModuleLoader,
  createModuleLoader,
  ModuleNotFoundError,
  CircularDependencyError,
  ModuleLoadError,
} from '../../src/kernel/ModuleLoader'
import { KernelContext, createKernelContext } from '../../src/kernel/KernelContext'
import { createSignalBus } from '../../src/kernel/SignalBus'
import { Kernel } from '../../src/kernel/Kernel'
import { EntityManager } from '../../src/entity/EntityManager'

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MockLogin = defineComponent({
  name: 'MockLogin',
  setup() {
    return () => h('div', 'Login')
  },
})

const MockLayout = defineComponent({
  name: 'MockLayout',
  setup() {
    return () => h('div', 'Layout')
  },
})

const MockHome = defineComponent({
  name: 'MockHome',
  setup() {
    return () => h('div', 'Home')
  },
})

const MockApp = defineComponent({
  name: 'MockApp',
  setup() {
    return () => h('div', 'App')
  },
})

const mockAuthAdapter = {
  isAuthenticated: () => true,
  getCurrentUser: () => ({ id: 1, role: 'admin' }),
}

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
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Lifecycle Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Module System Integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Module lifecycle', () => {
    it('enabled() returning false skips module', async () => {
      const connectFn = vi.fn()

      class DisabledModule extends Module {
        static moduleName = 'disabled'
        enabled() {
          return false
        }
        async connect(ctx) {
          connectFn(ctx)
        }
      }

      class EnabledModule extends Module {
        static moduleName = 'enabled'
        async connect(ctx) {
          connectFn(ctx)
        }
      }

      const loader = createModuleLoader()
      loader.add(DisabledModule)
      loader.add(EnabledModule)

      await loader.loadAll({})

      // Only enabled module should have connect() called
      expect(connectFn).toHaveBeenCalledTimes(1)
      expect(loader.getModules().has('enabled')).toBe(true)
      expect(loader.getModules().has('disabled')).toBe(false)
    })

    it('enabled() receives context parameter', async () => {
      let receivedCtx = null

      class ContextAwareModule extends Module {
        static moduleName = 'context-aware'
        enabled(ctx) {
          receivedCtx = ctx
          return ctx.isDev === true
        }
        async connect() {}
      }

      const loader = createModuleLoader()
      loader.add(ContextAwareModule)

      // Should be disabled when isDev is false
      await loader.loadAll({ isDev: false })
      expect(receivedCtx).toEqual({ isDev: false })
      expect(loader.getModules().has('context-aware')).toBe(false)

      // Reset and try again with isDev true
      const loader2 = createModuleLoader()
      loader2.add(ContextAwareModule)
      await loader2.loadAll({ isDev: true })
      expect(loader2.getModules().has('context-aware')).toBe(true)
    })

    it('connect() receives proper context', async () => {
      let receivedCtx = null

      class ReceivingModule extends Module {
        static moduleName = 'receiving'
        async connect(ctx) {
          receivedCtx = ctx
        }
      }

      const loader = createModuleLoader()
      loader.add(ReceivingModule)

      const context = {
        signals: createSignalBus(),
        zones: {},
        hooks: {},
        isDev: true,
      }

      await loader.loadAll(context)

      expect(receivedCtx).toBe(context)
    })

    it('disconnect() cleans up signals', async () => {
      const signalHandler = vi.fn()

      class SignalModule extends Module {
        static moduleName = 'signal-module'

        async connect(ctx) {
          // Simulate KernelContext behavior
          const cleanup = () => {} // In real usage, this would unsubscribe
          this._addSignalCleanup(cleanup)
          this._addSignalCleanup(signalHandler)
        }
      }

      const module = new SignalModule()
      await module.connect({})

      expect(module._signalCleanups).toHaveLength(2)

      await module.disconnect()

      expect(module._signalCleanups).toHaveLength(0)
      expect(signalHandler).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Duck Typing Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Duck typing - multiple module formats', () => {
    it('Class-based modules work correctly', async () => {
      const connectFn = vi.fn()

      class ClassModule extends Module {
        static moduleName = 'class-module'
        static requires = []
        static priority = 10

        async connect(ctx) {
          connectFn(ctx)
        }
      }

      const loader = createModuleLoader()
      loader.add(ClassModule)
      await loader.loadAll({})

      expect(connectFn).toHaveBeenCalled()
      expect(loader.getModules().has('class-module')).toBe(true)
    })

    it('Object-based modules work correctly', async () => {
      const connectFn = vi.fn()

      const objectModule = {
        name: 'object-module',
        requires: [],
        priority: 5,
        connect(ctx) {
          connectFn(ctx)
        },
      }

      const loader = createModuleLoader()
      loader.add(objectModule)
      await loader.loadAll({})

      expect(connectFn).toHaveBeenCalled()
      expect(loader.getModules().has('object-module')).toBe(true)
    })

    it('Legacy function modules work correctly', async () => {
      const initFn = vi.fn()

      function legacyModule({ registry, zones, ctx }) {
        initFn({ registry, zones, ctx })
      }

      const loader = createModuleLoader()
      loader.add(legacyModule)

      const ctx = {
        routes: vi.fn().mockReturnThis(),
        navItem: vi.fn().mockReturnThis(),
        routeFamily: vi.fn().mockReturnThis(),
        zones: {},
      }

      await loader.loadAll(ctx)

      expect(initFn).toHaveBeenCalled()
      expect(loader.getModules().has('legacyModule')).toBe(true)
    })

    it('Mixed formats in same app work correctly', async () => {
      const order = []

      class ClassModule extends Module {
        static moduleName = 'class'
        static priority = 0
        async connect() {
          order.push('class')
        }
      }

      const objectModule = {
        name: 'object',
        priority: 10,
        connect() {
          order.push('object')
        },
      }

      function legacyInit() {
        order.push('legacy')
      }

      const loader = createModuleLoader()
      loader.add(ClassModule)
      loader.add(objectModule)
      loader.add(legacyInit)

      const ctx = {
        routes: vi.fn().mockReturnThis(),
        navItem: vi.fn().mockReturnThis(),
        routeFamily: vi.fn().mockReturnThis(),
        zones: {},
      }

      await loader.loadAll(ctx)

      expect(order).toContain('class')
      expect(order).toContain('object')
      expect(order).toContain('legacy')
      expect(loader.getModules().size).toBe(3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Dependencies', () => {
    it('Simple dependency chain loads in correct order', async () => {
      const order = []

      class ConfigModule extends Module {
        static moduleName = 'config'
        async connect() {
          order.push('config')
        }
      }

      class AuthModule extends Module {
        static moduleName = 'auth'
        static requires = ['config']
        async connect() {
          order.push('auth')
        }
      }

      class UsersModule extends Module {
        static moduleName = 'users'
        static requires = ['auth']
        async connect() {
          order.push('users')
        }
      }

      const loader = createModuleLoader()
      loader.add(UsersModule)
      loader.add(ConfigModule)
      loader.add(AuthModule)

      await loader.loadAll({})

      expect(order).toEqual(['config', 'auth', 'users'])
    })

    it('Diamond dependencies load correctly', async () => {
      const order = []

      // Diamond pattern:
      //       A
      //      / \
      //     B   C
      //      \ /
      //       D

      class ModuleA extends Module {
        static moduleName = 'A'
        async connect() {
          order.push('A')
        }
      }

      class ModuleB extends Module {
        static moduleName = 'B'
        static requires = ['A']
        async connect() {
          order.push('B')
        }
      }

      class ModuleC extends Module {
        static moduleName = 'C'
        static requires = ['A']
        async connect() {
          order.push('C')
        }
      }

      class ModuleD extends Module {
        static moduleName = 'D'
        static requires = ['B', 'C']
        async connect() {
          order.push('D')
        }
      }

      const loader = createModuleLoader()
      loader.add(ModuleD)
      loader.add(ModuleB)
      loader.add(ModuleC)
      loader.add(ModuleA)

      await loader.loadAll({})

      // A must come before B and C
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
      expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'))
      // B and C must come before D
      expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'))
      expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'))
    })

    it('Circular dependency is detected', async () => {
      class ModuleA extends Module {
        static moduleName = 'A'
        static requires = ['B']
        async connect() {}
      }

      class ModuleB extends Module {
        static moduleName = 'B'
        static requires = ['A']
        async connect() {}
      }

      const loader = createModuleLoader()
      loader.add(ModuleA)
      loader.add(ModuleB)

      await expect(loader.loadAll({})).rejects.toThrow(CircularDependencyError)
    })

    it('Indirect circular dependency is detected', async () => {
      class ModuleA extends Module {
        static moduleName = 'A'
        static requires = ['B']
        async connect() {}
      }

      class ModuleB extends Module {
        static moduleName = 'B'
        static requires = ['C']
        async connect() {}
      }

      class ModuleC extends Module {
        static moduleName = 'C'
        static requires = ['A']
        async connect() {}
      }

      const loader = createModuleLoader()
      loader.add(ModuleA)
      loader.add(ModuleB)
      loader.add(ModuleC)

      await expect(loader.loadAll({})).rejects.toThrow(CircularDependencyError)
    })

    it('Missing dependency throws ModuleNotFoundError', async () => {
      class DependentModule extends Module {
        static moduleName = 'dependent'
        static requires = ['nonexistent']
        async connect() {}
      }

      const loader = createModuleLoader()
      loader.add(DependentModule)

      await expect(loader.loadAll({})).rejects.toThrow(ModuleNotFoundError)
    })

    it('Missing dependency error contains details', async () => {
      class DependentModule extends Module {
        static moduleName = 'dependent'
        static requires = ['missing-module']
        async connect() {}
      }

      const loader = createModuleLoader()
      loader.add(DependentModule)

      try {
        await loader.loadAll({})
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleNotFoundError)
        expect(err.moduleName).toBe('missing-module')
        expect(err.requiredBy).toBe('dependent')
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // KernelContext Delegation Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('KernelContext delegation', () => {
    it('entity() creates managers via orchestrator', () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = createKernelContext(kernel, module)

      // entity() needs managerFactory which needs storageResolver
      // This is a lightweight test - full factory tests are elsewhere
      expect(typeof ctx.entity).toBe('function')
    })

    it('routes() delegates to registry', () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = createKernelContext(kernel, module)

      // routes() returns this for chaining
      const result = ctx.routes('test', [])
      expect(result).toBe(ctx)
    })

    it('navItem() delegates to registry', () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = createKernelContext(kernel, module)

      const result = ctx.navItem({ section: 'Test', route: 'test' })
      expect(result).toBe(ctx)
    })

    it('on() registers with cleanup', async () => {
      const kernel = createMockKernel()
      const module = new Module()
      const ctx = createKernelContext(kernel, module)

      const handler = vi.fn()
      ctx.on('test:signal', handler)

      expect(module._signalCleanups).toHaveLength(1)

      // Signal should work
      await kernel.signals.emit('test:signal', { value: 1 })
      expect(handler).toHaveBeenCalled()

      // Cleanup should unsubscribe
      await module.disconnect()
      handler.mockClear()

      await kernel.signals.emit('test:signal', { value: 2 })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Kernel Integration Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Kernel integration', () => {
    it('moduleDefs option works', () => {
      const connectFn = vi.fn()

      class TestModule extends Module {
        static moduleName = 'test'
        connect(ctx) {
          connectFn(ctx)
        }
      }

      const kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        moduleDefs: [TestModule],
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()
      kernel._loadModulesSync()

      expect(connectFn).toHaveBeenCalled()
      expect(kernel.moduleLoader).not.toBeNull()
    })

    it('kernel:ready signal emitted after orchestrator created', () => {
      const readyHandler = vi.fn()

      class TestModule extends Module {
        static moduleName = 'test'
        connect(ctx) {
          ctx.signals.on('kernel:ready', readyHandler)
        }
      }

      const kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        managers: {},
        moduleDefs: [TestModule],
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()
      kernel._loadModulesSync()
      kernel._createOrchestrator()
      kernel._wireModules()

      expect(readyHandler).toHaveBeenCalled()
      const event = readyHandler.mock.calls[0][0]
      // Note: kernel:ready payload is minimal { ready: true } to avoid cyclic references
      // Modules access kernel/orchestrator via their stored context from connect()
      expect(event.data.ready).toBe(true)
      expect(kernel.orchestrator).toBeDefined()
    })

    it('Legacy and new modules coexist', () => {
      const legacyInitFn = vi.fn()
      const newConnectFn = vi.fn()

      const legacyModules = {
        './test/init.js': {
          init: legacyInitFn,
        },
      }

      class NewModule extends Module {
        static moduleName = 'new'
        connect(ctx) {
          newConnectFn(ctx)
        }
      }

      const kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        modules: legacyModules,
        moduleDefs: [NewModule],
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      // Load legacy modules
      kernel._initModules()
      expect(legacyInitFn).toHaveBeenCalled()

      // Load new modules
      kernel._loadModulesSync()
      expect(newConnectFn).toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Signal Cleanup Integration Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Signal cleanup on module disconnect', () => {
    it('Multiple signal handlers are cleaned up', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      class MultiSignalModule extends Module {
        static moduleName = 'multi-signal'

        async connect(ctx) {
          // Simulate KernelContext.on() behavior
          const signals = ctx.signals
          const unsub1 = signals.on('event:one', handler1)
          const unsub2 = signals.on('event:two', handler2)
          const unsub3 = signals.on('event:three', handler3)

          this._addSignalCleanup(unsub1)
          this._addSignalCleanup(unsub2)
          this._addSignalCleanup(unsub3)
        }
      }

      const signals = createSignalBus()
      const module = new MultiSignalModule()

      await module.connect({ signals })

      // Verify handlers work
      await signals.emit('event:one', {})
      await signals.emit('event:two', {})
      await signals.emit('event:three', {})
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)

      // Disconnect should clean up all
      await module.disconnect()

      // Reset and emit again
      handler1.mockClear()
      handler2.mockClear()
      handler3.mockClear()

      await signals.emit('event:one', {})
      await signals.emit('event:two', {})
      await signals.emit('event:three', {})

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(handler3).not.toHaveBeenCalled()
    })

    it('unloadAll() disconnects in reverse order', async () => {
      const order = []

      class ModuleA extends Module {
        static moduleName = 'A'
        async disconnect() {
          order.push('A')
        }
      }

      class ModuleB extends Module {
        static moduleName = 'B'
        static requires = ['A']
        async disconnect() {
          order.push('B')
        }
      }

      class ModuleC extends Module {
        static moduleName = 'C'
        static requires = ['B']
        async disconnect() {
          order.push('C')
        }
      }

      const loader = createModuleLoader()
      loader.add(ModuleC)
      loader.add(ModuleB)
      loader.add(ModuleA)

      await loader.loadAll({})
      await loader.unloadAll()

      // Should unload in reverse order: C, B, A
      expect(order).toEqual(['C', 'B', 'A'])
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Error handling across components', () => {
    it('ModuleLoadError when connect() throws', async () => {
      class FailingModule extends Module {
        static moduleName = 'failing'
        async connect() {
          throw new Error('Connection failed')
        }
      }

      const loader = createModuleLoader()
      loader.add(FailingModule)

      await expect(loader.loadAll({})).rejects.toThrow(ModuleLoadError)
    })

    it('ModuleLoadError contains original error', async () => {
      const originalError = new Error('Original failure')

      class FailingModule extends Module {
        static moduleName = 'failing'
        async connect() {
          throw originalError
        }
      }

      const loader = createModuleLoader()
      loader.add(FailingModule)

      try {
        await loader.loadAll({})
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ModuleLoadError)
        expect(err.moduleName).toBe('failing')
        expect(err.cause).toBe(originalError)
      }
    })

    it('CircularDependencyError contains cycle path', async () => {
      class ModuleA extends Module {
        static moduleName = 'A'
        static requires = ['B']
      }

      class ModuleB extends Module {
        static moduleName = 'B'
        static requires = ['C']
      }

      class ModuleC extends Module {
        static moduleName = 'C'
        static requires = ['A']
      }

      const loader = createModuleLoader()
      loader.add(ModuleA)
      loader.add(ModuleB)
      loader.add(ModuleC)

      try {
        await loader.loadAll({})
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(CircularDependencyError)
        expect(err.cycle).toBeDefined()
        expect(err.cycle.length).toBeGreaterThan(1)
        expect(err.message).toContain('→')
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Complex Multi-Module Scenarios
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Multi-module dependency graph scenarios', () => {
    it('Complex dependency graph with priorities', async () => {
      const order = []

      // Complex graph:
      // core (priority 0) → config (priority 0, requires core)
      //                   → auth (priority 10, requires config)
      //                   → api (priority 20, requires auth)
      // ui (priority 50) → admin (priority 60, requires ui, api)

      class CoreModule extends Module {
        static moduleName = 'core'
        static priority = 0
        async connect() {
          order.push('core')
        }
      }

      class ConfigModule extends Module {
        static moduleName = 'config'
        static requires = ['core']
        static priority = 0
        async connect() {
          order.push('config')
        }
      }

      class AuthModule extends Module {
        static moduleName = 'auth'
        static requires = ['config']
        static priority = 10
        async connect() {
          order.push('auth')
        }
      }

      class ApiModule extends Module {
        static moduleName = 'api'
        static requires = ['auth']
        static priority = 20
        async connect() {
          order.push('api')
        }
      }

      class UiModule extends Module {
        static moduleName = 'ui'
        static priority = 50
        async connect() {
          order.push('ui')
        }
      }

      class AdminModule extends Module {
        static moduleName = 'admin'
        static requires = ['ui', 'api']
        static priority = 60
        async connect() {
          order.push('admin')
        }
      }

      const loader = createModuleLoader()
      // Add in random order
      loader.add(AdminModule)
      loader.add(CoreModule)
      loader.add(ApiModule)
      loader.add(UiModule)
      loader.add(AuthModule)
      loader.add(ConfigModule)

      await loader.loadAll({})

      // Verify dependency order constraints
      expect(order.indexOf('core')).toBeLessThan(order.indexOf('config'))
      expect(order.indexOf('config')).toBeLessThan(order.indexOf('auth'))
      expect(order.indexOf('auth')).toBeLessThan(order.indexOf('api'))
      expect(order.indexOf('ui')).toBeLessThan(order.indexOf('admin'))
      expect(order.indexOf('api')).toBeLessThan(order.indexOf('admin'))

      expect(order).toHaveLength(6)
    })

    it('Disabled modules do not break dependency chain', async () => {
      const order = []

      class ModuleA extends Module {
        static moduleName = 'A'
        async connect() {
          order.push('A')
        }
      }

      class ModuleB extends Module {
        static moduleName = 'B'
        static requires = ['A']
        enabled() {
          return false // Disabled
        }
        async connect() {
          order.push('B')
        }
      }

      class ModuleC extends Module {
        static moduleName = 'C'
        static requires = ['A'] // Does NOT require B
        async connect() {
          order.push('C')
        }
      }

      const loader = createModuleLoader()
      loader.add(ModuleA)
      loader.add(ModuleB)
      loader.add(ModuleC)

      await loader.loadAll({})

      expect(order).toEqual(['A', 'C'])
      expect(loader.getModules().has('B')).toBe(false)
    })

    it('Async connect() methods work correctly', async () => {
      const order = []

      class AsyncModuleA extends Module {
        static moduleName = 'async-a'
        async connect() {
          await new Promise((resolve) => setTimeout(resolve, 20))
          order.push('A')
        }
      }

      class AsyncModuleB extends Module {
        static moduleName = 'async-b'
        static requires = ['async-a']
        async connect() {
          await new Promise((resolve) => setTimeout(resolve, 10))
          order.push('B')
        }
      }

      const loader = createModuleLoader()
      loader.add(AsyncModuleB)
      loader.add(AsyncModuleA)

      await loader.loadAll({})

      // Despite different delays, order should be preserved
      expect(order).toEqual(['A', 'B'])
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Full Lifecycle Integration Test
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Full lifecycle integration', () => {
    it('Complete module lifecycle from load to unload', async () => {
      const lifecycle = []
      const signals = createSignalBus()

      class TestModule extends Module {
        static moduleName = 'lifecycle-test'

        async connect(ctx) {
          lifecycle.push('connect')

          // Register signal handler
          const unsub = ctx.signals.on('test:event', () => {
            lifecycle.push('signal-received')
          })
          this._addSignalCleanup(unsub)

          lifecycle.push('connected')
        }

        async disconnect() {
          lifecycle.push('disconnecting')
          await super.disconnect()
          lifecycle.push('disconnected')
        }
      }

      const loader = createModuleLoader()
      loader.add(TestModule)

      // Load
      await loader.loadAll({ signals })
      expect(lifecycle).toEqual(['connect', 'connected'])

      // Signal works
      await signals.emit('test:event', {})
      expect(lifecycle).toContain('signal-received')

      // Unload
      await loader.unloadAll()
      expect(lifecycle).toContain('disconnecting')
      expect(lifecycle).toContain('disconnected')

      // Signal no longer works
      const countBefore = lifecycle.filter((e) => e === 'signal-received').length
      await signals.emit('test:event', {})
      const countAfter = lifecycle.filter((e) => e === 'signal-received').length
      expect(countAfter).toBe(countBefore) // No new signal received
    })
  })
})
