/**
 * A filter's choices (#5457): cache options built on an empty list and with a
 * value already set (from the URL), kept only once complete; the app's own
 * choices at any time (setFilterOptions); the value filtered on always among
 * the shown choices.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useListFilters } from '../../src/composables/useListPage.filters'

function makeDeps(overrides = {}) {
  return {
    entityName: 'tasks',
    manager: { request: vi.fn(async () => [{ id: 'a', label: 'Alice' }, { id: 'b', label: 'Bob' }]) },
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

const me = (options) => [...options, { label: 'Me', value: '@me' }]
const shown = (f, name) => f.filters.value.find((x) => x.name === name).options.map((o) => o.value)

describe('cache options (#5457)', () => {
  it('an empty list: the processor\'s choices now, the real ones once rows come', async () => {
    const deps = makeDeps()
    const f = useListFilters(deps)
    f.addFilter('taken_by', { optionsFromCache: true, processor: me })
    await f.updateCacheBasedFilters()
    let def = f.filtersMap.value.get('taken_by')
    expect(def.options.map((o) => o.value)).toEqual([null, '@me'])
    expect(def._optionsLoaded).toBe(false)

    deps.items.value = [{ taken_by: 'alice' }, { taken_by: 'bob' }]
    await f.updateCacheBasedFilters()
    def = f.filtersMap.value.get('taken_by')
    expect(def.options.map((o) => o.value)).toEqual([null, 'alice', 'bob', '@me'])
    expect(def._optionsLoaded).toBe(true)
  })

  it('a value from the URL: shown now, the full set once the filter is cleared', async () => {
    // The rows came back filtered by it
    const deps = makeDeps({ items: ref([{ taken_by: 'alice' }]), savedFilters: { taken_by: 'alice' } })
    const f = useListFilters(deps)
    f.addFilter('taken_by', { optionsFromCache: true })
    await f.updateCacheBasedFilters()
    expect(shown(f, 'taken_by')).toEqual([null, 'alice'])
    expect(f.filtersMap.value.get('taken_by')._optionsLoaded).toBe(false)

    // Cleared, the list loads unfiltered: the whole set, kept
    f.filterValues.value.taken_by = null
    deps.items.value = [{ taken_by: 'alice' }, { taken_by: 'bob' }, { taken_by: 'carol' }]
    await f.updateCacheBasedFilters()
    expect(shown(f, 'taken_by')).toEqual([null, 'alice', 'bob', 'carol'])
    expect(f.filtersMap.value.get('taken_by')._optionsLoaded).toBe(true)
  })
})

describe('setFilterOptions (#5457)', () => {
  it('replaces the choices, adds "All", and the loaders leave them alone', async () => {
    const deps = makeDeps({ items: ref([{ taken_by: 'zed' }]) })
    const f = useListFilters(deps)
    f.addFilter('taken_by', { optionsFromCache: true })
    f.addFilter('owner', { optionsEndpoint: 'options/owner' })
    f.setFilterOptions('taken_by', [{ label: 'Alice', value: 'a' }])
    f.setFilterOptions('owner', [{ label: 'Nobody', value: null }, { label: 'Bob', value: 'b' }])
    expect(shown(f, 'taken_by')).toEqual([null, 'a'])
    // Its own null choice: no second "All"
    expect(shown(f, 'owner')).toEqual([null, 'b'])

    await f.updateCacheBasedFilters()
    await f.loadFilterOptions()
    expect(shown(f, 'taken_by')).toEqual([null, 'a'])
    expect(shown(f, 'owner')).toEqual([null, 'b'])
    expect(deps.manager.request).not.toHaveBeenCalled()

    // Again, later: the new ones
    f.setFilterOptions('taken_by', [{ label: 'Carol', value: 'c' }])
    expect(shown(f, 'taken_by')).toEqual([null, 'c'])
  })

  it('an unknown filter: a warning, nothing else', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = import.meta.env.DEV
    import.meta.env.DEV = true
    const f = useListFilters(makeDeps())
    f.setFilterOptions('nope', [{ label: 'X', value: 'x' }])
    expect(warn.mock.calls.flat().join(' ')).toMatch(/no filter "nope"/)
    expect(f.filtersMap.value.size).toBe(0)
    import.meta.env.DEV = env
    warn.mockRestore()
  })
})

describe('the value filtered on is among the shown choices (#5457)', () => {
  it('static and loaded choices: a missing value is added, as its raw value; the declared ones are untouched', async () => {
    const deps = makeDeps({ savedFilters: { status: 'archived', owner: 'zoe', tags: ['x', 'y'] } })
    const f = useListFilters(deps)
    f.addFilter('status', { options: [{ label: 'Open', value: 'open' }] })
    f.addFilter('owner', { optionsEndpoint: 'options/owner' })
    f.addFilter('tags', { type: 'multiselect', options: [{ label: 'X', value: 'x' }] })
    await f.loadFilterOptions()

    const status = f.filters.value.find((x) => x.name === 'status')
    expect(status.options.map((o) => [o.label, o.value])).toEqual([['All Status', null], ['Open', 'open'], ['archived', 'archived']])
    expect(shown(f, 'owner')).toEqual([null, 'a', 'b', 'zoe'])
    expect(shown(f, 'tags')).toEqual([null, 'x', 'y'])
    // Only what the bar is given
    expect(f.filtersMap.value.get('status').options.map((o) => o.value)).toEqual([null, 'open'])

    // Among them already (a number from the URL as a string): not twice
    f.addFilter('year', { options: [{ label: '1965', value: 1965 }] })
    f.filterValues.value.year = '1965'
    expect(shown(f, 'year')).toEqual([null, 1965])
    // Cleared: nothing added
    f.filterValues.value.status = null
    expect(shown(f, 'status')).toEqual([null, 'open'])
  })
})
