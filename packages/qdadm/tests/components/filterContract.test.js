/**
 * A filter of several values and the filter contract (#5467): QdMultiFilter
 * draws a `multiple` filter, grouped and badged; an app's own component gets
 * the value, the choices and the state, and gives back a value of the
 * declared shape; arrays through the load, the address, the session, Clear
 * and dependsOn; ApiStorage's arrayFormat.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive, defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ListPage from '../../src/components/lists/ListPage.vue'
import QdMultiFilter from '../../src/components/lists/filters/QdMultiFilter.vue'
import { useListPage } from '../../src/composables/useListPage'
import { joinValues, splitValues } from '../../src/composables/useListPage.filters'
import { getSessionFilters, setSessionFilters } from '../../src/composables/useListPage.utils'
import { ApiStorage } from '../../src/entity/storage/ApiStorage'

window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
const mockRoute = reactive({ name: 'task', path: '/tasks', params: {}, query: {}, meta: {} })
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn((to) => (mockRoute.query = to.query)) }),
  useRoute: () => mockRoute,
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
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

const TYPES = [
  { label: 'Unhandled error', value: 'php/error', group: 'Legacy PHP errors', badge: { label: 'PHP', tone: 'critical' } },
  { label: 'Deprecation', value: 'php/deprecated', group: 'Legacy PHP errors', badge: { label: 'PHP', tone: 'watch' } },
  { label: 'Python crash', value: 'py/crash', group: 'Core', badge: { label: 'PY' } },
  { label: 'Alert', value: 'alert', badge: { label: 'ALERTE', tone: '#7c3aed' } },
]

async function mountList(setup) {
  let list
  const wrapper = mount(
    {
      components: { ListPage },
      template: '<ListPage v-bind="list.props.value" v-on="list.events" />',
      setup() {
        list = useListPage({ entity: 'tasks', refresh: false })
        setup(list)
        return { list }
      },
    },
    { attachTo: document.body, global: { plugins: [PrimeVue], directives: { tooltip: {} }, provide: { qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {} } } }
  )
  await flushPromises()
  return { list, wrapper }
}

const lastFilters = () => (manager.query.mock.calls.at(-1)?.[0] ?? {}).filters ?? {}

describe('a filter of several values (#5467)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockRoute.query = {}
  })

  it('drawn by QdMultiFilter: no "All" choice, the groups and badges kept', async () => {
    const { list, wrapper } = await mountList((l) => l.addFilter('types', { multiple: true, options: TYPES }))
    const multi = wrapper.findComponent(QdMultiFilter)
    expect(multi.exists()).toBe(true)
    expect(multi.props('modelValue')).toEqual([])
    expect(multi.props('options').map((o) => o.value)).toEqual(TYPES.map((t) => t.value))
    expect(multi.props('options')[0].badge).toEqual({ label: 'PHP', tone: 'critical' })
    expect(list.hasActiveFilters.value).toBe(false)
    wrapper.unmount()
  })

  it('two values: sent as an array, comma-joined in the address, kept in the session, counted', async () => {
    const { list, wrapper } = await mountList((l) => l.addFilter('types', { multiple: true, options: TYPES }))
    wrapper.findComponent(QdMultiFilter).vm.$emit('update:modelValue', ['php/error', 'py/crash'])
    await flushPromises()
    expect(lastFilters()).toEqual({ types: ['php/error', 'py/crash'] })
    expect(mockRoute.query['tasks.types']).toBe('php/error,py/crash')
    expect(getSessionFilters('tasks')).toEqual({ types: ['php/error', 'py/crash'] })
    expect(list.hasActiveFilters.value).toBe(true)
    // None chosen: off, not sent, not counted
    wrapper.findComponent(QdMultiFilter).vm.$emit('update:modelValue', [])
    await flushPromises()
    expect(lastFilters()).toEqual({})
    expect(mockRoute.query['tasks.types']).toBeUndefined()
    expect(list.hasActiveFilters.value).toBe(false)
    wrapper.unmount()
  })

  it('read back from the address as an array, and from the session', async () => {
    mockRoute.query = { 'tasks.types': 'php/error,alert' }
    let { list, wrapper } = await mountList((l) => l.addFilter('types', { multiple: true, options: TYPES }))
    expect(list.filterValues.value.types).toEqual(['php/error', 'alert'])
    expect(lastFilters()).toEqual({ types: ['php/error', 'alert'] })
    wrapper.unmount()
    mockRoute.query = {}
    setSessionFilters('tasks', { types: ['py/crash'] })
    ;({ list, wrapper } = await mountList((l) => l.addFilter('types', { multiple: true, options: TYPES })))
    expect(list.filterValues.value.types).toEqual(['py/crash'])
    wrapper.unmount()
  })

  it('a default: Clear (the bar\'s button) returns to it; emptied, its empty token (#5460)', async () => {
    const { list, wrapper } = await mountList((l) => l.addFilter('types', { multiple: true, options: TYPES, default: ['php/error'] }))
    expect(list.filterValues.value.types).toEqual(['php/error'])
    expect(list.isFilterAtDefault('types')).toBe(true)
    wrapper.findComponent(QdMultiFilter).vm.$emit('update:modelValue', [])
    await flushPromises()
    expect(mockRoute.query['tasks.types']).toBe('null')
    expect(list.hasActiveFilters.value).toBe(true)
    await wrapper.find('[data-filter-actions] .pi-filter-slash').element.closest('button').click()
    await flushPromises()
    expect(list.filterValues.value.types).toEqual(['php/error'])
    expect(list.isFilterAtDefault('types')).toBe(true)
    wrapper.unmount()
  })

  it('the values in words: the chosen labels, or the filter\'s describe', async () => {
    const { list, wrapper } = await mountList((l) => {
      l.addFilter('types', { multiple: true, options: TYPES })
      l.addFilter('years', { component: { name: 'Years', props: ['modelValue'], render: () => h('span') }, describe: (v) => `${v[0]}–${v[1]}` })
    })
    list.updateFilters({ types: ['php/error', 'alert'], years: [1960, 1970] })
    await flushPromises()
    expect(list.props.value.searchLabel).toBe('Unhandled error, Alert, 1960–1970')
    wrapper.unmount()
  })
})

describe('the filter contract: an app\'s own component (#5467)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockRoute.query = {}
  })

  const Own = defineComponent({
    name: 'OwnFilter',
    props: ['modelValue', 'filter', 'options', 'loading', 'atDefault'],
    emits: ['update:modelValue'],
    render: () => h('span', { class: 'own-filter' }),
  })

  it('gets the value, the filter, the choices and the state; what it gives back is the list\'s', async () => {
    const { list, wrapper } = await mountList((l) => l.addFilter('owner', { component: Own, options: [{ label: 'Ann', value: 'ann' }] }))
    const own = wrapper.findComponent(Own)
    expect(own.props('modelValue')).toBe(null)
    expect(own.props('filter').name).toBe('owner')
    expect(own.props('options').map((o) => o.value)).toEqual([null, 'ann'])
    expect(own.props('loading')).toBe(false)
    expect(own.props('atDefault')).toBe(true)
    own.vm.$emit('update:modelValue', 'ann')
    await flushPromises()
    expect(list.filterValues.value.owner).toBe('ann')
    expect(lastFilters()).toEqual({ owner: 'ann' })
    expect(mockRoute.query['tasks.owner']).toBe('ann')
    expect(wrapper.findComponent(Own).props('atDefault')).toBe(false)
    wrapper.unmount()
  })

  it('a single value for several: said in development, and wrapped; one value may be a range', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = import.meta.env.DEV
    import.meta.env.DEV = true
    const { list, wrapper } = await mountList((l) => {
      l.addFilter('tags', { component: Own, multiple: true })
      l.addFilter('owner', { component: Own })
    })
    const [tags, owner] = wrapper.findAllComponents(Own)
    tags.vm.$emit('update:modelValue', 'x')
    owner.vm.$emit('update:modelValue', ['a', 'b'])
    await flushPromises()
    expect(list.filterValues.value.tags).toEqual(['x'])
    expect(list.filterValues.value.owner).toEqual(['a', 'b'])
    expect(warn.mock.calls.flat().join(' ')).toMatch(/Filter "tags".*single value/)
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Filter "owner"/)
    import.meta.env.DEV = env
    warn.mockRestore()
    wrapper.unmount()
  })
})

describe('arrays in one parameter (#5467)', () => {
  it('comma-joined, a value holding a comma keeps the array; read back with the URL\'s numbers', () => {
    expect(joinValues(['a', 'b'])).toBe('a,b')
    expect(joinValues(['a,1', 'b'])).toEqual(['a,1', 'b'])
    expect(splitValues('a,b')).toEqual(['a', 'b'])
    expect(splitValues('1965,007')).toEqual([1965, '007'])
    expect(splitValues(5)).toEqual([5])
    expect(splitValues(['x'])).toEqual(['x'])
  })
})

describe("ApiStorage's arrayFormat (#5467)", () => {
  function client() {
    const calls = []
    return { calls, async get(url, config) { calls.push({ url, params: config?.params }); return { data: { items: [], total: 0 }, headers: {} } } }
  }
  const filters = { types: ['a/x', 'b/y'], state: 'open' }

  it('comma by default', async () => {
    const c = client()
    await new ApiStorage({ endpoint: '/api/tasks', client: c }).list({ filters })
    expect(c.calls[0].url).toBe('/api/tasks')
    expect(c.calls[0].params).toMatchObject({ types: 'a/x,b/y', state: 'open' })
  })

  it('repeat, brackets: in the URL itself; client: the array left; per parameter', async () => {
    let c = client()
    await new ApiStorage({ endpoint: '/api/tasks', client: c, arrayFormat: 'repeat' }).list({ filters })
    expect(c.calls[0].url).toBe('/api/tasks?types=a%2Fx&types=b%2Fy')
    expect(c.calls[0].params.types).toBeUndefined()
    c = client()
    await new ApiStorage({ endpoint: '/api/tasks', client: c, arrayFormat: 'brackets' }).list({ filters })
    expect(c.calls[0].url).toBe('/api/tasks?types%5B%5D=a%2Fx&types%5B%5D=b%2Fy')
    c = client()
    await new ApiStorage({ endpoint: '/api/tasks', client: c, arrayFormat: 'client' }).list({ filters })
    expect(c.calls[0].params.types).toEqual(['a/x', 'b/y'])
    c = client()
    await new ApiStorage({ endpoint: '/api/tasks', client: c, arrayFormat: { '*': 'comma', tags: 'repeat' } }).list({ filters: { ...filters, tags: ['p', 'q'] } })
    expect(c.calls[0].params.types).toBe('a/x,b/y')
    expect(c.calls[0].url).toBe('/api/tasks?tags=p&tags=q')
  })
})

describe('QdMultiFilter on its own (#5467)', () => {
  const props = (n) => ({
    modelValue: [],
    filter: { name: 'types', placeholder: 'Types', multiple: true },
    options: Array.from({ length: n }, (_, i) => ({ label: `T${i}`, value: i, badge: { label: `B${i}`, tone: i ? 'critical' : '#7c3aed' } })),
    loading: false,
    atDefault: true,
  })

  it('a search past 8 choices, on the label, the badge and the group', () => {
    const few = mount(QdMultiFilter, { props: props(8), global: { plugins: [PrimeVue] } })
    expect(few.findComponent({ name: 'MultiSelect' }).props('filter')).toBe(false)
    const many = mount(QdMultiFilter, { props: props(9), global: { plugins: [PrimeVue] } })
    const ms = many.findComponent({ name: 'MultiSelect' })
    expect(ms.props('filter')).toBe(true)
    expect(ms.props('filterFields')).toEqual(['_search'])
    expect(ms.props('options')[1]._search).toBe('T1 B1')
  })

  it('closed: the first three chosen as badges, then +N', () => {
    const w = mount(QdMultiFilter, { props: { ...props(6), modelValue: [0, 1, 2, 3, 4] }, global: { plugins: [PrimeVue] } })
    const badges = w.findAll('.qd-multi-filter-chosen .qd-filter-badge')
    expect(badges.map((b) => b.text())).toEqual(['B0', 'B1', 'B2'])
    expect(badges[0].attributes('style')).toContain('#7c3aed')
    expect(badges[1].attributes('style')).toContain('var(--qd-tone-critical')
    expect(w.find('.qd-multi-filter-more').text()).toBe('+2')
  })
})
