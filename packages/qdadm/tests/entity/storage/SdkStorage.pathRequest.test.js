/**
 * A path request on an SdkStorage (#4069): `request('GET', 'distinct/x')`,
 * the call `EntityManager.request` and `optionsEndpoint` filters make, used
 * to be read as the SDK method name "GET".
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { SdkStorage } from '../../../src/entity/storage/SdkStorage'
import { EntityManager } from '../../../src/entity/EntityManager'
import { useListFilters } from '../../../src/composables/useListPage.filters'

function filtersFor(manager) {
  return useListFilters({
    entityName: 'jobs',
    manager,
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
    filterSessionKey: 'jobs',
    entityFilters: {},
    loadItems: vi.fn(),
    setSearch: vi.fn(),
  })
}

describe('SdkStorage path requests (#4069)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('runs them through the request option, with the sdk', async () => {
    const sdk = { listJobs: vi.fn() }
    const request = vi.fn(async () => ['a', 'b'])
    const storage = new SdkStorage({ sdk, request })

    const result = await storage.request('GET', 'distinct/run_id', { params: { limit: 5 } })

    expect(result).toEqual(['a', 'b'])
    expect(request).toHaveBeenCalledWith('GET', 'distinct/run_id', { params: { limit: 5 } }, sdk)
    expect(storage.supportsPathRequests).toBe(true)
  })

  it('says what is missing without the option', async () => {
    const storage = new SdkStorage({ sdk: {} })
    expect(storage.supportsPathRequests).toBe(false)
    await expect(storage.request('GET', 'distinct/run_id')).rejects.toThrow(
      /SdkStorage cannot run GET 'distinct\/run_id'.*request option/
    )
  })

  it('still calls an SDK method by name', async () => {
    const sdk = { getStats: vi.fn(async (p) => ({ data: { count: p.n } })) }
    const storage = new SdkStorage({ sdk, request: vi.fn() })
    expect(await storage.request('getStats', { n: 3 })).toEqual({ count: 3 })
  })

  it('feeds an optionsEndpoint filter through EntityManager.request', async () => {
    const storage = new SdkStorage({ sdk: {}, request: async () => ['nightly', 'manual'] })
    const f = filtersFor(new EntityManager({ name: 'jobs', storage }))
    f.addFilter('run_id', { optionsEndpoint: true })

    await f.loadFilterOptions()

    expect(f.filtersMap.value.get('run_id').options.map((o) => o.value)).toEqual([null, 'nightly', 'manual'])
  })

  it('warns at addFilter when the storage cannot run the request', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = filtersFor(new EntityManager({ name: 'jobs', storage: new SdkStorage({ sdk: {} }) }))
    f.addFilter('run_id', { optionsEndpoint: true })
    f.addFilter('run_id', { optionsEndpoint: true })

    const calls = warn.mock.calls.filter(([m]) => String(m).includes('cannot run a path request'))
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toContain('Filter "run_id" on "jobs"')
  })

  it('does not warn when the storage can', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = filtersFor(new EntityManager({ name: 'jobs', storage: new SdkStorage({ sdk: {}, request: async () => [] }) }))
    f.addFilter('run_id', { optionsEndpoint: true })
    expect(warn.mock.calls.some(([m]) => String(m).includes('path request'))).toBe(false)
  })
})
