/**
 * The page number lives in the URL (#2113).
 *
 * It used to be the only piece of list state that survived nothing: filters,
 * search, sort and rows-per-page were all remembered, the page was not. List
 * → detail → back dropped the user on page 1, and a shared list link never
 * showed what the sender was looking at.
 *
 * These exercise the filters subsystem directly — the URL writer and the
 * restore path both live there, now through a `RouteStatePersister` (#2146).
 * That is why the keys are scoped: `runs.page`, not `page`. Two lists on one
 * route no longer fight over a single `page` parameter. Note the array form
 * of `toHaveProperty` throughout — the string form would read the dot as a
 * path and assert on a `runs` object that does not exist.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useListFilters } from '../../src/composables/useListPage.filters'
import { UrlPersister } from '../../src/routeState/UrlPersister'

function makeDeps({ query = {}, syncUrlParams = true } = {}) {
  const replaced = []
  const route = { query }
  const router = {
    replace: (arg) => {
      replaced.push(arg.query)
      route.query = arg.query
    },
  }
  const deps = {
    entityName: 'runs',
    manager: { request: vi.fn() },
    orchestrator: null,
    items: ref([]),
    page: ref(1),
    searchQuery: ref(''),
    route,
    router,
    // Built the way useListPage builds it: the persister always exists, and
    // `syncUrlParams` decides only whether it may write — which is what that
    // flag has always meant.
    persister: new UrlPersister({ router, route }),
    routeStateScope: 'runs',
    routeStateWrites: syncUrlParams,
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

    expect(replaced.at(-1)).toMatchObject({ 'runs.page': '4' })
  })

  it('keeps page 1 out of the URL rather than writing it', () => {
    // A pristine list must leave a clean link.
    const { deps, replaced } = makeDeps({ query: { 'runs.page': '5' } })
    const f = useListFilters(deps)

    deps.page.value = 1
    f.writeStateToUrl()

    expect(replaced.at(-1)).not.toHaveProperty(['runs.page'])
  })

  it('restores the page from the URL', () => {
    const { deps } = makeDeps({ query: { 'runs.page': '3' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    // Restored BEFORE the first loadItems, or the list would fetch page 1
    // and then page 3.
    expect(deps.page.value).toBe(3)
  })

  it('ignores a nonsense page instead of asking the backend for it', () => {
    for (const bad of ['0', '-2', 'abc', '1.5', '']) {
      const { deps } = makeDeps({ query: { 'runs.page': bad } })
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
    expect(replaced.at(-1)).not.toHaveProperty(['runs.page'])
  })

  it('drops the page when filters are cleared', () => {
    const { deps, replaced } = makeDeps({ query: { 'runs.page': '4' } })
    const f = useListFilters(deps)
    f.addFilter('state', { default: null })
    deps.page.value = 4

    f.clearFilters()

    expect(deps.page.value).toBe(1)
    expect(replaced.at(-1)).not.toHaveProperty(['runs.page'])
  })

  it('carries the page alongside filters and search', () => {
    const { deps, replaced } = makeDeps()
    const f = useListFilters(deps)
    f.addFilter('state', { default: null })
    f.setFilterValue('state', 'running')
    deps.searchQuery.value = 'nginx'
    deps.page.value = 2

    f.writeStateToUrl()

    expect(replaced.at(-1)).toMatchObject({
      'runs.state': 'running',
      'runs.search': 'nginx',
      'runs.page': '2',
    })
  })

  it('still reads a link written before the keys were scoped', () => {
    // Links people bookmarked or pasted into tickets carry the flat shape.
    // Dropping them silently would show the reader a different screen than
    // the sender saw, with no error anywhere.
    const { deps } = makeDeps({ query: { page: '3' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    expect(deps.page.value).toBe(3)
  })

  it('does not read another list\'s page as its own', () => {
    // The flat fallback must not turn into a free-for-all: `jobs.page`
    // belongs to the jobs list, and handing it to this one would be worse
    // than ignoring it.
    const { deps } = makeDeps({ query: { 'jobs.page': '9' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    expect(deps.page.value).toBe(1)
  })

  it('retires the flat key it inherited rather than leaving two', () => {
    // Otherwise the next read finds both, and the stale flat one wins.
    const { deps, replaced } = makeDeps({ query: { page: '3' } })
    const f = useListFilters(deps)

    deps.page.value = 5
    f.writeStateToUrl()

    expect(replaced.at(-1)).toMatchObject({ 'runs.page': '5' })
    expect(replaced.at(-1)).not.toHaveProperty('page')
  })

  it('clears a flat key too, instead of leaving the URL claiming a page', () => {
    // Arrive on a pre-scope link, clear the filters: the list shows page 1,
    // and the address must not still say page 4 — a refresh would restore
    // exactly what was just cleared.
    const { deps, replaced } = makeDeps({ query: { page: '4' } })
    const f = useListFilters(deps)
    f.addFilter('state', { default: null })
    deps.page.value = 4

    f.clearFilters()

    expect(replaced.at(-1)).not.toHaveProperty('page')
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
