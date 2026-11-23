/**
 * A filter with a default, emptied on purpose (#5460).
 *
 * The empty choice used to leave the address exactly like an unset filter:
 * read back, the filter got its default again and the list loaded twice. It
 * is now written as its empty token (`null`, or the entity's or the filter's
 * own) and read back as null; Clear filters still returns to the defaults.
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
  filterEmptyValue: null,
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
const loads = () => manager.query.mock.calls.length + manager.list.mock.calls.length

async function mountList(state = {}) {
  let list
  const wrapper = mount(
    {
      template: '<div></div>',
      setup() {
        list = useListPage({ entity: 'tasks' })
        list.addFilter('state', { ...opts(['open', 'done']), default: 'open', ...state })
        list.addFilter('owner', opts(['alice', 'bob']))
        return {}
      },
    },
    { global: { provide: { qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {} } } }
  )
  await flushPromises()
  return { list, wrapper }
}

async function settle() {
  await nextTick()
  await flushPromises()
}

describe('a filter with a default, emptied on purpose (#5460)', () => {
  beforeEach(async () => {
    // What the last test left in flight lands first
    await flushPromises()
    vi.clearAllMocks()
    sessionStorage.clear()
    manager.filterEmptyValue = null
    mockRoute.name = 'task'
    mockRoute.path = '/tasks'
    mockRoute.query = {}
  })

  it('the empty choice: one load, written as null, not snapped back to the default (another filter in the address)', async () => {
    mockRoute.query = { 'tasks.owner': 'alice' }
    const { list, wrapper } = await mountList()
    expect(list.filterValues.value.state).toBe('open')
    manager.query.mockClear()
    manager.list.mockClear()

    list.updateFilters({ state: null })
    await settle()
    expect(list.filterValues.value.state).toBe(null)
    expect(mockRoute.query).toMatchObject({ 'tasks.state': 'null', 'tasks.owner': 'alice' })
    expect(loads()).toBe(1)
    expect(getSessionFilters('tasks')).toEqual({ state: null, owner: 'alice' })
    // A user choice, not the default
    expect(list.isFilterAtDefault('state')).toBe(false)
    expect(list.hasActiveFilters.value).toBe(true)
    wrapper.unmount()
  })

  it('read back as null: from the address, and from the session under a bare address', async () => {
    mockRoute.query = { 'tasks.state': 'null' }
    let { list, wrapper } = await mountList()
    expect(list.filterValues.value.state).toBe(null)
    wrapper.unmount()

    mockRoute.query = {}
    setSessionFilters('tasks', { state: null })
    ;({ list, wrapper } = await mountList())
    expect(list.filterValues.value.state).toBe(null)
    // The session's choice goes into the address (#5425)
    expect(mockRoute.query).toMatchObject({ 'tasks.state': 'null' })
    wrapper.unmount()
  })

  it("a link naming another filter: the session's emptied filter goes back to its default (#5428)", async () => {
    setSessionFilters('tasks', { state: null })
    mockRoute.query = { 'tasks.owner': 'bob' }
    const { list, wrapper } = await mountList()
    expect(list.filterValues.value).toMatchObject({ state: 'open', owner: 'bob' })
    wrapper.unmount()
  })

  it('Clear filters returns it to its default', async () => {
    mockRoute.query = { 'tasks.state': 'null' }
    const { list, wrapper } = await mountList()
    list.clearFilters()
    await settle()
    expect(list.filterValues.value.state).toBe('open')
    // The defaults, as shown (#5425): no empty token left
    expect(mockRoute.query['tasks.state']).not.toBe('null')
    expect(list.isFilterAtDefault('state')).toBe(true)
    wrapper.unmount()
  })

  it('the entity, then the filter, choose the token', async () => {
    manager.filterEmptyValue = 'all'
    let { list, wrapper } = await mountList()
    list.updateFilters({ state: null })
    await settle()
    expect(mockRoute.query['tasks.state']).toBe('all')
    wrapper.unmount()

    mockRoute.query = { 'tasks.state': 'all' }
    ;({ list, wrapper } = await mountList())
    expect(list.filterValues.value.state).toBe(null)
    wrapper.unmount()

    mockRoute.query = {}
    ;({ list, wrapper } = await mountList({ emptyValue: 'any' }))
    list.updateFilters({ state: null })
    await settle()
    expect(mockRoute.query['tasks.state']).toBe('any')
    wrapper.unmount()
  })

  it('a filter without a default keeps a clean address', async () => {
    const { list, wrapper } = await mountList()
    list.updateFilters({ owner: 'alice' })
    await settle()
    list.updateFilters({ owner: null })
    await settle()
    expect('tasks.owner' in mockRoute.query).toBe(false)
    expect(getSessionFilters('tasks')).toEqual({ state: 'open' })
    wrapper.unmount()
  })
})
