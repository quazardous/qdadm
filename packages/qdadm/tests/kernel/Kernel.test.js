/**
 * Integration tests for Kernel signal bus integration
 *
 * Tests that Kernel properly creates and wires SignalBus during bootstrap.
 * Note: Full Kernel.createApp() requires many dependencies (PrimeVue, Toast, etc.)
 * so we test the internal methods and signal wiring in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { Kernel } from '../../src/kernel/Kernel.js'
import { SignalBus } from '../../src/kernel/SignalBus.js'
import { EntityManager } from '../../src/entity/EntityManager.js'
import { Module } from '../../src/kernel/Module.js'
import { ModuleLoader } from '../../src/kernel/ModuleLoader.js'

/**
 * Minimal mock components for Kernel bootstrap
 */
const MockLogin = defineComponent({
  name: 'MockLogin',
  setup() {
    return () => h('div', 'Login')
  }
})

const MockLayout = defineComponent({
  name: 'MockLayout',
  setup() {
    return () => h('div', 'Layout')
  }
})

const MockHome = defineComponent({
  name: 'MockHome',
  setup() {
    return () => h('div', 'Home')
  }
})

const MockApp = defineComponent({
  name: 'MockApp',
  setup() {
    return () => h('div', 'App')
  }
})

/**
 * Mock auth adapter for testing
 */
const mockAuthAdapter = {
  isAuthenticated: () => true,
  getCurrentUser: () => ({ id: 1, role: 'admin' })
}

