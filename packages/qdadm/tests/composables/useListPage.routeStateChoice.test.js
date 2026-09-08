/**
 * Who decides where a list remembers its state (#2146).
 *
 * Four levels, most specific first: the list, the entity, the kernel, then
 * the URL. Each exists because somebody has to be able to say it there — a
 * screen's medium is a screen's decision, an entity's is a modelling one, and
 * the app-wide floor belongs in the bootstrap.
 *
 * These assert the OBSERVABLE choice: where the state actually lands. A test
 * reading back `persister.name` would pass just as happily if the chain
 * picked the right persister and then wrote somewhere else.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'
import { MemoryPersister, clearRouteStateMemory } from '../../src/routeState/MemoryPersister'

let mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
const mockRouter = { push: vi.fn(), replace: vi.fn() }

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRouteState,
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

function createMockManager(extra = {}) {
  return {
    name: 'books',
    label: 'Book',
    labelPlural: 'Books',
    routePrefix: 'book',
    idField: 'id',
    localFilterThreshold: 100,
    routeState: null,
    getListFields: () => [{ name: 'title', type: 'text', label: 'Title' }],
    getFieldConfig: () => null,
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    query: vi.fn().mockResolvedValue({ items: [], total: 0, fromCache: false }),
    delete: vi.fn(),
    invalidateCache: vi.fn(),
    canCreate: () => true,
    canUpdate: () => true,
    canDelete: () => true,
    ...extra,
  }
}

let mockManager = createMockManager()
const mockOrchestrator = { get: vi.fn(() => mockManager) }

/** Build the list, optionally under a kernel that declared a default. */
function runList(options = {}, kernelRouteState = undefined) {
  const provide = { qdadmOrchestrator: mockOrchestrator, qdadmEntityFilters: {} }
  if (kernelRouteState !== undefined) provide.qdadmRouteState = kernelRouteState

  let result
  mount(
    {
      template: '<div></div>',
      setup() {
        result = useListPage({ entity: 'books', ...options })
        return {}
      },
    },
    { global: { provide } }
  )
  return result
}

/**
 * What a list stores under `books`, minus the row count.
 *
 * `pageSize` rides along in every write — it is a choice somebody made, and
 * the default is not "unset". These tests are about WHICH MEDIUM answers, so
 * they read the page and leave the row count to the tests that own it.
 */
function storedPage(persister = new MemoryPersister()) {
  const state = persister.read('books')
  if (!state) return null
  const { pageSize: _rows, ...rest } = state
  return rest
}

/** Where did the state actually go? */
function wroteToUrl() {
  return mockRouter.replace.mock.calls.length > 0
}

describe('choosing a route-state persister (#2146)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearRouteStateMemory()
    mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
    mockManager = createMockManager()
    mockOrchestrator.get.mockImplementation(() => mockManager)
  })
  afterEach(() => vi.restoreAllMocks())

  it('writes to the URL when nobody said otherwise', () => {
    const list = runList()

    list.onPage({ page: 1, rows: 10 })

    expect(wroteToUrl()).toBe(true)
  })

  it('honours a kernel-wide default', () => {
    const list = runList({}, 'memory')

    list.onPage({ page: 1, rows: 10 })

    expect(wroteToUrl()).toBe(false)
    expect(storedPage()).toEqual({ page: 2 })
  })

  it('lets the entity override the kernel', () => {
    mockManager = createMockManager({ routeState: 'memory' })
    const list = runList({}, 'url')

    list.onPage({ page: 1, rows: 10 })

    expect(wroteToUrl()).toBe(false)
    expect(storedPage()).toEqual({ page: 2 })
  })

  it('lets the list override the entity', () => {
    mockManager = createMockManager({ routeState: 'memory' })
    const list = runList({ routeState: 'url' }, 'memory')

    list.onPage({ page: 1, rows: 10 })

    expect(wroteToUrl()).toBe(true)
    expect(new MemoryPersister().read('books')).toBeNull()
  })

  it('takes an instance, not only a slug, at every level', () => {
    const mine = new MemoryPersister({ store: new Map() })
    mockManager = createMockManager({ routeState: mine })
    const list = runList()

    list.onPage({ page: 1, rows: 10 })

    expect(storedPage(mine)).toEqual({ page: 2 })
  })

  it('throws on an unknown slug rather than quietly using the URL', () => {
    // The whole reason the seam exists: a persistence choice that silently
    // does something else (ADR 0011).
    expect(() => runList({ routeState: 'redis' })).toThrow(/redis/)
  })

  it('an explicit persister answers syncUrlParams rather than obeying it', () => {
    // Naming a medium is a deliberate choice; it would be odd for a flag
    // about the query string to veto a memory persister.
    const list = runList({ routeState: 'memory', syncUrlParams: false })

    list.onPage({ page: 1, rows: 10 })

    expect(storedPage()).toEqual({ page: 2 })
  })

  it('scopes by entity, so two lists never share a namespace', () => {
    const list = runList({ routeState: 'memory' })
    list.onPage({ page: 2, rows: 10 })

    expect(storedPage()).toEqual({ page: 3 })
    expect(new MemoryPersister().read('offers')).toBeNull()
  })
})
