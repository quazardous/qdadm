/**
 * Unit tests for useFormPageBuilder composable
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, computed } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useFormPageBuilder } from '../../src/composables/useFormPageBuilder.js'

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
    getInitialData: () => ({ title: '', author: '' }),
    getEntityLabel: (entity) => entity?.title || null,
    get: vi.fn().mockResolvedValue({ id: 1, title: 'Test Book', author: 'Test Author' }),
    create: vi.fn().mockResolvedValue({ id: 2, title: 'New Book', author: 'New Author' }),
    update: vi.fn().mockResolvedValue({ id: 1, title: 'Updated Book', author: 'Test Author' }),
    patch: vi.fn().mockResolvedValue({ id: 1, title: 'Patched Book', author: 'Test Author' }),
    delete: vi.fn().mockResolvedValue(undefined),
    canCreate: () => options.canCreate ?? true,
    canUpdate: () => options.canUpdate ?? true,
    canDelete: () => options.canDelete ?? true,
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
        qdadmOrchestrator: mockOrchestrator
      }
    }
  })

  return { wrapper, result }
}

describe('useFormPageBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteState = { name: 'book-create', params: {}, query: {} }
    mockManager = createMockManager()
    mockOrchestrator.get.mockImplementation(() => mockManager)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('throws error when orchestrator is not provided', () => {
      const TestComponent = {
        template: '<div></div>',
        setup() {
          return useFormPageBuilder({ entity: 'books' })
        }
      }

      expect(() => {
        mount(TestComponent, { global: { provide: {} } })
      }).toThrow('[qdadm] Orchestrator not provided')
    })

    it('gets manager from orchestrator', () => {
      createWrapper(() => useFormPageBuilder({ entity: 'books' }))
      expect(mockOrchestrator.get).toHaveBeenCalledWith('books')
    })

    it('returns expected API surface', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      // Mode detection
      expect(result).toHaveProperty('mode')
      expect(result).toHaveProperty('isEdit')
      expect(result).toHaveProperty('isCreate')
      expect(result).toHaveProperty('entityId')

      // State
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('loading')
      expect(result).toHaveProperty('saving')
      expect(result).toHaveProperty('dirty')

      // Actions
      expect(result).toHaveProperty('load')
      expect(result).toHaveProperty('submit')
      expect(result).toHaveProperty('cancel')
      expect(result).toHaveProperty('remove')

      // FormPage integration
      expect(result).toHaveProperty('props')
      expect(result).toHaveProperty('events')
    })
  })

  describe('mode detection', () => {
    it('detects create mode from route name', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result.mode.value).toBe('create')
      expect(result.isCreate.value).toBe(true)
      expect(result.isEdit.value).toBe(false)
    })

    it('detects edit mode from route params', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '123' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result.mode.value).toBe('edit')
      expect(result.isEdit.value).toBe(true)
      expect(result.isCreate.value).toBe(false)
      expect(result.entityId.value).toBe('123')
    })

    it('uses custom getId function when provided', async () => {
      mockRouteState = { name: 'book-edit', params: { bookId: '456' } }
      const { result } = createWrapper(() =>
        useFormPageBuilder({
          entity: 'books',
          getId: () => '456'
        })
      )

      expect(result.entityId.value).toBe('456')
    })
  })

  describe('data loading', () => {
    it('initializes with empty data in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(result.data.value).toEqual({ title: '', author: '' })
      expect(mockManager.get).not.toHaveBeenCalled()
    })

    it('loads entity data in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(mockManager.get).toHaveBeenCalledWith('1')
      expect(result.data.value).toEqual({ id: 1, title: 'Test Book', author: 'Test Author' })
    })

    it('applies transformLoad hook', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() =>
        useFormPageBuilder({
          entity: 'books',
          transformLoad: (data) => ({ ...data, title: data.title.toUpperCase() })
        })
      )

      await flushPromises()

      expect(result.data.value.title).toBe('TEST BOOK')
    })

    it('shows error toast on load failure', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager.get.mockRejectedValueOnce(new Error('Not found'))

      createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  describe('dirty state tracking', () => {
    it('starts as not dirty', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      await nextTick()

      expect(result.dirty.value).toBe(false)
    })

    it('becomes dirty when data changes', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      // Wait for snapshot to be ready
      await nextTick()
      await nextTick()

      result.data.value.title = 'Changed Title'
      await nextTick()

      expect(result.dirty.value).toBe(true)
    })
  })

  describe('submit', () => {
    it('creates entity in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      result.data.value.title = 'New Book'
      result.data.value.author = 'New Author'

      await result.submit(true)

      expect(mockManager.create).toHaveBeenCalledWith({
        title: 'New Book',
        author: 'New Author'
      })
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })

    it('updates entity in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      result.data.value.title = 'Updated Title'

      await result.submit(true)

      expect(mockManager.update).toHaveBeenCalledWith('1', expect.any(Object))
    })

    it('uses PATCH when usePatch option is true', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() =>
        useFormPageBuilder({ entity: 'books', usePatch: true })
      )

      await flushPromises()
      await result.submit(true)

      expect(mockManager.patch).toHaveBeenCalled()
      expect(mockManager.update).not.toHaveBeenCalled()
    })

    it('applies transformSave hook', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() =>
        useFormPageBuilder({
          entity: 'books',
          transformSave: (data) => ({ ...data, slug: data.title.toLowerCase() })
        })
      )

      await flushPromises()

      result.data.value.title = 'New Book'
      await result.submit(true)

      expect(mockManager.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'new book' })
      )
    })

    it('redirects to list when andClose is true', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      await result.submit(true)

      expect(mockRouter.push).toHaveBeenCalledWith({ name: 'book' })
    })

    it('redirects to edit mode after create when redirectOnCreate is true', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() =>
        useFormPageBuilder({ entity: 'books', redirectOnCreate: true })
      )

      await flushPromises()
      await result.submit(false)

      expect(mockRouter.replace).toHaveBeenCalledWith({
        name: 'book-edit',
        params: { id: 2 }
      })
    })
  })

  describe('delete', () => {
    it('deletes entity and redirects to list', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      await result.remove()

      expect(mockManager.delete).toHaveBeenCalledWith('1')
      expect(mockRouter.push).toHaveBeenCalledWith({ name: 'book' })
    })

    it('confirmDelete shows confirmation dialog', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      result.confirmDelete()

      expect(mockConfirm.require).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Confirm Delete',
          acceptClass: 'p-button-danger'
        })
      )
    })

    it('does nothing when not in edit mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      await result.remove()

      expect(mockManager.delete).not.toHaveBeenCalled()
    })
  })

  describe('actions', () => {
    it('addSaveAction creates a save action', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.addSaveAction()

      const actions = result.getActions()
      expect(actions).toContainEqual(
        expect.objectContaining({ name: 'save' })
      )
    })

    it('addDeleteAction creates a delete action in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      result.addDeleteAction()

      const actions = result.getActions()
      expect(actions).toContainEqual(
        expect.objectContaining({ name: 'delete' })
      )
    })

    it('delete action is hidden in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.addDeleteAction()

      const actions = result.getActions()
      expect(actions.find(a => a.name === 'delete')).toBeUndefined()
    })

    it('respects manager.canCreate for save action visibility', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      mockManager = createMockManager({ canCreate: () => false })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.addSaveAction()

      const actions = result.getActions()
      expect(actions.find(a => a.name === 'save')).toBeUndefined()
    })

    it('respects manager.canUpdate for save action visibility in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canUpdate: () => false })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      result.addSaveAction()

      const actions = result.getActions()
      expect(actions.find(a => a.name === 'save')).toBeUndefined()
    })

    it('shows save action when canUpdate returns true in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canUpdate: () => true })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      result.addSaveAction()

      const actions = result.getActions()
      expect(actions.find(a => a.name === 'save')).toBeDefined()
    })

    it('respects manager.canDelete for delete action visibility', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canDelete: () => false })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      result.addDeleteAction()

      const actions = result.getActions()
      expect(actions.find(a => a.name === 'delete')).toBeUndefined()
    })

    it('shows delete action when canDelete returns true in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canDelete: () => true })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      result.addDeleteAction()

      const actions = result.getActions()
      expect(actions.find(a => a.name === 'delete')).toBeDefined()
    })

    it('save action is disabled when form is not dirty', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      await nextTick()
      result.addSaveAction()

      const actions = result.getActions()
      const saveAction = actions.find(a => a.name === 'save')
      expect(saveAction.isDisabled).toBe(true)
    })

    it('save action is enabled when form is dirty', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()
      await nextTick()
      await nextTick()

      result.data.value.title = 'Changed Title'
      await nextTick()

      result.addSaveAction()

      const actions = result.getActions()
      const saveAction = actions.find(a => a.name === 'save')
      expect(saveAction.isDisabled).toBe(false)
    })
  })

  describe('permission state', () => {
    it('returns canSave and canDeleteRecord computed properties', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result).toHaveProperty('canSave')
      expect(result).toHaveProperty('canDeleteRecord')
    })

    it('canSave checks canCreate in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      mockManager = createMockManager({ canCreate: () => false })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result.canSave.value).toBe(false)
    })

    it('canSave returns true when canCreate is true in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      mockManager = createMockManager({ canCreate: () => true })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result.canSave.value).toBe(true)
    })

    it('canSave checks canUpdate in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canUpdate: () => false })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(result.canSave.value).toBe(false)
    })

    it('canSave returns true when canUpdate is true in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canUpdate: () => true })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(result.canSave.value).toBe(true)
    })

    it('canDeleteRecord is false in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      mockManager = createMockManager({ canDelete: () => true })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result.canDeleteRecord.value).toBe(false)
    })

    it('canDeleteRecord checks canDelete with record in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canDelete: () => false })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(result.canDeleteRecord.value).toBe(false)
    })

    it('canDeleteRecord returns true when canDelete is true in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({ canDelete: () => true })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(result.canDeleteRecord.value).toBe(true)
    })

    it('props includes canSave and canDelete', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      mockManager = createMockManager({
        canUpdate: () => true,
        canDelete: () => false
      })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(result.props.value.canSave).toBe(true)
      expect(result.props.value.canDelete).toBe(false)
    })
  })

  describe('FormPage props/events', () => {
    it('props contains required FormPage properties', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      const props = result.props.value
      expect(props).toHaveProperty('isEdit', true)
      expect(props).toHaveProperty('mode', 'edit')
      expect(props).toHaveProperty('loading')
      expect(props).toHaveProperty('saving')
      expect(props).toHaveProperty('dirty')
      expect(props).toHaveProperty('title')
      expect(props).toHaveProperty('actions')
    })

    it('events contains form event handlers', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result.events).toHaveProperty('save')
      expect(result.events).toHaveProperty('saveAndClose')
      expect(result.events).toHaveProperty('cancel')
      expect(result.events).toHaveProperty('delete')
    })

    it('pageTitle reflects mode and entity label in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      // Data is loaded, title should include entity label
      expect(result.pageTitle.value).toBe('Edit Book: Test Book')
    })

    it('pageTitle shows Create in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      expect(result.pageTitle.value).toBe('Create Book')
    })
  })

  describe('reset', () => {
    it('resets data to original in edit mode', async () => {
      mockRouteState = { name: 'book-edit', params: { id: '1' } }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      result.data.value.title = 'Changed Title'
      result.reset()

      expect(result.data.value.title).toBe('Test Book')
    })

    it('resets data to initial in create mode', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      await flushPromises()

      result.data.value.title = 'New Title'
      result.reset()

      expect(result.data.value.title).toBe('')
    })
  })

  describe('field generation', () => {
    beforeEach(() => {
      // Setup manager with fields schema
      mockManager = createMockManager({
        getFormFields: () => [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'author', type: 'text', label: 'Author', required: true },
          { name: 'year', type: 'number', label: 'Year' },
          { name: 'genre', type: 'select', label: 'Genre', options: [{ label: 'Fiction', value: 'fiction' }] },
          { name: 'published', type: 'boolean', label: 'Published' },
          { name: 'internal_id', type: 'text', label: 'Internal ID' }
        ],
        getFieldConfig: (name) => {
          const fields = {
            title: { type: 'text', label: 'Title', required: true },
            author: { type: 'text', label: 'Author', required: true },
            year: { type: 'number', label: 'Year' },
            genre: { type: 'select', label: 'Genre', options: [{ label: 'Fiction', value: 'fiction' }] },
            published: { type: 'boolean', label: 'Published' },
            internal_id: { type: 'text', label: 'Internal ID' }
          }
          return fields[name]
        }
      })
    })

    it('generateFields creates fields from EntityManager.fields', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()

      expect(result.fields.value).toHaveLength(6)
      expect(result.fields.value[0].name).toBe('title')
      expect(result.fields.value[0].type).toBe('text')
      expect(result.fields.value[0].required).toBe(true)
    })

    it('generateFields maps schema types to input types', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()

      const fieldTypes = result.fields.value.reduce((acc, f) => {
        acc[f.name] = f.type
        return acc
      }, {})

      expect(fieldTypes.title).toBe('text')
      expect(fieldTypes.year).toBe('number')
      expect(fieldTypes.genre).toBe('select')
      expect(fieldTypes.published).toBe('boolean')
    })

    it('generateFields preserves field options', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()

      const genreField = result.getFieldConfig('genre')
      expect(genreField.options).toEqual([{ label: 'Fiction', value: 'fiction' }])
    })

    it('excludeField removes field from generation', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.excludeField('internal_id')
      result.generateFields()

      expect(result.fields.value).toHaveLength(5)
      expect(result.getFieldConfig('internal_id')).toBeUndefined()
    })

    it('generateFields respects exclude option', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields({ exclude: ['internal_id', 'year'] })

      expect(result.fields.value).toHaveLength(4)
      expect(result.getFieldConfig('internal_id')).toBeUndefined()
      expect(result.getFieldConfig('year')).toBeUndefined()
    })

    it('generateFields respects only option', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields({ only: ['title', 'author'] })

      expect(result.fields.value).toHaveLength(2)
      expect(result.fields.value[0].name).toBe('title')
      expect(result.fields.value[1].name).toBe('author')
    })

    it('addField adds manual field configuration', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.addField('custom', { type: 'textarea', label: 'Custom Field' })

      expect(result.fields.value).toHaveLength(1)
      expect(result.fields.value[0].name).toBe('custom')
      expect(result.fields.value[0].type).toBe('textarea')
    })

    it('addField overrides generated field', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.addField('title', { type: 'textarea', label: 'Book Title' })

      const titleField = result.getFieldConfig('title')
      expect(titleField.type).toBe('textarea')
      expect(titleField.label).toBe('Book Title')
    })

    it('addField with after option positions field correctly', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.addField('custom', { type: 'text', label: 'Custom' }, { after: 'title' })

      const fieldNames = result.fields.value.map(f => f.name)
      expect(fieldNames.indexOf('custom')).toBe(fieldNames.indexOf('title') + 1)
    })

    it('addField with before option positions field correctly', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.addField('custom', { type: 'text', label: 'Custom' }, { before: 'author' })

      const fieldNames = result.fields.value.map(f => f.name)
      expect(fieldNames.indexOf('custom')).toBe(fieldNames.indexOf('author') - 1)
    })

    it('removeField removes a field', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.removeField('year')

      expect(result.fields.value).toHaveLength(5)
      expect(result.getFieldConfig('year')).toBeUndefined()
    })

    it('setFieldOrder reorders fields', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.setFieldOrder(['genre', 'title', 'author'])

      expect(result.fields.value).toHaveLength(3)
      expect(result.fields.value[0].name).toBe('genre')
      expect(result.fields.value[1].name).toBe('title')
      expect(result.fields.value[2].name).toBe('author')
    })

    it('moveField moves field to new position', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.moveField('genre', { after: 'title' })

      const fieldNames = result.fields.value.map(f => f.name)
      expect(fieldNames.indexOf('genre')).toBe(fieldNames.indexOf('title') + 1)
    })

    it('getFieldConfig returns field configuration', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()

      const titleConfig = result.getFieldConfig('title')
      expect(titleConfig).toBeDefined()
      expect(titleConfig.name).toBe('title')
      expect(titleConfig.type).toBe('text')
      expect(titleConfig.required).toBe(true)
    })

    it('fields are included in props', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()

      expect(result.props.value.fields).toEqual(result.fields.value)
    })

    it('manual addField before generateFields takes precedence', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      // Add manual field first
      result.addField('title', { type: 'textarea', label: 'Custom Title' })
      result.generateFields()

      const titleField = result.getFieldConfig('title')
      expect(titleField.type).toBe('textarea')
      expect(titleField.label).toBe('Custom Title')
    })

    it('supports method chaining', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      // All field methods should return builderApi for chaining
      const chainResult = result
        .excludeField('internal_id')
        .generateFields()
        .addField('custom', { type: 'text' })
        .moveField('custom', { after: 'title' })

      expect(chainResult).toBe(result)
      expect(result.fields.value.length).toBeGreaterThan(0)
    })

    it('generates label from snake_case field name when not provided', () => {
      mockManager = createMockManager({
        getFormFields: () => [
          { name: 'created_at', type: 'datetime' },
          { name: 'user_profile_id', type: 'text' }
        ],
        getFieldConfig: () => null
      })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()

      expect(result.getFieldConfig('created_at').label).toBe('Created At')
      expect(result.getFieldConfig('user_profile_id').label).toBe('User Profile Id')
    })

    it('preserves schemaType alongside mapped type', () => {
      mockManager = createMockManager({
        getFormFields: () => [
          { name: 'email', type: 'email' },
          { name: 'age', type: 'integer' }
        ],
        getFieldConfig: (name) => {
          const fields = { email: { type: 'email' }, age: { type: 'integer' } }
          return fields[name]
        }
      })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()

      expect(result.getFieldConfig('email').type).toBe('email')
      expect(result.getFieldConfig('email').schemaType).toBe('email')
      expect(result.getFieldConfig('age').type).toBe('number')
      expect(result.getFieldConfig('age').schemaType).toBe('integer')
    })
  })

  describe('validation', () => {
    beforeEach(() => {
      mockManager = createMockManager({
        getFormFields: () => [
          { name: 'title', type: 'text', label: 'Title', required: true },
          { name: 'email', type: 'email', label: 'Email' },
          { name: 'age', type: 'integer', label: 'Age' },
          { name: 'website', type: 'url', label: 'Website' }
        ],
        getFieldConfig: (name) => {
          const fields = {
            title: { type: 'text', label: 'Title', required: true },
            email: { type: 'email', label: 'Email' },
            age: { type: 'integer', label: 'Age' },
            website: { type: 'url', label: 'Website' }
          }
          return fields[name]
        }
      })
    })

    it('returns expected validation API surface', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('hasErrors')
      expect(result).toHaveProperty('errorSummary')
      expect(result).toHaveProperty('submitted')
      expect(result).toHaveProperty('validate')
      expect(result).toHaveProperty('validateField')
      expect(result).toHaveProperty('clearErrors')
      expect(result).toHaveProperty('clearFieldError')
      expect(result).toHaveProperty('getFieldError')
    })

    it('validate() returns true when all fields are valid', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = 'Test Book'
      result.data.value.email = 'test@example.com'
      result.data.value.age = 25

      expect(result.validate()).toBe(true)
      expect(result.hasErrors.value).toBe(false)
    })

    it('validate() returns false when required field is empty', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''

      expect(result.validate()).toBe(false)
      expect(result.hasErrors.value).toBe(true)
      expect(result.errors.value.title).toBe('Title is required')
    })

    it('validate() checks email format', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = 'Test'
      result.data.value.email = 'invalid-email'

      expect(result.validate()).toBe(false)
      expect(result.errors.value.email).toBe('Invalid email address')
    })

    it('validate() checks integer type', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = 'Test'
      result.data.value.age = 25.5

      expect(result.validate()).toBe(false)
      expect(result.errors.value.age).toBe('Must be an integer')
    })

    it('validate() checks URL format', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = 'Test'
      result.data.value.website = 'not-a-url'

      expect(result.validate()).toBe(false)
      expect(result.errors.value.website).toBe('Invalid URL')
    })

    it('validate() accepts valid URL', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = 'Test'
      result.data.value.website = 'https://example.com'

      expect(result.validate()).toBe(true)
    })

    it('validateField() validates single field', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''

      const error = result.validateField('title')

      expect(error).toBe('Title is required')
      expect(result.errors.value.title).toBe('Title is required')
    })

    it('validateField() clears error when field becomes valid', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''
      result.validateField('title')

      expect(result.errors.value.title).toBe('Title is required')

      result.data.value.title = 'Valid Title'
      result.validateField('title')

      expect(result.errors.value.title).toBeUndefined()
    })

    it('custom validator is called with value and form data', () => {
      const customValidator = vi.fn((value, formData) => {
        return value.length >= 5 || 'Must be at least 5 characters'
      })

      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.addField('title', { type: 'text', label: 'Title', validate: customValidator })
      result.data.value.title = 'Hi'

      result.validate()

      expect(customValidator).toHaveBeenCalledWith('Hi', result.data.value)
      expect(result.errors.value.title).toBe('Must be at least 5 characters')
    })

    it('custom validator returning true clears error', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.addField('title', {
        type: 'text',
        label: 'Title',
        validate: (v) => v.length >= 3 || 'Too short'
      })

      result.data.value.title = 'Hello'
      result.validate()

      expect(result.errors.value.title).toBeUndefined()
    })

    it('clearErrors() removes all errors', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''
      result.data.value.email = 'invalid'
      result.validate()

      expect(Object.keys(result.errors.value).length).toBeGreaterThan(0)

      result.clearErrors()

      expect(result.errors.value).toEqual({})
      expect(result.submitted.value).toBe(false)
    })

    it('clearFieldError() removes specific field error', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''
      result.data.value.email = 'invalid'
      result.validate()

      expect(result.errors.value.title).toBeDefined()
      expect(result.errors.value.email).toBeDefined()

      result.clearFieldError('title')

      expect(result.errors.value.title).toBeUndefined()
      expect(result.errors.value.email).toBeDefined()
    })

    it('getFieldError() returns error message for field', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''
      result.validate()

      expect(result.getFieldError('title')).toBe('Title is required')
      expect(result.getFieldError('nonexistent')).toBeNull()
    })

    it('errorSummary provides field label with error', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''
      result.validate()

      expect(result.errorSummary.value).toContainEqual({
        field: 'title',
        label: 'Title',
        message: 'Title is required'
      })
    })

    it('submit() validates before saving when validateOnSubmit is true', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''

      const response = await result.submit(true)

      expect(response).toBeNull()
      expect(mockManager.create).not.toHaveBeenCalled()
      expect(result.submitted.value).toBe(true)
    })

    it('submit() proceeds when validation passes', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = 'Valid Title'

      await flushPromises()
      await result.submit(true)

      expect(mockManager.create).toHaveBeenCalled()
    })

    it('reset() clears validation errors', async () => {
      mockRouteState = { name: 'book-create', params: {} }
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''
      result.validate()

      expect(result.hasErrors.value).toBe(true)

      result.reset()

      expect(result.errors.value).toEqual({})
      expect(result.submitted.value).toBe(false)
    })

    it('errors are included in props', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = ''
      result.validate()

      expect(result.props.value.errors).toEqual(result.errors.value)
      expect(result.props.value.hasErrors).toBe(true)
      expect(result.props.value.submitted).toBe(false)
    })

    it('empty strings are considered empty for required validation', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = '   '  // whitespace only

      expect(result.validate()).toBe(false)
      expect(result.errors.value.title).toBe('Title is required')
    })

    it('null and undefined are considered empty for required validation', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = null

      expect(result.validate()).toBe(false)
      expect(result.errors.value.title).toBe('Title is required')

      result.data.value.title = undefined
      expect(result.validate()).toBe(false)
    })

    it('skips type validation for empty values', () => {
      const { result } = createWrapper(() => useFormPageBuilder({ entity: 'books' }))

      result.generateFields()
      result.data.value.title = 'Test'
      result.data.value.email = ''  // Empty but not required

      expect(result.validate()).toBe(true)
    })
  })
})
