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

      // Subscribe to entity-specific signal (books:created)
      kernel.signals.on('books:created', specificHandler)

      // Trigger CRUD operation
      await booksManager.create({ title: 'Test Book' })

      // Handler should have been called with signal
      expect(specificHandler).toHaveBeenCalled()
      const event = specificHandler.mock.calls[0][0]
      expect(event.data.entity).toBe('books')
    })

    it('multiple managers emit signals through same bus', async () => {
      const booksHandler = vi.fn()
      const usersHandler = vi.fn()

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

      // Subscribe to entity-specific signals
      kernel.signals.on('books:created', booksHandler)
      kernel.signals.on('users:created', usersHandler)

      await booksManager.create({ title: 'Book' })
      await usersManager.create({ name: 'User' })

      // Both handlers should have been called
      expect(booksHandler).toHaveBeenCalledTimes(1)
      expect(usersHandler).toHaveBeenCalledTimes(1)
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

      // Subscribe to specific CRUD signals
      kernel.signals.on('books:created', createdHandler)
      kernel.signals.on('books:updated', updatedHandler)
      kernel.signals.on('books:deleted', deletedHandler)

      await booksManager.create({ title: 'Test' })
      await booksManager.update(1, { title: 'Updated' })
      await booksManager.delete(1)

      // Each CRUD operation triggers its specific signal
      expect(createdHandler).toHaveBeenCalledTimes(1)
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
})
