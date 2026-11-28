/**
 * A filter searched on the server and a value that is no choice (#5576):
 * searchOptions / searchEndpoint after a pause, aborted by a newer search,
 * bounded, said when it fails; the value from the address marked `unlisted`,
 * labelled by `labelFor` (sync or a promise, cached), never a quick choice.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useListFilters } from '../../src/composables/useListPage.filters'
import { useRemoteChoices, asChoices } from '../../src/components/lists/filters/remoteChoices'
import PrimeVue from 'primevue/config'

function makeDeps(overrides = {}) {
  return {
    entityName: 'tasks',
    manager: { request: vi.fn(async () => []) },
    orchestrator: null,
    items: ref([]),
    page: ref(1),
    searchQuery: ref(''),
    route: { query: {} },
    router: { replace: () => {} },
    savedFilters: null,
    persistFilters: false,
    syncUrlParams: false,
    autoLoadFilters: false,
    filterSessionKey: 'tasks',
    entityFilters: {},
    loadItems: vi.fn(),
    setSearch: vi.fn(),
    ...overrides,
  }
}
const optionsOf = (f, name) => f.filters.value.find((x) => x.name === name).options

afterEach(() => vi.useRealTimers())

function host(filter) {
  let api
  const w = mount(defineComponent({ setup() { api = useRemoteChoices(() => filter); return () => h('i') } }))
  return { api, w }
}

describe('the search (#5576)', () => {
  it('after the pause, the last query only; under the minimum, nothing asked', async () => {
    vi.useFakeTimers()
    const searchOptions = vi.fn(async (q) => [{ label: `Person ${q}`, value: q }])
    const { api } = host({ name: 'by', searchOptions, searchMinChars: 2 })
    api.search('a')
    await vi.advanceTimersByTimeAsync(300)
    expect(searchOptions).not.toHaveBeenCalled()
    api.search('al')
    api.search('ali')
    await vi.advanceTimersByTimeAsync(300)
    expect(searchOptions).toHaveBeenCalledTimes(1)
    expect(searchOptions.mock.calls[0][0]).toBe('ali')
    expect(searchOptions.mock.calls[0][1].limit).toBe(50)
    expect(api.results.value).toEqual([{ label: 'Person ali', value: 'ali' }])
  })

  it('a newer search aborts the older; the results bounded; a failure said', async () => {
    vi.useFakeTimers()
    const signals = []
    let fail = false
    const searchOptions = vi.fn((q, { signal }) => {
      signals.push(signal)
      if (fail) return Promise.reject(new Error('down'))
      return new Promise((r) => setTimeout(() => r(Array.from({ length: 10 }, (_, i) => ({ label: `${q}${i}`, value: `${q}${i}` }))), 500))
    })
    const { api } = host({ name: 'by', searchOptions, searchLimit: 3, searchDelay: 100 })
    api.search('x')
    await vi.advanceTimersByTimeAsync(150)
    api.search('y')
    expect(signals[0].aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(700)
    expect(api.results.value.map((r) => r.value)).toEqual(['y0', 'y1', 'y2'])
    fail = true
    api.search('z')
    await vi.advanceTimersByTimeAsync(150)
    expect(api.failed.value).toBe('down')
    expect(api.results.value).toEqual([])
  })

  it('answers read as choices: objects, ids, plain values, { items }', () => {
    expect(asChoices([{ id: 1, name: 'A', group: 'People' }, 'b', null])).toEqual([{ label: 'A', value: 1, group: 'People' }, { label: 'b', value: 'b' }])
    expect(asChoices({ items: [{ value: 'g:1', label: 'Admins' }] })).toEqual([{ label: 'Admins', value: 'g:1' }])
  })

  it('searchEndpoint asks the storage: ?q=…&limit=…', async () => {
    const deps = makeDeps({ manager: { request: vi.fn(async () => ({ items: [{ id: 'g:1', label: 'Admins' }] })) } })
    const f = useListFilters(deps)
    f.addFilter('by', { searchEndpoint: 'tasks/actors' })
    const filter = f.filters.value.find((x) => x.name === 'by')
    const found = await filter.searchOptions('adm', { limit: 20, signal: new AbortController().signal })
    expect(deps.manager.request).toHaveBeenCalledWith('GET', 'tasks/actors', { params: { q: 'adm', limit: 20 } })
    expect(asChoices(found)).toEqual([{ label: 'Admins', value: 'g:1' }])
  })
})

describe('a value that is no choice (#5576)', () => {
  it('marked unlisted; labelled by labelFor (sync)', () => {
    const f = useListFilters(makeDeps({ savedFilters: { by: 'group:admi-admin' } }))
    f.addFilter('by', { options: [{ label: 'Me', value: '@me' }], labelFor: (v) => (v === 'group:admi-admin' ? 'Administrateur' : null) })
    const added = optionsOf(f, 'by').find((o) => o.value === 'group:admi-admin')
    expect(added).toMatchObject({ label: 'Administrateur', unlisted: true })
  })

  it('labelFor as a promise: the raw value, then the label; asked once per value', async () => {
    const labelFor = vi.fn(async () => 'Administrateur')
    const f = useListFilters(makeDeps({ savedFilters: { by: 'group:admi-admin' } }))
    f.addFilter('by', { options: [{ label: 'Me', value: '@me' }], labelFor })
    expect(optionsOf(f, 'by').find((o) => o.unlisted).label).toBe('group:admi-admin')
    await flushPromises()
    expect(optionsOf(f, 'by').find((o) => o.unlisted).label).toBe('Administrateur')
    optionsOf(f, 'by')
    expect(labelFor).toHaveBeenCalledTimes(1)
  })

  it('without labelFor: the raw value, still marked', () => {
    const f = useListFilters(makeDeps({ savedFilters: { by: 'zoe' } }))
    f.addFilter('by', { options: [{ label: 'Me', value: '@me' }] })
    expect(optionsOf(f, 'by').find((o) => o.value === 'zoe')).toMatchObject({ label: 'zoe', unlisted: true })
  })
})

describe('a choice\'s icon (#5578)', () => {
  it('kept from search answers and endpoints', async () => {
    expect(asChoices([{ id: 'g:1', label: 'Admins', icon: 'pi pi-users' }])[0].icon).toBe('pi pi-users')
    const deps = makeDeps({ manager: { request: vi.fn(async () => [{ id: 'u1', label: 'Ann', icon: 'pi pi-user' }]) } })
    const f = useListFilters(deps)
    f.addFilter('by', { optionsEndpoint: 'actors' })
    await f.loadFilterOptions()
    expect(optionsOf(f, 'by').find((o) => o.value === 'u1').icon).toBe('pi pi-user')
  })

  it('labelFor gives { label, icon }: sync, and as a promise', async () => {
    const f = useListFilters(makeDeps({ savedFilters: { a: 'g:1', b: 'u:1' } }))
    f.addFilter('a', { options: [], labelFor: () => ({ label: 'Admins', icon: 'pi pi-users' }) })
    f.addFilter('b', { options: [], labelFor: async () => ({ label: 'Ann', icon: 'pi pi-user' }) })
    expect(optionsOf(f, 'a').find((o) => o.unlisted)).toMatchObject({ label: 'Admins', icon: 'pi pi-users' })
    expect(optionsOf(f, 'b').find((o) => o.unlisted)).toMatchObject({ label: 'u:1' })
    await flushPromises()
    expect(optionsOf(f, 'b').find((o) => o.unlisted)).toMatchObject({ label: 'Ann', icon: 'pi pi-user' })
  })

  it('drawn in the field: QdSearchFilter and QdMultiFilter', async () => {
    // PrimeVue's Select asks the screen's width: jsdom has no matchMedia
    window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
    const { default: QdSearchFilter } = await import('../../src/components/lists/filters/QdSearchFilter.vue')
    const { default: QdMultiFilter } = await import('../../src/components/lists/filters/QdMultiFilter.vue')
    const options = [{ label: 'Admins', value: 'g:1', icon: 'pi pi-users' }, { label: 'Ann', value: 'u:1', icon: 'pi pi-user' }]
    const one = mount(QdSearchFilter, { props: { modelValue: 'g:1', filter: { name: 'by', placeholder: 'By', searchOptions: async () => [] }, options }, global: { plugins: [PrimeVue] } })
    expect(one.find('.qd-filter-icon').classes()).toContain('pi-users')
    expect(one.text()).toContain('Admins')
    const many = mount(QdMultiFilter, { props: { modelValue: ['g:1', 'u:1'], filter: { name: 'by', placeholder: 'By', multiple: true }, options }, global: { plugins: [PrimeVue] } })
    const icons = many.findAll('.qd-multi-filter-chosen .qd-filter-icon').map((i) => i.classes().find((c) => c.startsWith('pi-')))
    expect(icons).toEqual(['pi-users', 'pi-user'])
  })
})
