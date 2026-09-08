/**
 * The page number lives in the URL (#2113).
 *
 * It used to be the only piece of list state that survived nothing: filters,
 * search, sort and rows-per-page were all remembered, the page was not. List
 * → detail → back dropped the user on page 1, and a shared list link never
 * showed what the sender was looking at.
 *
 * These exercise the filters subsystem directly — the URL writer and the
 * restore path both live there.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useListFilters } from '../../src/composables/useListPage.filters'

function makeDeps({ query = {}, syncUrlParams = true } = {}) {
  const replaced = []
  const route = { query }
  const deps = {
    entityName: 'runs',
    manager: { request: vi.fn() },
    orchestrator: null,
    items: ref([]),
    page: ref(1),
    searchQuery: ref(''),
    route,
    router: {
      replace: (arg) => {
        replaced.push(arg.query)
        route.query = arg.query
      },
    },
    savedFilters: null,
    persistFilters: false,
    syncUrlParams,
    autoLoadFilters: false,
    filterSessionKey: 'runs',
    entityFilters: {},
    loadItems: vi.fn(),
    setSearch: vi.fn(),
    invokeFilterAlterHook: vi.fn(async () => {}),
  }
  return { deps, replaced }
}

describe('list page number in the URL', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('writes the page once it leaves the default', () => {
    const { deps, replaced } = makeDeps()
    const f = useListFilters(deps)

    deps.page.value = 4
    f.writeStateToUrl()

    expect(replaced.at(-1)).toMatchObject({ page: '4' })
  })

  it('keeps page 1 out of the URL rather than writing it', () => {
    // A pristine list must leave a clean link.
    const { deps, replaced } = makeDeps({ query: { page: '5' } })
    const f = useListFilters(deps)

    deps.page.value = 1
    f.writeStateToUrl()

    expect(replaced.at(-1)).not.toHaveProperty('page')
  })

  it('restores the page from the URL', () => {
    const { deps } = makeDeps({ query: { page: '3' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    // Restored BEFORE the first loadItems, or the list would fetch page 1
    // and then page 3.
    expect(deps.page.value).toBe(3)
  })

  it('ignores a nonsense page instead of asking the backend for it', () => {
    for (const bad of ['0', '-2', 'abc', '1.5', '']) {
      const { deps } = makeDeps({ query: { page: bad } })
      const f = useListFilters(deps)

      f.restoreFilters()

      expect(deps.page.value).toBe(1)
    }
  })

  it('writes nothing when syncUrlParams is off', () => {
    const { deps, replaced } = makeDeps({ syncUrlParams: false })
    const f = useListFilters(deps)

    deps.page.value = 7
    f.writeStateToUrl()

    expect(replaced).toHaveLength(0)
  })

  it('drops the page when filters change, since results are renumbered', () => {
    const { deps, replaced } = makeDeps()
    const f = useListFilters(deps)
    deps.page.value = 6

    f.onFiltersChanged()

    expect(deps.page.value).toBe(1)
    expect(replaced.at(-1)).not.toHaveProperty('page')
  })

  it('drops the page when filters are cleared', () => {
    const { deps, replaced } = makeDeps({ query: { page: '4' } })
    const f = useListFilters(deps)
    f.addFilter('state', { default: null })
    deps.page.value = 4

    f.clearFilters()

    expect(deps.page.value).toBe(1)
    expect(replaced.at(-1)).not.toHaveProperty('page')
  })

  it('carries the page alongside filters and search', () => {
    const { deps, replaced } = makeDeps()
    const f = useListFilters(deps)
    f.addFilter('state', { default: null })
    f.setFilterValue('state', 'running')
    deps.searchQuery.value = 'nginx'
    deps.page.value = 2

    f.writeStateToUrl()

    expect(replaced.at(-1)).toMatchObject({ state: 'running', search: 'nginx', page: '2' })
  })
})

describe('reserved query keys', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('warns about a filter named `page`, naming what wins', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = makeDeps()
    const f = useListFilters(deps)

    f.addFilter('page', {})

    expect(spy).toHaveBeenCalledTimes(1)
    expect(String(spy.mock.calls[0][0])).toContain('page number')
  })

  it('warns about a filter named `search` too', () => {
    // This collision predates the page one and was never reported — which is
    // how quiet it is.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = makeDeps()
    const f = useListFilters(deps)

    f.addFilter('search', {})

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('warns once per name, not on every re-declaration', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = makeDeps()
    const f = useListFilters(deps)

    f.addFilter('page', {})
    f.addFilter('page', {})
    f.addFilter('page', {})

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('stays silent when the URL sync is off — there is no collision then', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = makeDeps({ syncUrlParams: false })
    const f = useListFilters(deps)

    f.addFilter('page', {})

    expect(spy).not.toHaveBeenCalled()
  })

  it('says nothing about an ordinary filter name', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { deps } = makeDeps()
    const f = useListFilters(deps)

    f.addFilter('state', {})

    expect(spy).not.toHaveBeenCalled()
  })
})
