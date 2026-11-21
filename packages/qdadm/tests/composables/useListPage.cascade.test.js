/**
 * Cascading filters (#5427): a filter's choices depend on other filters'
 * values. Read again with those values when one changes, the old choices
 * shown meanwhile, a late answer ignored, a value no longer offered cleared
 * the usual way (and the cascade goes on); `validate` may keep it.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useListFilters } from '../../src/composables/useListPage.filters'

const CHOICES = {
  providers: { it: ['legacy', 'sentry'], b2c: ['amazon'] },
  types: { legacy: ['php'], sentry: ['js'], amazon: ['failed'] },
}

function setup({ request, orchestrator = null } = {}) {
  const deps = {
    entityName: 'tasks',
    manager: {
      request:
        request ??
        vi.fn(async (_m, endpoint, opts) => {
          const p = opts?.params ?? {}
          if (endpoint === 'providers') return CHOICES.providers[p.universe] ?? []
          if (endpoint === 'types') return CHOICES.types[p.p] ?? []
          return []
        }),
    },
    orchestrator,
    items: ref([]),
    page: ref(1),
    pageSize: ref(10),
    searchQuery: ref(''),
    persister: null,
    routeStateScope: 'tasks',
    routeStateWrites: false,
    savedFilters: null,
    persistFilters: false,
    autoLoadFilters: false,
    filterSessionKey: 'tasks',
    entityFilters: {},
    loadItems: vi.fn(),
    setSearch: vi.fn(),
  }
  const f = useListFilters(deps)
  f.addFilter('universe', { options: [{ label: 'IT', value: 'it' }, { label: 'B2C', value: 'b2c' }] })
  return { f, deps }
}

const values = (f, name) => f.filtersMap.value.get(name).options.filter((o) => o.value !== null).map((o) => o.value)
const settle = async () => {
  await nextTick()
  await flushPromises()
  await nextTick()
  await flushPromises()
}

describe('cascading filters (#5427)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it("reads the choices with its dependencies' values, renamed when asked, blanks left out", async () => {
    const { f, deps } = setup()
    f.addFilter('provider', { optionsEndpoint: 'providers', dependsOn: ['universe'] })
    f.addFilter('type', { optionsEndpoint: 'types', dependsOn: { universe: 'u', provider: 'p' } })
    f.filterValues.value = { ...f.filterValues.value, universe: 'it', provider: 'legacy' }
    await f.loadFilterOptions()
    expect(deps.manager.request).toHaveBeenCalledWith('GET', 'providers', { params: { universe: 'it' } })
    expect(deps.manager.request).toHaveBeenCalledWith('GET', 'types', { params: { u: 'it', p: 'legacy' } })
    expect(values(f, 'provider')).toEqual(['legacy', 'sentry'])
    expect(values(f, 'type')).toEqual(['php'])
  })

  it('reads them again when a dependency changes; a value no longer offered is cleared, and the cascade goes on', async () => {
    const { f, deps } = setup()
    f.addFilter('provider', { optionsEndpoint: 'providers', dependsOn: ['universe'] })
    f.addFilter('type', { optionsEndpoint: 'types', dependsOn: { universe: 'u', provider: 'p' } })
    f.filterValues.value = { ...f.filterValues.value, universe: 'it', provider: 'legacy', type: 'php' }
    await f.loadFilterOptions()
    deps.loadItems.mockClear()
    f.setFilterValue('universe', 'b2c')
    await settle()
    expect(values(f, 'provider')).toEqual(['amazon'])
    // legacy is not a B2C provider: cleared, the list reloaded
    expect(f.filterValues.value.provider).toBe(null)
    expect(deps.loadItems).toHaveBeenCalled()
    // type read again without a provider: nothing offered, php cleared
    expect(f.filterValues.value.type).toBe(null)
    expect(deps.manager.request).toHaveBeenLastCalledWith('GET', 'types', { params: { u: 'b2c' } })
  })

  it('validate decides whether the value stands', async () => {
    const { f } = setup()
    const validate = vi.fn((value) => String(value).startsWith('leg'))
    f.addFilter('provider', { optionsEndpoint: 'providers', dependsOn: ['universe'], validate })
    f.filterValues.value = { ...f.filterValues.value, universe: 'it', provider: 'legacy' }
    await f.loadFilterOptions()
    f.setFilterValue('universe', 'b2c')
    await settle()
    expect(validate).toHaveBeenLastCalledWith('legacy', { options: [{ label: 'Amazon', value: 'amazon' }], values: { universe: 'b2c' } })
    expect(f.filterValues.value.provider).toBe('legacy')
  })

  it('the old choices stay while loading, and a late answer is ignored', async () => {
    const pending = []
    const request = vi.fn((_m, _e, opts) => new Promise((resolve) => pending.push({ universe: opts.params.universe, resolve })))
    const { f } = setup({ request })
    f.addFilter('provider', { optionsEndpoint: 'providers', dependsOn: ['universe'] })
    f.filterValues.value = { ...f.filterValues.value, universe: 'it' }
    const first = f.loadFilterOptions()
    await flushPromises()
    pending.shift().resolve(['legacy', 'sentry'])
    await first
    f.setFilterValue('universe', 'b2c')
    await settle()
    expect(f.filtersMap.value.get('provider')._optionsLoading).toBe(true)
    expect(values(f, 'provider')).toEqual(['legacy', 'sentry'])
    f.setFilterValue('universe', 'it')
    await settle()
    const [b2c, it] = pending
    it.resolve(['legacy'])
    await settle()
    b2c.resolve(['amazon'])
    await settle()
    expect(values(f, 'provider')).toEqual(['legacy'])
    expect(f.filtersMap.value.get('provider')._optionsLoading).toBe(false)
  })

  it('an entity source: its list, filtered by the values, the labels mapped again on each read', async () => {
    const list = vi.fn(async ({ filters }) => ({ items: filters.universe === 'it' ? [{ code: 'legacy', title: 'Legacy' }] : [{ code: 'amazon', title: 'Amazon' }] }))
    const { f } = setup({ orchestrator: { get: () => ({ list }) } })
    f.addFilter('provider', { optionsEntity: 'providers', optionLabel: 'title', optionValue: 'code', dependsOn: ['universe'] })
    f.filterValues.value = { ...f.filterValues.value, universe: 'it' }
    await f.loadFilterOptions()
    expect(list).toHaveBeenCalledWith({ page_size: 1000, filters: { universe: 'it' } })
    f.setFilterValue('universe', 'b2c')
    await settle()
    expect(f.filtersMap.value.get('provider').options.slice(1)).toEqual([{ label: 'Amazon', value: 'amazon' }])
  })

  it('an unknown dependency or a cycle: said, and that dependsOn ignored', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { f } = setup()
    f.addFilter('provider', { optionsEndpoint: 'providers', dependsOn: ['nope'] })
    f.addFilter('a', { optionsEndpoint: 'a', dependsOn: ['b'] })
    f.addFilter('b', { optionsEndpoint: 'b', dependsOn: ['a'] })
    await f.loadFilterOptions()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"nope", which the list does not declare'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('depends on itself'))
    expect(f.filtersMap.value.get('provider').dependsOn).toBeUndefined()
  })
})
