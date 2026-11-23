/**
 * A list's refresh button (#5462): shown by default; the list's `refresh`,
 * else the app's `features.lists.refresh`, can hide it; at the end of the filter bar;
 * the rows read again past the entity's cache, the list's state kept, one
 * read at a time.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ListPage from '../../src/components/lists/ListPage.vue'
import { useListPage } from '../../src/composables/useListPage'

window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
const mockRoute = reactive({ name: 'task', path: '/tasks', params: {}, query: {}, meta: {} })
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn((to) => (mockRoute.query = to.query)) }),
  useRoute: () => mockRoute,
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

let release = null
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
  query: vi.fn(() => (release ? new Promise((r) => (release = r)).then(() => ({ items: [], total: 0 })) : Promise.resolve({ items: [], total: 0, fromCache: false }))),
  delete: vi.fn(),
  invalidateCache: vi.fn(),
  canCreate: () => true,
  canUpdate: () => true,
  canDelete: () => true,
}

async function mountList(options = {}, features = null) {
  let list
  const wrapper = mount(
    {
      components: { ListPage },
      template: '<ListPage v-bind="list.props.value" v-on="list.events" />',
      setup() {
        list = useListPage({ entity: 'tasks', ...options })
        return { list }
      },
    },
    { global: { plugins: [PrimeVue], directives: { tooltip: {} }, provide: { qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {}, ...(features ? { qdadmFeatures: features } : {}) } } }
  )
  await flushPromises()
  return { list, wrapper }
}

const loads = () => manager.query.mock.calls.length + manager.list.mock.calls.length

describe("a list's refresh button (#5462)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    release = null
    mockRoute.query = {}
  })

  it('shown by default; hidden by the list, or by the app unless the list says yes', async () => {
    let { wrapper } = await mountList()
    expect(wrapper.find('[data-filter-actions] [data-list-refresh]').exists()).toBe(true)
    wrapper.unmount()
    ;({ wrapper } = await mountList({ refresh: false }))
    expect(wrapper.find('[data-list-refresh]').exists()).toBe(false)
    wrapper.unmount()
    ;({ wrapper } = await mountList({}, { lists: { refresh: false } }))
    expect(wrapper.find('[data-list-refresh]').exists()).toBe(false)
    wrapper.unmount()
    ;({ wrapper } = await mountList({ refresh: true }, { lists: { refresh: false } }))
    expect(wrapper.find('[data-list-refresh]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('a click: the rows read again past the cache, the page kept', async () => {
    const { list, wrapper } = await mountList({ refresh: true })
    list.page.value = 3
    const before = loads()
    await wrapper.find('[data-list-refresh]').trigger('click')
    await flushPromises()
    expect(manager.invalidateCache).toHaveBeenCalledTimes(1)
    expect(loads()).toBe(before + 1)
    expect(list.page.value).toBe(3)
    wrapper.unmount()
  })

  it('one at a time: spinning and disabled while it reads, a second call waits for the first', async () => {
    const { list, wrapper } = await mountList({ refresh: true })
    const before = loads()
    release = () => {}
    const first = list.refresh()
    const second = list.refresh()
    await flushPromises()
    expect(list.refreshing.value).toBe(true)
    const button = wrapper.find('[data-list-refresh]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.find('.pi-spin').exists()).toBe(true)
    expect(loads()).toBe(before + 1)
    release()
    await first
    await second
    await flushPromises()
    expect(list.refreshing.value).toBe(false)
    expect(wrapper.find('[data-list-refresh]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
