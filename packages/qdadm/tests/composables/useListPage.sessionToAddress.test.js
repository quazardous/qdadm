/**
 * Filters restored from the session go into the address (#5425).
 *
 * A list filtered from the session used to keep a bare address: a copied
 * link lost the filter, and the app's domain resolver, which reads the route,
 * saw none. Once mounted, the list writes them by replace, once, when the
 * address does not carry them already.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'
import { setSessionFilters } from '../../src/composables/useListPage.utils'

let mockRoute = { name: 'book', params: {}, query: {}, meta: {} }
const mockRouter = { push: vi.fn(), replace: vi.fn() }

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRoute,
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const manager = {
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

async function mountList(options = {}) {
  let list
  mount(
    {
      template: '<div></div>',
      setup() {
        list = useListPage({ entity: 'books', ...options })
        list.addFilter('genre', { type: 'select', options: [{ label: 'SF', value: 'sf' }, { label: 'Novel', value: 'novel' }] })
        return {}
      },
    },
    { global: { provide: { qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {} } } }
  )
  await flushPromises()
  return list
}

const lastQuery = () => mockRouter.replace.mock.calls.at(-1)?.[0]?.query ?? null

describe('session filters reach the address (#5425)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockRoute = { name: 'book', params: {}, query: {}, meta: {} }
  })

  it('a bare address gains the filters and the search, by replace, not push', async () => {
    setSessionFilters('books', { genre: 'sf', _search: 'dune' })
    const list = await mountList()
    expect(list.filterValues.value.genre).toBe('sf')
    expect(mockRouter.replace).toHaveBeenCalledTimes(1)
    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(lastQuery()).toMatchObject({ 'books.genre': 'sf', 'books.search': 'dune' })
  })

  it('an address that carries them is left alone', async () => {
    setSessionFilters('books', { genre: 'sf' })
    mockRoute.query = { 'books.genre': 'sf' }
    await mountList()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it("the address's value wins over the session's, and is not rewritten", async () => {
    setSessionFilters('books', { genre: 'sf' })
    mockRoute.query = { 'books.genre': 'novel' }
    const list = await mountList()
    expect(list.filterValues.value.genre).toBe('novel')
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('nothing from the session, nothing written', async () => {
    await mountList()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('a list that does not write the address (syncUrlParams: false) leaves it', async () => {
    setSessionFilters('books', { genre: 'sf' })
    const list = await mountList({ syncUrlParams: false })
    expect(list.filterValues.value.genre).toBe('sf')
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })
})
