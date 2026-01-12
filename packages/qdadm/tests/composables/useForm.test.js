/**
 * Unit tests for useForm composable - form:alter hook
 *
 * Tests for form:alter hook invocation and configuration modification.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useForm } from '../../src/composables/useForm.js'
import { createHookRegistry } from '../../src/hooks/HookRegistry'

// Mock route state that can be changed per test
let mockRouteState = { name: 'book-create', params: {}, query: {} }

// Mock vue-router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn()
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRouteState,
  onBeforeRouteLeave: vi.fn()
}))

// Mock primevue
const mockToast = { add: vi.fn() }

vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast
}))

// Mock EntityManager
function createMockManager(options = {}) {
  return {
    name: 'books',
    label: 'Book',
    labelPlural: 'Books',
    routePrefix: 'book',
    idField: 'id',
    getInitialData: () => ({ title: '', author: '' }),
    getEntityLabel: (entity) => entity?.title || null,
    getFormFields: () => [
      { name: 'title', type: 'text', label: 'Title', required: true },
      { name: 'author', type: 'text', label: 'Author' }
    ],
    get: vi.fn().mockResolvedValue({ id: 1, title: 'Test Book', author: 'Test Author' }),
    create: vi.fn().mockResolvedValue({ id: 2, title: 'New Book', author: 'New Author' }),
    update: vi.fn().mockResolvedValue({ id: 1, title: 'Updated Book', author: 'Test Author' }),
    patch: vi.fn().mockResolvedValue({ id: 1, title: 'Patched Book', author: 'Test Author' }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...options
  }
}

// Mock orchestrator
let mockManager = createMockManager()
const mockOrchestrator = {
  get: vi.fn(() => mockManager)
}

// Helper to create a wrapper component for testing composable
function createWrapper(composableFactory, hooksInstance = null) {
  let result
  const TestComponent = {
    template: '<div></div>',
    setup() {
      result = composableFactory()
      return result
    }
  }

  const provide = {
    qdadmOrchestrator: mockOrchestrator
  }

  if (hooksInstance) {
    provide.qdadmHooks = hooksInstance
  }

  const wrapper = mount(TestComponent, {
    global: { provide }
  })

  return { wrapper, result }
}

describe('useForm - form:alter hook', () => {
  let mockHookRegistry

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteState = { name: 'book-create', params: {}, query: {} }
    mockManager = createMockManager()
    mockOrchestrator.get.mockImplementation(() => mockManager)
    mockHookRegistry = createHookRegistry()
  })

  afterEach(() => {
    if (mockHookRegistry) {
      mockHookRegistry.dispose()
    }
    vi.restoreAllMocks()
  })

  describe('hook invocation', () => {
    it('returns alteredFields and hooksInvoked in API', async () => {
      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      expect(result).toHaveProperty('alteredFields')
      expect(result).toHaveProperty('hooksInvoked')
      expect(result).toHaveProperty('invokeFormAlterHook')
    })

    it('invokes form:alter hook on load in create mode', async () => {
      const hookHandler = vi.fn((config) => config)
      mockHookRegistry.register('form:alter', hookHandler)

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      expect(hookHandler).toHaveBeenCalled()
      expect(result.hooksInvoked.value).toBe(true)
    })

    it('invokes form:alter hook on load in edit mode', async () => {
      const hookHandler = vi.fn((config) => config)
      mockHookRegistry.register('form:alter', hookHandler)

      mockRouteState = { name: 'book-edit', params: { id: '1' } }

      const { result } = createWrapper(
        () => useForm({
          entity: 'books',
          getId: () => '1'
        }),
        mockHookRegistry
      )

      await flushPromises()

      expect(hookHandler).toHaveBeenCalled()
      expect(result.hooksInvoked.value).toBe(true)
    })

    it('passes correct config snapshot to hook', async () => {
      const hookHandler = vi.fn((config) => config)
      mockHookRegistry.register('form:alter', hookHandler)

      mockRouteState = { name: 'book-edit', params: { id: '1' } }

      const { result } = createWrapper(
        () => useForm({
          entity: 'books',
          getId: () => '1'
        }),
        mockHookRegistry
      )

      await flushPromises()

      expect(hookHandler).toHaveBeenCalled()
      const config = hookHandler.mock.calls[0][0]

      expect(config.entity).toBe('books')
      expect(config.fields).toBeDefined()
      expect(Array.isArray(config.fields)).toBe(true)
      expect(config.isEdit).toBe(true)
      expect(config.entityId).toBe('1')
      expect(config.form).toBeDefined()
      expect(config.manager).toBe(mockManager)
    })

    it('passes isEdit:false in create mode', async () => {
      const hookHandler = vi.fn((config) => config)
      mockHookRegistry.register('form:alter', hookHandler)

      mockRouteState = { name: 'book-create', params: {} }

      createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      const config = hookHandler.mock.calls[0][0]
      expect(config.isEdit).toBe(false)
      expect(config.entityId).toBeNull()
    })
  })

  describe('entity-specific hook', () => {
    it('invokes entity-specific hook after generic hook', async () => {
      const callOrder = []

      mockHookRegistry.register('form:alter', (config) => {
        callOrder.push('form:alter')
        return config
      })

      mockHookRegistry.register('books:form:alter', (config) => {
        callOrder.push('books:form:alter')
        return config
      })

      mockRouteState = { name: 'book-create', params: {} }

      createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      expect(callOrder).toEqual(['form:alter', 'books:form:alter'])
    })

    it('does not invoke non-matching entity hooks', async () => {
      const booksHandler = vi.fn((config) => config)
      const usersHandler = vi.fn((config) => config)

      mockHookRegistry.register('books:form:alter', booksHandler)
      mockHookRegistry.register('users:form:alter', usersHandler)

      mockRouteState = { name: 'book-create', params: {} }

      createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      expect(booksHandler).toHaveBeenCalled()
      expect(usersHandler).not.toHaveBeenCalled()
    })
  })

  describe('field modification', () => {
    it('hook can add fields to config', async () => {
      mockHookRegistry.register('form:alter', (config) => {
        config.fields.push({ name: 'custom', type: 'text', label: 'Custom Field' })
        return config
      })

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      expect(result.alteredFields.value).toHaveLength(3)
      expect(result.alteredFields.value.find(f => f.name === 'custom')).toBeDefined()
    })

    it('hook can remove fields from config', async () => {
      mockHookRegistry.register('form:alter', (config) => {
        config.fields = config.fields.filter(f => f.name !== 'author')
        return config
      })

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      expect(result.alteredFields.value).toHaveLength(1)
      expect(result.alteredFields.value.find(f => f.name === 'author')).toBeUndefined()
    })

    it('hook can modify field properties', async () => {
      mockHookRegistry.register('form:alter', (config) => {
        const titleField = config.fields.find(f => f.name === 'title')
        if (titleField) {
          titleField.label = 'Book Title'
          titleField.placeholder = 'Enter book title'
        }
        return config
      })

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      const titleField = result.alteredFields.value.find(f => f.name === 'title')
      expect(titleField.label).toBe('Book Title')
      expect(titleField.placeholder).toBe('Enter book title')
    })

    it('entity-specific hook receives output of generic hook', async () => {
      mockHookRegistry.register('form:alter', (config) => {
        config.fields.push({ name: 'fromGeneric', type: 'text' })
        return config
      })

      mockHookRegistry.register('books:form:alter', (config) => {
        // Should see field added by generic hook
        const genericField = config.fields.find(f => f.name === 'fromGeneric')
        if (genericField) {
          genericField.label = 'Modified by entity hook'
        }
        return config
      })

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      const field = result.alteredFields.value.find(f => f.name === 'fromGeneric')
      expect(field).toBeDefined()
      expect(field.label).toBe('Modified by entity hook')
    })
  })

  describe('conditional modification', () => {
    it('hook can conditionally modify based on isEdit', async () => {
      mockHookRegistry.register('form:alter', (config) => {
        if (!config.isEdit) {
          // Remove internal_id in create mode
          config.fields = config.fields.filter(f => f.name !== 'internal_id')
        }
        return config
      })

      // Setup manager with internal_id field
      mockManager = createMockManager({
        getFormFields: () => [
          { name: 'title', type: 'text' },
          { name: 'internal_id', type: 'text' }
        ]
      })

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      expect(result.alteredFields.value.find(f => f.name === 'internal_id')).toBeUndefined()
    })

    it('hook can conditionally modify based on form data', async () => {
      mockHookRegistry.register('form:alter', (config) => {
        // Add validation based on form data
        if (config.form.title === 'Special') {
          config.fields.push({ name: 'specialField', type: 'text', required: true })
        }
        return config
      })

      mockRouteState = { name: 'book-edit', params: { id: '1' } }

      // Mock get to return form with special title
      mockManager.get.mockResolvedValue({ id: 1, title: 'Special', author: 'Author' })

      const { result } = createWrapper(
        () => useForm({
          entity: 'books',
          getId: () => '1'
        }),
        mockHookRegistry
      )

      await flushPromises()

      expect(result.alteredFields.value.find(f => f.name === 'specialField')).toBeDefined()
    })
  })

  describe('priority handling', () => {
    it('respects hook priority order', async () => {
      const order = []

      mockHookRegistry.register('form:alter', (config) => {
        order.push('low')
        config.fields.push({ name: 'low', order: order.length })
        return config
      }, { priority: 25 })

      mockHookRegistry.register('form:alter', (config) => {
        order.push('high')
        config.fields.push({ name: 'high', order: order.length })
        return config
      }, { priority: 75 })

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      // Higher priority runs first
      expect(order).toEqual(['high', 'low'])
    })
  })

  describe('error resilience', () => {
    it('works without hooks registry', async () => {
      mockRouteState = { name: 'book-create', params: {} }

      // No hooks provided
      const { result } = createWrapper(
        () => useForm({ entity: 'books' })
      )

      await flushPromises()

      // Should not throw, alteredFields should be empty
      expect(result.alteredFields.value).toEqual([])
      expect(result.hooksInvoked.value).toBe(false)
    })

    it('works when manager has no getFormFields', async () => {
      mockManager = createMockManager()
      delete mockManager.getFormFields

      mockRouteState = { name: 'book-create', params: {} }

      const { result } = createWrapper(
        () => useForm({ entity: 'books' }),
        mockHookRegistry
      )

      await flushPromises()

      // Should not throw
      expect(result.hooksInvoked.value).toBe(true)
      expect(result.alteredFields.value).toEqual([])
    })
  })
})
