/**
 * Filter options are fetched in parallel, and no longer gate the rows
 * (#1934).
 *
 * The loop was sequential and sat between `restoreFilters()` and the first
 * `loadItems()`: a page whose filters pulled options from related entities
 * showed nothing until every one of those round trips had returned, for
 * content nobody needs in order to read the table.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useListFilters } from '../../src/composables/useListPage.filters'

/** Resolves after `ms` of fake time, recording when it started and ended. */
function makeOrchestrator(timeline, delay = 50) {
  return {
    get(name) {
      return {
        list: async () => {
          timeline.push({ entity: name, at: Date.now(), phase: 'start' })
          await new Promise((r) => setTimeout(r, delay))
          timeline.push({ entity: name, at: Date.now(), phase: 'end' })
          return { items: [{ id: 1, name: 'one' }] }
        },
      }
    },
  }
}

function makeDeps(overrides = {}) {
  return {
    entityName: 'runs',
    manager: { request: vi.fn(async () => [{ id: 1, label: 'x' }]) },
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
    filterSessionKey: 'runs',
    entityFilters: {},
    loadItems: vi.fn(),
    setSearch: vi.fn(),
    ...overrides,
  }
}

describe('filter options are fetched in parallel', () => {
  it('runs different entities side by side, not in a queue', async () => {
    const timeline = []
    const deps = makeDeps({ orchestrator: makeOrchestrator(timeline) })
    const f = useListFilters(deps)
    f.addFilter('a', { optionsEntity: 'alpha' })
    f.addFilter('b', { optionsEntity: 'beta' })
    f.addFilter('c', { optionsEntity: 'gamma' })

    const started = Date.now()
    await f.loadFilterOptions()
    const elapsed = Date.now() - started

    // Sequential would be ~150ms; parallel is ~50ms. Generous bound so the
    // test measures the shape, not the machine.
    expect(elapsed).toBeLessThan(130)
    const firstEnd = timeline.find((e) => e.phase === 'end').at
    const lastStart = timeline.filter((e) => e.phase === 'start').at(-1).at
    // Every fetch had started before the first one finished.
    expect(lastStart).toBeLessThanOrEqual(firstEnd)
  })

  it('still chains two filters that share one source entity', async () => {
    // Sequential execution had one accidental virtue: the second filter read
    // the cache the first had filled. Parallel would make that two fetches.
    const timeline = []
    const deps = makeDeps({ orchestrator: makeOrchestrator(timeline) })
    const f = useListFilters(deps)
    f.addFilter('owner', { optionsEntity: 'users' })
    f.addFilter('reviewer', { optionsEntity: 'users' })

    await f.loadFilterOptions()

    const users = timeline.filter((e) => e.entity === 'users')
    // start, end, start, end — never two starts back to back.
    expect(users.map((e) => e.phase)).toEqual(['start', 'end', 'start', 'end'])
  })

  it('skips filters that already carry their options', async () => {
    const timeline = []
    const deps = makeDeps({ orchestrator: makeOrchestrator(timeline) })
    const f = useListFilters(deps)
    f.addFilter('state', { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] })

    await f.loadFilterOptions()

    expect(timeline).toHaveLength(0)
  })

  it('one failing filter does not sink the others', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const timeline = []
    const orchestrator = {
      get(name) {
        if (name === 'broken') return { list: async () => { throw new Error('boom') } }
        return makeOrchestrator(timeline, 10).get(name)
      },
    }
    const deps = makeDeps({ orchestrator })
    const f = useListFilters(deps)
    f.addFilter('bad', { optionsEntity: 'broken' })
    f.addFilter('good', { optionsEntity: 'fine' })

    await expect(f.loadFilterOptions()).resolves.toBeUndefined()

    expect(f.filtersMap.value.get('good').options?.length).toBeGreaterThan(1)
    spy.mockRestore()
  })
})

describe('loadFilterOptions no longer invokes filter:alter', () => {
  it('leaves the hook to the caller, so it can run before the rows load', async () => {
    // #1934 lot 2: the hook establishes what the query asks for, so it moved
    // out of the network path and into onMounted, ahead of loadItems().
    const deps = makeDeps()
    const f = useListFilters(deps)
    f.addFilter('state', { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] })

    // The dependency is gone entirely — passing it would be dead weight.
    expect(deps).not.toHaveProperty('invokeFilterAlterHook')
    await expect(f.loadFilterOptions()).resolves.toBeUndefined()
  })
})
