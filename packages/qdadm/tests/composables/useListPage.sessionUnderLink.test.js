/**
 * A link that names some filters describes a whole state (#5428).
 *
 * The session's other filters used to be merged in: Universe = IT kept from
 * the session, a card's link to `?provider=amazon&type=failed`, and the list
 * came up empty. Now an address naming one of the list's filters (or its
 * search) drops the session's others, except those declared
 * `keepFromSession`; a bare address takes the session back. The same rule
 * when the address changes under a mounted list.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useListPage } from '../../src/composables/useListPage'
import { setSessionFilters, getSessionFilters } from '../../src/composables/useListPage.utils'

let mockRoute = reactive({ name: 'task', path: '/tasks', params: {}, query: {}, meta: {} })
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn((to) => {
    mockRoute.query = to.query
  }),
}

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRoute,
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const manager = {
  name: 'tasks',
  label: 'Task',
  labelPlural: 'Tasks',
  routePrefix: 'task',
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

const opts = (values) => ({ type: 'select', options: values.map((v) => ({ label: v, value: v })) })

async function mountList() {
  let list
  const wrapper = mount(
    {
      template: '<div></div>',
      setup() {
        list = useListPage({ entity: 'tasks' })
        list.addFilter('universe', opts(['it', 'b2c']))
        list.addFilter('provider', opts(['amazon', 'legacy']))
        list.addFilter('type', opts(['failed', 'php']))
        list.addFilter('criticality', { ...opts(['high', 'low']), keepFromSession: true })
        return {}
      },
    },
    { global: { provide: { qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {} } } }
  )
  await flushPromises()
  return { list, wrapper }
}

describe('a link that names some filters (#5428)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockRoute.name = 'task'
    mockRoute.path = '/tasks'
    mockRoute.query = {}
  })

  it("drops the session's other filters and its search, keeps the keepFromSession ones", async () => {
    setSessionFilters('tasks', { universe: 'it', criticality: 'high', _search: 'boom' })
    mockRoute.query = { 'tasks.provider': 'amazon', 'tasks.type': 'failed' }
    const { list, wrapper } = await mountList()
    expect(list.filterValues.value).toMatchObject({ universe: null, provider: 'amazon', type: 'failed', criticality: 'high' })
    expect(list.searchQuery.value).toBe('')
    // The session says what is shown; the kept one joins the address
    expect(getSessionFilters('tasks')).toEqual({ provider: 'amazon', type: 'failed', criticality: 'high' })
    expect(mockRoute.query).toMatchObject({ 'tasks.provider': 'amazon', 'tasks.type': 'failed', 'tasks.criticality': 'high' })
    expect(mockRoute.query['tasks.universe']).toBeUndefined()
    wrapper.unmount()
  })

  it('a bare address takes the session back, whole', async () => {
    setSessionFilters('tasks', { universe: 'it', criticality: 'high' })
    const { list, wrapper } = await mountList()
    expect(list.filterValues.value).toMatchObject({ universe: 'it', criticality: 'high' })
    expect(mockRoute.query).toMatchObject({ 'tasks.universe': 'it', 'tasks.criticality': 'high' })
    wrapper.unmount()
  })

  it('an address naming the search only also describes a whole state', async () => {
    setSessionFilters('tasks', { universe: 'it' })
    mockRoute.query = { 'tasks.search': 'dune' }
    const { list, wrapper } = await mountList()
    expect(list.filterValues.value.universe).toBe(null)
    expect(list.searchQuery.value).toBe('dune')
    wrapper.unmount()
  })

  it('a link while already on the list: it follows the address under the same rule', async () => {
    setSessionFilters('tasks', { universe: 'it', criticality: 'high' })
    const { list, wrapper } = await mountList()
    manager.query.mockClear()
    manager.list.mockClear()
    mockRouter.replace.mockClear()
    // A card's link, same page
    mockRoute.query = { 'tasks.provider': 'amazon', 'tasks.type': 'failed' }
    await nextTick()
    await flushPromises()
    expect(list.filterValues.value).toMatchObject({ universe: null, provider: 'amazon', type: 'failed', criticality: 'high' })
    expect(manager.query.mock.calls.length + manager.list.mock.calls.length).toBeGreaterThan(0)
    expect(mockRoute.query).toMatchObject({ 'tasks.criticality': 'high' })
    // Its own write changes nothing more
    const writes = mockRouter.replace.mock.calls.length
    await nextTick()
    await flushPromises()
    expect(mockRouter.replace.mock.calls.length).toBe(writes)
    // The side menu: a bare address keeps what is shown and says it again
    mockRoute.query = {}
    await nextTick()
    await flushPromises()
    expect(list.filterValues.value).toMatchObject({ provider: 'amazon', type: 'failed', criticality: 'high' })
    expect(mockRoute.query).toMatchObject({ 'tasks.provider': 'amazon' })
    wrapper.unmount()
  })

  it('another route: the list does not follow it', async () => {
    const { list, wrapper } = await mountList()
    mockRoute.name = 'other'
    mockRoute.path = '/other'
    mockRoute.query = { 'tasks.universe': 'b2c' }
    await nextTick()
    await flushPromises()
    expect(list.filterValues.value.universe).toBe(null)
    wrapper.unmount()
  })
})
