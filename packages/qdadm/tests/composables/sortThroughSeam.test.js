/**
 * The sort goes through the seam, and lands exactly where it always did (#2146).
 *
 * The plan offered three postures for the default. The one accepted keeps
 * `sort` in `sessionStorage` rather than moving it to the URL: a list link
 * carrying its ordering would be a real gain, but the sort would stop
 * surviving a clean `/offers`, which it has always done. A seam is worth
 * having without buying it with a loss every existing user would feel.
 *
 * So these assert an ABSENCE as much as a presence: the sort must not reach
 * the query string, and it must still come back on a fresh visit.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'
import { createDefaultRouteStatePersister } from '../../src/routeState/defaultPersister'

let mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
const mockRouter = { push: vi.fn(), replace: vi.fn() }

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRouteState,
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

function createMockManager() {
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
  }
}

let mockManager = createMockManager()
const mockOrchestrator = { get: vi.fn(() => mockManager) }

function runList(options = {}) {
  let result
  mount(
    {
      template: '<div></div>',
      setup() {
        result = useListPage({ entity: 'books', ...options })
        return {}
      },
    },
    { global: { provide: { qdadmOrchestrator: mockOrchestrator, qdadmEntityFilters: {} } } }
  )
  return result
}

describe('sort through the route-state seam (#2146)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
    mockManager = createMockManager()
    mockOrchestrator.get.mockImplementation(() => mockManager)
  })
  afterEach(() => vi.restoreAllMocks())

  it('does NOT put the sort in the query string', () => {
    // The accepted posture, asserted as the absence it is. If someone later
    // routes `sort` to the URL, this is the test that should stop them and
    // make them come back to the ticket.
    const list = runList()

    list.onSort({ sortField: 'title', sortOrder: -1 })

    const written = mockRouter.replace.mock.calls.at(-1)?.[0]?.query ?? {}
    expect(written).not.toHaveProperty(['books.sort'])
    expect(written).not.toHaveProperty(['books.sortOrder'])
  })

  it('survives a fresh visit with a clean URL', () => {
    // Which is exactly what moving it to the URL would have cost.
    runList().onSort({ sortField: 'title', sortOrder: -1 })

    const second = runList()

    expect(second.sortField.value).toBe('title')
    expect(second.sortOrder.value).toBe(-1)
  })

  it('keeps each list its own ordering', () => {
    runList().onSort({ sortField: 'title', sortOrder: -1 })

    mockManager = createMockManager()
    mockManager.name = 'offers'
    const other = runList({ entity: 'offers' })

    expect(other.sortField.value).toBeNull()
  })

  it('falls back to the declared default, not to the last list\'s sort', () => {
    const list = runList({ defaultSort: 'created_at', defaultSortOrder: -1 })
    expect(list.sortField.value).toBe('created_at')
    expect(list.sortOrder.value).toBe(-1)
  })

  it('remembers nothing when persistSort is off', () => {
    runList({ persistSort: false }).onSort({ sortField: 'title', sortOrder: -1 })

    expect(runList({ persistSort: false }).sortField.value).toBeNull()
  })

  it('restores a sort saved before the seam existed', () => {
    // The medium did not change — only the key did, from `qdadm_sort_books`
    // to `qdadm:books:sort`. An ordering set five minutes before an upgrade
    // must not vanish because of it.
    sessionStorage.setItem('qdadm_sort_books', JSON.stringify({ field: 'author', order: -1 }))

    const list = runList()

    expect(list.sortField.value).toBe('author')
    expect(list.sortOrder.value).toBe(-1)
  })

  it('retires the legacy entry once it has been carried over', () => {
    sessionStorage.setItem('qdadm_sort_books', JSON.stringify({ field: 'author', order: -1 }))
    const list = runList()

    list.onSort({ sortField: 'title', sortOrder: 1 })

    expect(sessionStorage.getItem('qdadm_sort_books')).toBeNull()
    expect(runList().sortField.value).toBe('title')
  })

  it('the seam wins over a stale legacy entry', () => {
    runList().onSort({ sortField: 'title', sortOrder: 1 })
    sessionStorage.setItem('qdadm_sort_books', JSON.stringify({ field: 'author', order: -1 }))

    expect(runList().sortField.value).toBe('title')
  })
})

describe('the default composition places sort (#2146)', () => {
  it('sends sort to the session and the page to the query', () => {
    const route = { query: {} }
    const p = createDefaultRouteStatePersister({
      router: { replace: (arg) => { route.query = arg.query } },
      route,
      cookieJar: { cookie: '' },
    })

    p.write('offers', { page: 2, sort: 'title', sortOrder: -1 })

    expect(route.query).toMatchObject({ 'offers.page': '2' })
    expect(route.query).not.toHaveProperty(['offers.sort'])
    expect(p.read('offers')).toMatchObject({ page: 2, sort: 'title', sortOrder: -1 })
  })
})
