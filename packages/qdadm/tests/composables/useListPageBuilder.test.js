/**
 * Unit tests for useListPageBuilder composable - Permission features
 *
 * Tests for permission-aware UI rendering via AuthAdapter
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useListPageBuilder } from '../../src/composables/useListPageBuilder.js'

// Mock route state that can be changed per test
let mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }

// Mock vue-router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn()
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRouteState
}))

// Mock primevue
const mockToast = { add: vi.fn() }
const mockConfirm = { require: vi.fn() }

vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast
}))

vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => mockConfirm
}))

// Mock EntityManager
function createMockManager(options = {}) {
  return {
    name: 'books',
    label: 'Book',
    labelPlural: 'Books',
    routePrefix: 'book',
    idField: 'id',
    localFilterThreshold: 100,
    getListFields: () => [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'author', type: 'text', label: 'Author' }
    ],
    list: vi.fn().mockResolvedValue({
      items: [
        { id: 1, title: 'Book 1', author: 'Author 1' },
        { id: 2, title: 'Book 2', author: 'Author 2' }
      ],
      total: 2
    }),
    query: vi.fn().mockResolvedValue({
      items: [
        { id: 1, title: 'Book 1', author: 'Author 1' },
        { id: 2, title: 'Book 2', author: 'Author 2' }
      ],
      total: 2,
      fromCache: false
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    invalidateCache: vi.fn(),
    canCreate: vi.fn().mockReturnValue(options.canCreate ?? true),
    canUpdate: vi.fn().mockImplementation((row) => {
      if (typeof options.canUpdate === 'function') return options.canUpdate(row)
      return options.canUpdate ?? true
    }),
    canDelete: vi.fn().mockImplementation((row) => {
      if (typeof options.canDelete === 'function') return options.canDelete(row)
      return options.canDelete ?? true
    }),
    ...options
  }
}

// Mock orchestrator
let mockManager = createMockManager()
const mockOrchestrator = {
  get: vi.fn(() => mockManager)
}

// Helper to create a wrapper component for testing composable
function createWrapper(composableFactory) {
  let result
  const TestComponent = {
    template: '<div></div>',
    setup() {
      result = composableFactory()
      return result
    }
  }

  const wrapper = mount(TestComponent, {
    global: {
      provide: {
        qdadmOrchestrator: mockOrchestrator,
        qdadmEntityFilters: {}
      }
    }
  })

  return { wrapper, result }
}

describe('useListPageBuilder - Permission features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
    mockManager = createMockManager()
    mockOrchestrator.get.mockImplementation(() => mockManager)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('permission state properties', () => {
    it('returns canCreate, canDelete, canEditRow, canDeleteRow', () => {
      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      expect(result).toHaveProperty('canCreate')
      expect(result).toHaveProperty('canDelete')
      expect(result).toHaveProperty('canEditRow')
      expect(result).toHaveProperty('canDeleteRow')
      expect(result).toHaveProperty('getRowActions')
    })

    it('canCreate is reactive computed from manager.canCreate()', () => {
      mockManager = createMockManager({ canCreate: () => false })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      expect(result.canCreate.value).toBe(false)
    })

    it('canCreate returns true when manager.canCreate() returns true', () => {
      mockManager = createMockManager({ canCreate: () => true })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      expect(result.canCreate.value).toBe(true)
    })

    it('canDelete is reactive computed from manager.canDelete()', () => {
      mockManager = createMockManager({ canDelete: () => false })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      expect(result.canDelete.value).toBe(false)
    })

    it('canEditRow calls manager.canUpdate with row', () => {
      mockManager = createMockManager({
        canUpdate: (row) => row?.id === 1
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      expect(result.canEditRow({ id: 1 })).toBe(true)
      expect(result.canEditRow({ id: 2 })).toBe(false)
    })

    it('canDeleteRow calls manager.canDelete with row', () => {
      mockManager = createMockManager({
        canDelete: (row) => row?.id === 1
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      expect(result.canDeleteRow({ id: 1 })).toBe(true)
      expect(result.canDeleteRow({ id: 2 })).toBe(false)
    })
  })

  describe('addCreateAction permission', () => {
    it('hides create action when canCreate returns false', () => {
      mockManager = createMockManager({ canCreate: () => false })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addCreateAction()

      const actions = result.getHeaderActions()
      expect(actions.find(a => a.name === 'create')).toBeUndefined()
    })

    it('shows create action when canCreate returns true', () => {
      mockManager = createMockManager({ canCreate: () => true })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addCreateAction()

      const actions = result.getHeaderActions()
      expect(actions.find(a => a.name === 'create')).toBeDefined()
    })
  })

  describe('addEditAction permission', () => {
    it('hides edit action when canUpdate returns false for row', async () => {
      mockManager = createMockManager({
        canUpdate: () => false
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addEditAction()

      const row = { id: 1, title: 'Test' }
      const actions = result.getActions(row)
      expect(actions.find(a => a.name === 'edit')).toBeUndefined()
    })

    it('shows edit action when canUpdate returns true for row', async () => {
      mockManager = createMockManager({
        canUpdate: () => true
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addEditAction()

      const row = { id: 1, title: 'Test' }
      const actions = result.getActions(row)
      expect(actions.find(a => a.name === 'edit')).toBeDefined()
    })

    it('filters edit action based on row-level permissions', async () => {
      mockManager = createMockManager({
        canUpdate: (row) => row?.id === 1  // Only row 1 is editable
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addEditAction()

      // Row 1 should have edit action
      const row1Actions = result.getActions({ id: 1, title: 'Test 1' })
      expect(row1Actions.find(a => a.name === 'edit')).toBeDefined()

      // Row 2 should not have edit action
      const row2Actions = result.getActions({ id: 2, title: 'Test 2' })
      expect(row2Actions.find(a => a.name === 'edit')).toBeUndefined()
    })
  })

  describe('addDeleteAction permission', () => {
    it('hides delete action when canDelete returns false for row', async () => {
      mockManager = createMockManager({
        canDelete: () => false
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addDeleteAction()

      const row = { id: 1, title: 'Test' }
      const actions = result.getActions(row)
      expect(actions.find(a => a.name === 'delete')).toBeUndefined()
    })

    it('shows delete action when canDelete returns true for row', async () => {
      mockManager = createMockManager({
        canDelete: () => true
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addDeleteAction()

      const row = { id: 1, title: 'Test' }
      const actions = result.getActions(row)
      expect(actions.find(a => a.name === 'delete')).toBeDefined()
    })

    it('filters delete action based on row-level permissions', async () => {
      mockManager = createMockManager({
        canDelete: (row) => row?.id === 1  // Only row 1 is deletable
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addDeleteAction()

      // Row 1 should have delete action
      const row1Actions = result.getActions({ id: 1, title: 'Test 1' })
      expect(row1Actions.find(a => a.name === 'delete')).toBeDefined()

      // Row 2 should not have delete action
      const row2Actions = result.getActions({ id: 2, title: 'Test 2' })
      expect(row2Actions.find(a => a.name === 'delete')).toBeUndefined()
    })
  })

  describe('addBulkDeleteAction permission', () => {
    it('hides bulk delete when canDelete returns false', async () => {
      mockManager = createMockManager({
        canDelete: () => false
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addBulkDeleteAction()
      result.selected.value = [{ id: 1 }]  // Simulate selection

      await nextTick()

      const actions = result.getHeaderActions()
      expect(actions.find(a => a.name === 'bulk-delete')).toBeUndefined()
    })

    it('shows bulk delete when canDelete returns true and has selection', async () => {
      mockManager = createMockManager({
        canDelete: () => true
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addBulkDeleteAction()
      result.selected.value = [{ id: 1 }]  // Simulate selection

      await nextTick()

      const actions = result.getHeaderActions()
      expect(actions.find(a => a.name === 'bulk-delete')).toBeDefined()
    })
  })

  describe('getRowActions', () => {
    it('getRowActions returns same actions as getActions', () => {
      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addEditAction()
      result.addDeleteAction()

      const row = { id: 1, title: 'Test' }
      const actions = result.getActions(row)
      const rowActions = result.getRowActions(row)

      // Compare action names and structure (not object identity)
      expect(rowActions.map(a => a.name)).toEqual(actions.map(a => a.name))
      expect(rowActions.length).toBe(actions.length)
    })

    it('getRowActions respects permissions', () => {
      mockManager = createMockManager({
        canUpdate: (row) => row?.id === 1,
        canDelete: () => false
      })

      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addEditAction()
      result.addDeleteAction()

      // Row 1: edit visible, delete hidden
      const row1Actions = result.getRowActions({ id: 1 })
      expect(row1Actions.find(a => a.name === 'edit')).toBeDefined()
      expect(row1Actions.find(a => a.name === 'delete')).toBeUndefined()

      // Row 2: both hidden
      const row2Actions = result.getRowActions({ id: 2 })
      expect(row2Actions.find(a => a.name === 'edit')).toBeUndefined()
      expect(row2Actions.find(a => a.name === 'delete')).toBeUndefined()
    })
  })

  describe('column management', () => {
    it('exports columns, addColumn, removeColumn, updateColumn', () => {
      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      expect(result).toHaveProperty('columns')
      expect(result).toHaveProperty('addColumn')
      expect(result).toHaveProperty('removeColumn')
      expect(result).toHaveProperty('updateColumn')
    })

    it('addColumn adds a column to the list', () => {
      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addColumn('title', { header: 'Title', sortable: true })
      result.addColumn('author', { header: 'Author' })

      expect(result.columns.value).toHaveLength(2)
      expect(result.columns.value[0].field).toBe('title')
      expect(result.columns.value[0].header).toBe('Title')
      expect(result.columns.value[0].sortable).toBe(true)
      expect(result.columns.value[1].field).toBe('author')
    })

    it('removeColumn removes a column', () => {
      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addColumn('title', { header: 'Title' })
      result.addColumn('author', { header: 'Author' })
      result.removeColumn('title')

      expect(result.columns.value).toHaveLength(1)
      expect(result.columns.value[0].field).toBe('author')
    })

    it('updateColumn updates column config', () => {
      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addColumn('title', { header: 'Title', sortable: false })
      result.updateColumn('title', { sortable: true, style: 'width: 200px' })

      expect(result.columns.value[0].sortable).toBe(true)
      expect(result.columns.value[0].style).toBe('width: 200px')
      expect(result.columns.value[0].header).toBe('Title') // Preserved
    })

    it('columns are included in listProps', () => {
      const { result } = createWrapper(() => useListPageBuilder({ entity: 'books' }))

      result.addColumn('title', { header: 'Title' })

      expect(result.props.value.columns).toHaveLength(1)
      expect(result.props.value.columns[0].field).toBe('title')
    })
  })
})

describe('useListPageBuilder - list:alter hook', () => {
  // Import HookRegistry for these tests
  const { createHookRegistry } = require('../../src/hooks/HookRegistry.js')

  let mockHookRegistry

  function createWrapperWithHooks(composableFactory, hooksInstance) {
    let result
    const TestComponent = {
      template: '<div></div>',
      setup() {
        result = composableFactory()
        return result
      }
    }

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          qdadmOrchestrator: mockOrchestrator,
          qdadmEntityFilters: {},
          qdadmHooks: hooksInstance
        }
      }
    })

    return { wrapper, result }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
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

  it('invokes list:alter hook with config snapshot', async () => {
    const hookHandler = vi.fn((config) => config)
    mockHookRegistry.register('list:alter', hookHandler)

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    // Add some config before mount completes
    result.addColumn('title', { header: 'Title' })
    result.addFilter('status', { type: 'select', options: [] })

    // Wait for onMounted to complete
    await flushPromises()

    expect(hookHandler).toHaveBeenCalled()
    const configArg = hookHandler.mock.calls[0][0]
    expect(configArg.entity).toBe('books')
    expect(configArg.columns).toBeDefined()
    expect(configArg.filters).toBeDefined()
    expect(configArg.actions).toBeDefined()
    expect(configArg.headerActions).toBeDefined()
  })

  it('list:alter hook can add columns', async () => {
    mockHookRegistry.register('list:alter', (config) => {
      config.columns.push({ field: 'custom', header: 'Custom Column' })
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    result.addColumn('title', { header: 'Title' })

    await flushPromises()

    expect(result.columns.value).toHaveLength(2)
    expect(result.columns.value.find(c => c.field === 'custom')).toBeDefined()
    expect(result.columns.value.find(c => c.field === 'custom').header).toBe('Custom Column')
  })

  it('list:alter hook can add filters', async () => {
    mockHookRegistry.register('list:alter', (config) => {
      config.filters.push({ name: 'year', type: 'select', options: [2023, 2024] })
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    expect(result.filters.value.find(f => f.name === 'year')).toBeDefined()
    expect(result.filters.value.find(f => f.name === 'year').type).toBe('select')
  })

  it('list:alter hook can add actions', async () => {
    mockHookRegistry.register('list:alter', (config) => {
      config.actions.push({
        name: 'custom-action',
        icon: 'pi pi-star',
        tooltip: 'Custom Action',
        onClick: () => {}
      })
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    const row = { id: 1 }
    const actions = result.getActions(row)
    expect(actions.find(a => a.name === 'custom-action')).toBeDefined()
  })

  it('list:alter hook can add header actions', async () => {
    mockHookRegistry.register('list:alter', (config) => {
      config.headerActions.push({
        name: 'export',
        label: 'Export',
        icon: 'pi pi-download',
        onClick: () => {}
      })
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    const headerActions = result.getHeaderActions()
    expect(headerActions.find(a => a.name === 'export')).toBeDefined()
  })

  it('invokes entity-specific hook after generic hook', async () => {
    const callOrder = []

    mockHookRegistry.register('list:alter', (config) => {
      callOrder.push('list:alter')
      config.columns.push({ field: 'generic', header: 'Generic' })
      return config
    })

    mockHookRegistry.register('books:list:alter', (config) => {
      callOrder.push('books:list:alter')
      config.columns.push({ field: 'specific', header: 'Specific' })
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    expect(callOrder).toEqual(['list:alter', 'books:list:alter'])
    expect(result.columns.value.find(c => c.field === 'generic')).toBeDefined()
    expect(result.columns.value.find(c => c.field === 'specific')).toBeDefined()
  })

  it('multiple hooks chain modifications', async () => {
    mockHookRegistry.register('list:alter', (config) => {
      config.columns.push({ field: 'col1', header: 'Column 1' })
      return config
    }, { priority: 100 })

    mockHookRegistry.register('list:alter', (config) => {
      config.columns.push({ field: 'col2', header: 'Column 2' })
      return config
    }, { priority: 50 })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    expect(result.columns.value).toHaveLength(2)
    // Higher priority runs first
    expect(result.columns.value[0].field).toBe('col1')
    expect(result.columns.value[1].field).toBe('col2')
  })

  it('hook can remove items from config', async () => {
    mockHookRegistry.register('list:alter', (config) => {
      // Remove a specific column
      config.columns = config.columns.filter(c => c.field !== 'author')
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    result.addColumn('title', { header: 'Title' })
    result.addColumn('author', { header: 'Author' })

    await flushPromises()

    expect(result.columns.value).toHaveLength(1)
    expect(result.columns.value[0].field).toBe('title')
  })

  it('hook can modify existing items', async () => {
    mockHookRegistry.register('list:alter', (config) => {
      const titleCol = config.columns.find(c => c.field === 'title')
      if (titleCol) {
        titleCol.sortable = true
        titleCol.style = 'font-weight: bold'
      }
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    result.addColumn('title', { header: 'Title', sortable: false })

    await flushPromises()

    expect(result.columns.value[0].sortable).toBe(true)
    expect(result.columns.value[0].style).toBe('font-weight: bold')
  })
})

describe('useListPageBuilder - filter:alter hook', () => {
  // Import HookRegistry for these tests
  const { createHookRegistry } = require('../../src/hooks/HookRegistry.js')

  let mockHookRegistry

  function createWrapperWithHooks(composableFactory, hooksInstance, entityFiltersConfig = {}) {
    let result
    const TestComponent = {
      template: '<div></div>',
      setup() {
        result = composableFactory()
        return result
      }
    }

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          qdadmOrchestrator: mockOrchestrator,
          qdadmEntityFilters: entityFiltersConfig,
          qdadmHooks: hooksInstance
        }
      }
    })

    return { wrapper, result }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
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

  it('invokes filter:alter hook with filters snapshot', async () => {
    const hookHandler = vi.fn((config) => config)
    mockHookRegistry.register('filter:alter', hookHandler)

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    // Add a filter before mount completes
    result.addFilter('status', {
      type: 'select',
      options: [
        { label: 'All', value: null },
        { label: 'Active', value: 'active' }
      ]
    })

    // Wait for onMounted to complete (which calls loadFilterOptions)
    await flushPromises()

    expect(hookHandler).toHaveBeenCalled()
    const configArg = hookHandler.mock.calls[0][0]
    expect(configArg.entity).toBe('books')
    expect(configArg.filters).toBeDefined()
    expect(Array.isArray(configArg.filters)).toBe(true)
  })

  it('filter:alter hook can add filter options', async () => {
    mockHookRegistry.register('filter:alter', (config) => {
      const statusFilter = config.filters.find(f => f.name === 'status')
      if (statusFilter) {
        statusFilter.options.push({ label: 'Archived', value: 'archived' })
      }
      return config
    })

    // Need to add filter BEFORE mount, so it's in filtersMap when hook runs
    // Use a factory that adds the filter immediately
    let builderResult
    const { result, wrapper } = createWrapperWithHooks(
      () => {
        builderResult = useListPageBuilder({ entity: 'books', loadOnMount: false })
        // Add filter immediately during setup, before onMounted
        builderResult.addFilter('status', {
          type: 'select',
          options: [
            { label: 'All', value: null },
            { label: 'Active', value: 'active' }
          ]
        })
        return builderResult
      },
      mockHookRegistry
    )

    await flushPromises()

    const statusFilter = result.filters.value.find(f => f.name === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter.options).toHaveLength(3)
    expect(statusFilter.options.find(o => o.value === 'archived')).toBeDefined()
  })

  it('filter:alter hook can remove filter options', async () => {
    mockHookRegistry.register('filter:alter', (config) => {
      const statusFilter = config.filters.find(f => f.name === 'status')
      if (statusFilter) {
        statusFilter.options = statusFilter.options.filter(o => o.value !== 'inactive')
      }
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => {
        const builder = useListPageBuilder({ entity: 'books', loadOnMount: false })
        builder.addFilter('status', {
          type: 'select',
          options: [
            { label: 'All', value: null },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' }
          ]
        })
        return builder
      },
      mockHookRegistry
    )

    await flushPromises()

    const statusFilter = result.filters.value.find(f => f.name === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter.options).toHaveLength(2)
    expect(statusFilter.options.find(o => o.value === 'inactive')).toBeUndefined()
  })

  it('filter:alter hook can modify filter visibility', async () => {
    mockHookRegistry.register('filter:alter', (config) => {
      const statusFilter = config.filters.find(f => f.name === 'status')
      if (statusFilter) {
        statusFilter.visible = false
      }
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => {
        const builder = useListPageBuilder({ entity: 'books', loadOnMount: false })
        builder.addFilter('status', { type: 'select', options: [] })
        return builder
      },
      mockHookRegistry
    )

    await flushPromises()

    const statusFilter = result.filters.value.find(f => f.name === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter.visible).toBe(false)
  })

  it('invokes entity-specific filter:alter hook after generic hook', async () => {
    const callOrder = []

    mockHookRegistry.register('filter:alter', (config) => {
      callOrder.push('filter:alter')
      const statusFilter = config.filters.find(f => f.name === 'status')
      if (statusFilter) {
        statusFilter.options.push({ label: 'From Generic', value: 'generic' })
      }
      return config
    })

    mockHookRegistry.register('books:filter:alter', (config) => {
      callOrder.push('books:filter:alter')
      const statusFilter = config.filters.find(f => f.name === 'status')
      if (statusFilter) {
        statusFilter.options.push({ label: 'From Specific', value: 'specific' })
      }
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => {
        const builder = useListPageBuilder({ entity: 'books', loadOnMount: false })
        builder.addFilter('status', {
          type: 'select',
          options: [{ label: 'All', value: null }]
        })
        return builder
      },
      mockHookRegistry
    )

    await flushPromises()

    expect(callOrder).toEqual(['filter:alter', 'books:filter:alter'])

    const statusFilter = result.filters.value.find(f => f.name === 'status')
    expect(statusFilter).toBeDefined()
    expect(statusFilter.options.find(o => o.value === 'generic')).toBeDefined()
    expect(statusFilter.options.find(o => o.value === 'specific')).toBeDefined()
  })

  it('filter:alter hook can add new filters', async () => {
    mockHookRegistry.register('filter:alter', (config) => {
      config.filters.push({
        name: 'year',
        type: 'select',
        options: [
          { label: 'All', value: null },
          { label: '2023', value: 2023 },
          { label: '2024', value: 2024 }
        ]
      })
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    const yearFilter = result.filters.value.find(f => f.name === 'year')
    expect(yearFilter).toBeDefined()
    expect(yearFilter.type).toBe('select')
    expect(yearFilter.options).toHaveLength(3)
  })

  it('filter:alter hook can remove filters', async () => {
    mockHookRegistry.register('filter:alter', (config) => {
      config.filters = config.filters.filter(f => f.name !== 'status')
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => {
        const builder = useListPageBuilder({ entity: 'books', loadOnMount: false })
        builder.addFilter('status', { type: 'select', options: [] })
        builder.addFilter('category', { type: 'select', options: [] })
        return builder
      },
      mockHookRegistry
    )

    await flushPromises()

    expect(result.filters.value.find(f => f.name === 'status')).toBeUndefined()
    expect(result.filters.value.find(f => f.name === 'category')).toBeDefined()
  })

  it('multiple filter:alter hooks chain modifications', async () => {
    mockHookRegistry.register('filter:alter', (config) => {
      config.filters.push({ name: 'filter1', type: 'select', options: [] })
      return config
    }, { priority: 100 })

    mockHookRegistry.register('filter:alter', (config) => {
      config.filters.push({ name: 'filter2', type: 'select', options: [] })
      return config
    }, { priority: 50 })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    expect(result.filters.value).toHaveLength(2)
    // Higher priority runs first
    expect(result.filters.value[0].name).toBe('filter1')
    expect(result.filters.value[1].name).toBe('filter2')
  })

  it('hook receives entity in config', async () => {
    let receivedConfig = null

    mockHookRegistry.register('filter:alter', (config) => {
      receivedConfig = config
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => useListPageBuilder({ entity: 'books', loadOnMount: false }),
      mockHookRegistry
    )

    await flushPromises()

    expect(receivedConfig).not.toBeNull()
    expect(receivedConfig.entity).toBe('books')
    expect(receivedConfig.filters).toBeDefined()
  })

  it('preserves existing filter values when filter:alter modifies filters', async () => {
    mockHookRegistry.register('filter:alter', (config) => {
      // Add a new option but don't change structure
      const statusFilter = config.filters.find(f => f.name === 'status')
      if (statusFilter) {
        statusFilter.options.push({ label: 'New Option', value: 'new' })
      }
      return config
    })

    const { result, wrapper } = createWrapperWithHooks(
      () => {
        const builder = useListPageBuilder({ entity: 'books', loadOnMount: false })
        builder.addFilter('status', {
          type: 'select',
          options: [{ label: 'All', value: null }, { label: 'Active', value: 'active' }],
          default: 'active'
        })
        // Set a filter value during setup
        builder.filterValues.value.status = 'active'
        return builder
      },
      mockHookRegistry
    )

    await flushPromises()

    // Value should be preserved
    expect(result.filterValues.value.status).toBe('active')
  })
})