describe('Kernel', () => {
  let kernel

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('signal bus internal creation', () => {
    it('creates SignalBus via _createSignalBus()', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter
      })

      // Before _createSignalBus, signals should be null
      expect(kernel.signals).toBeNull()

      kernel._createSignalBus()

      // After _createSignalBus, signals should be SignalBus instance
      expect(kernel.signals).toBeInstanceOf(SignalBus)
    })

    it('getSignals() returns SignalBus after creation', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter
      })

      kernel._createSignalBus()

      expect(kernel.getSignals()).toBe(kernel.signals)
      expect(kernel.getSignals()).toBeInstanceOf(SignalBus)
    })

    it('respects debug option for SignalBus', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        debug: true
      })

      kernel._createSignalBus()

      // SignalBus should be created with debug mode
      expect(kernel.signals).toBeInstanceOf(SignalBus)
    })
  })

  describe('orchestrator signal wiring', () => {
    it('orchestrator receives signal bus reference', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        managers: {}
      })

      // Simulate createApp flow - internal methods
      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createOrchestrator()

      expect(kernel.orchestrator.signals).toBe(kernel.signals)
    })

    it('managers receive signal bus via orchestrator', () => {
      const booksManager = new EntityManager({ name: 'books' })

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        managers: { books: booksManager }
      })

      // Simulate createApp flow - internal methods
      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createOrchestrator()

      // Manager should have signals reference
      expect(booksManager._signals).toBe(kernel.signals)
    })
  })

  describe('full signal flow integration', () => {
    it('entity manager signals flow through kernel signal bus', async () => {
      const specificHandler = vi.fn()

      // Mock storage for EntityManager
      const mockStorage = {
        create: vi.fn().mockResolvedValue({ id: 1, title: 'Test Book' })
      }

      const booksManager = new EntityManager({
        name: 'books',
        storage: mockStorage
      })

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        managers: { books: booksManager }
      })

      // Simulate createApp flow - internal methods
      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createOrchestrator()

      // Subscribe to generic entity signal
      kernel.signals.on('entity:created', specificHandler)

      // Trigger CRUD operation
      await booksManager.create({ title: 'Test Book' })

      // Handler should have been called with signal
      expect(specificHandler).toHaveBeenCalled()
      const event = specificHandler.mock.calls[0][0]
      expect(event.data.entity).toBe('books')
    })

    it('multiple managers emit signals through same bus', async () => {
      const handler = vi.fn()

      const booksStorage = {
        create: vi.fn().mockResolvedValue({ id: 1, title: 'Book' })
      }

      const usersStorage = {
        create: vi.fn().mockResolvedValue({ id: 1, name: 'User' })
      }

      const booksManager = new EntityManager({
        name: 'books',
        storage: booksStorage
      })

      const usersManager = new EntityManager({
        name: 'users',
        storage: usersStorage
      })

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        managers: { books: booksManager, users: usersManager }
      })

      // Simulate createApp flow - internal methods
      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createOrchestrator()

      // Subscribe to generic entity signal
      kernel.signals.on('entity:created', handler)

      await booksManager.create({ title: 'Book' })
      await usersManager.create({ name: 'User' })

      // Handler called twice with different entity names
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler.mock.calls[0][0].data.entity).toBe('books')
      expect(handler.mock.calls[1][0].data.entity).toBe('users')
    })

    it('CRUD operations emit correct signals', async () => {
      const createdHandler = vi.fn()
      const updatedHandler = vi.fn()
      const deletedHandler = vi.fn()

      const booksStorage = {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
        delete: vi.fn().mockResolvedValue(undefined)
      }

      const booksManager = new EntityManager({
        name: 'books',
        storage: booksStorage
      })

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        managers: { books: booksManager }
      })

      // Simulate createApp flow - internal methods
      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createOrchestrator()

      // Subscribe to generic CRUD signals
      kernel.signals.on('entity:created', createdHandler)
      kernel.signals.on('entity:updated', updatedHandler)
      kernel.signals.on('entity:deleted', deletedHandler)

      await booksManager.create({ title: 'Test' })
      await booksManager.update(1, { title: 'Updated' })
      await booksManager.delete(1)

      // Each CRUD operation triggers its signal with entity in payload
      expect(createdHandler).toHaveBeenCalledTimes(1)
      expect(createdHandler.mock.calls[0][0].data.entity).toBe('books')
      expect(updatedHandler).toHaveBeenCalledTimes(1)
      expect(deletedHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('hook registry integration', () => {
    it('hook registry and signal bus are both created', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter
      })

      // Simulate createApp flow - internal methods
      kernel._createSignalBus()
      kernel._createHookRegistry()

      // Both should exist
      expect(kernel.signals).toBeDefined()
      expect(kernel.hookRegistry).toBeDefined()

      // HookRegistry is created with SignalBus's kernel
      expect(kernel.getHookRegistry()).toBe(kernel.hookRegistry)
    })

    it('hooks property provides shorthand access', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()

      expect(kernel.hooks).toBe(kernel.hookRegistry)
    })
  })

  describe('ModuleLoader integration', () => {
    it('moduleLoader is null by default', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter
      })

      expect(kernel.moduleLoader).toBeNull()
      expect(kernel.getModuleLoader()).toBeNull()
      expect(kernel.modules).toBeNull()
    })

    it('_loadModulesSync() creates ModuleLoader when moduleDefs provided', () => {
      const connectFn = vi.fn()

      class TestModule extends Module {
        static name = 'test'
        connect(ctx) {
          connectFn(ctx)
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        moduleDefs: [TestModule]
      })

      // Setup required services
      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      // Load modules
      kernel._loadModulesSync()

      expect(kernel.moduleLoader).toBeInstanceOf(ModuleLoader)
      expect(kernel.getModuleLoader()).toBe(kernel.moduleLoader)
      expect(kernel.modules).toBe(kernel.moduleLoader)
      expect(connectFn).toHaveBeenCalled()
    })

    it('_loadModulesSync() skips when no moduleDefs', () => {
      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      kernel._loadModulesSync()

      expect(kernel.moduleLoader).toBeNull()
    })

    it('module receives KernelContext with services', () => {
      let receivedCtx = null

      class TestModule extends Module {
        static name = 'test'
        connect(ctx) {
          receivedCtx = ctx
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        moduleDefs: [TestModule]
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      kernel._loadModulesSync()

      // Context should provide access to kernel services
      expect(receivedCtx).not.toBeNull()
      expect(receivedCtx.signals).toBe(kernel.signals)
      expect(receivedCtx.zones).toBe(kernel.zoneRegistry)
      expect(receivedCtx.hooks).toBe(kernel.hookRegistry)
      expect(receivedCtx.deferred).toBe(kernel.deferred)
    })

    it('modules are loaded in dependency order', () => {
      const loadOrder = []

      class ModuleA extends Module {
        static name = 'A'
        static requires = ['B']
        connect() {
          loadOrder.push('A')
        }
      }

      class ModuleB extends Module {
        static name = 'B'
        connect() {
          loadOrder.push('B')
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        moduleDefs: [ModuleA, ModuleB]
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      kernel._loadModulesSync()

      // B should load before A due to dependency
      expect(loadOrder).toEqual(['B', 'A'])
    })

    it('disabled modules are skipped', () => {
      const connectFn = vi.fn()

      class DisabledModule extends Module {
        static name = 'disabled'
        enabled() {
          return false
        }
        connect() {
          connectFn()
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        moduleDefs: [DisabledModule]
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      kernel._loadModulesSync()

      expect(connectFn).not.toHaveBeenCalled()
    })

    it('object-based modules are supported', () => {
      const connectFn = vi.fn()

      const objectModule = {
        name: 'objectModule',
        connect(ctx) {
          connectFn(ctx)
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        moduleDefs: [objectModule]
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      kernel._loadModulesSync()

      expect(connectFn).toHaveBeenCalled()
    })

    it('_loadModules() async version works correctly', async () => {
      const connectFn = vi.fn()

      class AsyncModule extends Module {
        static name = 'async'
        async connect(ctx) {
          await new Promise(resolve => setTimeout(resolve, 10))
          connectFn(ctx)
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        moduleDefs: [AsyncModule]
      })

      kernel._createSignalBus()
      kernel._createHookRegistry()
      kernel._createZoneRegistry()
      kernel._createDeferredRegistry()

      await kernel._loadModules()

      expect(connectFn).toHaveBeenCalled()
      expect(kernel.moduleLoader).toBeInstanceOf(ModuleLoader)
    })

    it('_wireModules() emits kernel:ready signal', () => {
      const readyHandler = vi.fn()

      class TestModule extends Module {
        static name = 'test'
        connect(ctx) {
          ctx.signals.on('kernel:ready', readyHandler)
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        managers: {},
        moduleDefs: [TestModule]
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
      expect(event.data.orchestrator).toBe(kernel.orchestrator)
      expect(event.data.kernel).toBe(kernel)
    })

    it('legacy modules and new modules coexist', () => {
      const legacyInitFn = vi.fn()
      const newConnectFn = vi.fn()

      const legacyModules = {
        './test/init.js': {
          init: legacyInitFn
        }
      }

      class NewModule extends Module {
        static name = 'new'
        connect(ctx) {
          newConnectFn(ctx)
        }
      }

      kernel = new Kernel({
        root: MockApp,
        pages: { login: MockLogin, layout: MockLayout },
        homeRoute: { name: 'home', component: MockHome },
        authAdapter: mockAuthAdapter,
        modules: legacyModules,
        moduleDefs: [NewModule]
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
})
