/**
 * A search term that looks like a number survives the round trip (#2147).
 *
 * The URL persister coerces on read, deliberately: `?level=42` should come
 * back as the number 42, because a query string is meant to be read by people
 * and `'42'` would compare wrong everywhere. `restoreFilters` then guarded the
 * search with `typeof stored.search === 'string'`.
 *
 * Those two are fine apart and wrong together. A search for a REFERENCE
 * NUMBER — an order id, an invoice, a phone number — is written to the URL as
 * a string, read back as a number, and then dropped by the guard. The box
 * comes back empty, the list unfiltered, and the link somebody shared shows
 * the recipient something else.
 *
 * Reported shape: a consumer whose offers list is searched by reference
 * prefix, typing `9876667194`.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useListFilters } from '../../src/composables/useListPage.filters'
import { UrlPersister } from '../../src/routeState/UrlPersister'

function makeDeps({ query = {} } = {}) {
  const replaced = []
  const route = { query }
  const router = {
    replace: (arg) => {
      replaced.push(arg.query)
      route.query = arg.query
    },
  }
  const deps = {
    entityName: 'offers',
    manager: { request: vi.fn() },
    orchestrator: null,
    items: ref([]),
    page: ref(1),
    pageSize: ref(10),
    searchQuery: ref(''),
    route,
    router,
    persister: new UrlPersister({ router, route }),
    routeStateScope: 'offers',
    routeStateWrites: true,
    savedFilters: null,
    persistFilters: false,
    autoLoadFilters: false,
    filterSessionKey: 'offers',
    entityFilters: {},
    loadItems: vi.fn(),
    setSearch: vi.fn(),
    invokeFilterAlterHook: vi.fn(async () => {}),
  }
  return { deps, replaced }
}

describe('a numeric search term (#2147)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('is restored from the URL instead of being dropped', () => {
    const { deps } = makeDeps({ query: { 'offers.search': '9876667194' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    expect(deps.searchQuery.value).toBe('9876667194')
  })

  it('stays a string, so the box shows what was typed', () => {
    // `searchQuery` feeds an <input>, and it reaches the storage as
    // `params.search`. A number there is a different value than the one the
    // user typed, and any consumer comparing or concatenating it sees that.
    const { deps } = makeDeps({ query: { 'offers.search': '007' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    expect(typeof deps.searchQuery.value).toBe('string')
    // And the leading zero survives, which a Number() round trip destroys.
    expect(deps.searchQuery.value).toBe('007')
  })

  it('survives a full write-then-read round trip', () => {
    const { deps, replaced } = makeDeps()
    const f = useListFilters(deps)
    deps.searchQuery.value = '9876667194'

    f.writeStateToUrl()
    deps.searchQuery.value = ''
    f.restoreFilters()

    expect(replaced.at(-1)).toMatchObject({ 'offers.search': '9876667194' })
    expect(deps.searchQuery.value).toBe('9876667194')
  })

  it('still restores an ordinary word', () => {
    const { deps } = makeDeps({ query: { 'offers.search': 'nginx' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    expect(deps.searchQuery.value).toBe('nginx')
  })

  it('ignores an empty term rather than restoring a blank', () => {
    const { deps } = makeDeps({ query: { 'offers.search': '' } })
    const f = useListFilters(deps)

    f.restoreFilters()

    expect(deps.searchQuery.value).toBe('')
  })
})
