/**
 * The paginator sits on the page the list is actually showing (#2145).
 *
 * #2113 put the page number in the URL, and it worked: coming back from a
 * detail view re-requested page 2 and page 2's rows appeared. The PAGINATOR
 * still highlighted 1 — so the screen said "page 1" over page 2's rows, and
 * the next click paged from the wrong place.
 *
 * The cause: in lazy mode the table renders exactly the rows it is handed
 * and cannot infer which page they are. `first` — the row offset — is the
 * only thing that tells it, and qdadm never passed one. Clicking through
 * worked because the click moves the table's own internal offset; nothing
 * ELSE could move it.
 *
 * WHY THESE TESTS DRIVE A REAL DataTable: the defect I shipped in #2113 came
 * from verifying the rows and never looking at the paginator. Asserting
 * `first === (page - 1) * pageSize` would repeat that mistake one level up —
 * it would check the formula against itself and pass just as happily if
 * `first` were the wrong quantity, or never reached the table at all. So the
 * assertion is what a user sees: which page button is marked current.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import DataTable from 'primevue/datatable'
import { useListPage } from '../../src/composables/useListPage'
import ListPage from '../../src/components/lists/ListPage.vue'

// jsdom ships neither of these, and PrimeVue's Select reaches for matchMedia
// on mount. Stubbed rather than mocked away: the point of these tests is that
// a REAL paginator renders.
window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}))

let mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
const mockRouter = { push: vi.fn(), replace: vi.fn() }

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRouteState,
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const ROWS = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, title: `Book ${100 + i}` }))

function createMockManager() {
  return {
    name: 'books',
    label: 'Book',
    labelPlural: 'Books',
    routePrefix: 'book',
    idField: 'id',
    localFilterThreshold: 100,
    getListFields: () => [{ name: 'title', type: 'text', label: 'Title' }],
    getFieldConfig: () => null,
    list: vi.fn().mockResolvedValue({ items: ROWS, total: 57 }),
    query: vi.fn().mockResolvedValue({ items: ROWS, total: 57, fromCache: false }),
    delete: vi.fn(),
    invalidateCache: vi.fn(),
    canCreate: () => true,
    canUpdate: () => true,
    canDelete: () => true,
  }
}

let mockManager = createMockManager()
const mockOrchestrator = { get: vi.fn(() => mockManager) }

/** Run useListPage inside a component and hand back its return value. */
function runList(factory) {
  let result
  mount(
    {
      template: '<div></div>',
      setup() {
        result = factory()
        return {}
      },
    },
    { global: { provide: { qdadmOrchestrator: mockOrchestrator, qdadmEntityFilters: {} } } }
  )
  return result
}

/**
 * The page a user would read off the paginator.
 *
 * `aria-current="page"` rather than a class name: it is the contract the
 * paginator owes a screen reader, so it is both the honest observable and
 * the one least likely to churn under a theme change.
 */
function currentPageLabel(wrapper) {
  const marked = wrapper
    .findAll('[data-pc-section="page"], .p-paginator-page')
    .filter((el) => el.attributes('aria-current') === 'page')
  return marked.length === 1 ? marked[0].text() : `expected exactly one current page, got ${marked.length}`
}

/** The list has finished its first fetch and knows how many rows exist. */
async function loaded(list) {
  await vi.waitFor(() => expect(list.totalRecords.value).toBe(57))
  return list
}

/** Mount a bare DataTable the way ListPage does, from the list's own props. */
function tableFrom(listProps) {
  return mount(DataTable, {
    props: {
      value: listProps.items,
      lazy: listProps.lazy,
      paginator: true,
      rows: listProps.rows,
      totalRecords: listProps.totalRecords,
      first: listProps.first,
    },
    global: { plugins: [PrimeVue] },
  })
}

describe('paginator position (#2145)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteState = { name: 'book', params: {}, query: {}, meta: {} }
    mockManager = createMockManager()
    mockOrchestrator.get.mockImplementation(() => mockManager)
  })
  afterEach(() => vi.restoreAllMocks())

  it('lands on the page restored from the URL, not on 1', async () => {
    // The whole bug in one gesture: page 2 in the URL, page 2's rows, and a
    // paginator that used to say 1.
    mockRouteState = { name: 'book', params: {}, query: { 'books.page': '2' }, meta: {} }
    const list = await loaded(runList(() => useListPage({ entity: 'books' })))
    expect(list.page.value).toBe(2)

    expect(currentPageLabel(tableFrom(list.props.value))).toBe('2')
  })

  it('stays on 1 when there is nothing to restore', async () => {
    const list = await loaded(runList(() => useListPage({ entity: 'books' })))

    expect(currentPageLabel(tableFrom(list.props.value))).toBe('1')
  })

  it('follows the page wherever it goes, including back down', async () => {
    // Not just "2 works": a mapping that is off by a page, or that reads
    // rows-per-page as the offset, dies here.
    const list = await loaded(runList(() => useListPage({ entity: 'books' })))

    for (const target of [4, 2, 6, 1]) {
      list.onPage({ page: target - 1, rows: 10 })
      expect(currentPageLabel(tableFrom(list.props.value))).toBe(String(target))
    }
  })

  it('re-reads the paginator against a different page size', async () => {
    // 20 rows per page puts page 3 at offset 40, not 20 — a formula that
    // ignored `rows` would still pass every test above.
    const list = await loaded(runList(() => useListPage({ entity: 'books' })))

    list.onPage({ page: 2, rows: 20 })

    expect(currentPageLabel(tableFrom(list.props.value))).toBe('3')
  })

  it('ListPage hands `first` through to the table it renders', async () => {
    // The composable can be right and the component still drop it on the
    // floor — which is precisely what happened for two releases.
    const wrapper = mount(ListPage, {
      props: {
        items: ROWS,
        columns: [{ name: 'title', label: 'Title' }],
        lazy: true,
        paginator: true,
        rows: 10,
        totalRecords: 57,
        first: 30,
        dataKey: 'id',
      },
      global: { plugins: [PrimeVue], directives: { tooltip: {} } },
    })

    expect(currentPageLabel(wrapper)).toBe('4')
  })
})
