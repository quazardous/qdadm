/**
 * A filter type qdadm cannot render says so (#2147).
 *
 * Reported by a consumer who declared `type: 'text'` — not in the union —
 * on two filters. `ListPage` is binary: an autocomplete, or a `Select` for
 * everything else, unknown types included. So the filters rendered as
 * dropdowns with `options: undefined`, read **"No available options"**, and
 * users concluded there was nothing to choose. They had never filtered
 * anything since the day they were written.
 *
 * TWO HOLES, and the runtime one is only half of it:
 *
 * 1. Nothing warned at declaration time.
 * 2. **Nothing failed to compile either.** `addFilter` took
 *    `Omit<FilterConfig, 'name'>`, and `FilterConfig` carries an index
 *    signature — so `keyof` includes `string`, `Exclude<string, 'name'>` is
 *    still `string`, and the `Omit` collapsed to a bare
 *    `{ [x: string]: unknown }`, erasing every declared property. No filter
 *    option was type-checked at all: not `type`, not `optionLabel`, not
 *    `local_filter`.
 *
 * The type half is covered by `tests/types/filterOptions.types.test.ts`,
 * which only a type-checker can judge. These cover the runtime half — the
 * one that protects a JavaScript consumer, who gets no typing whatever.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useListFilters } from '../../src/composables/useListPage.filters'
import { FILTER_TYPES } from '../../src/composables/useListPage.types'
import { UrlPersister } from '../../src/routeState/UrlPersister'

function makeDeps() {
  const route = { query: {} }
  const router = { replace: vi.fn() }
  return {
    entityName: 'offers',
    manager: { request: vi.fn() },
    orchestrator: null,
    items: ref([]),
    page: ref(1),
    pageSize: ref(10),
    searchQuery: ref(''),
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
}

describe('an unrenderable filter type (#2147)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('warns, naming the filter and what will happen instead', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = useListFilters(makeDeps())

    f.addFilter('item_id', { type: 'text', placeholder: 'Offer ref' })

    expect(spy).toHaveBeenCalledTimes(1)
    const message = String(spy.mock.calls[0][0])
    // The name, because three screens later there is only an empty control.
    expect(message).toContain('item_id')
    expect(message).toContain('text')
    // And what happens INSTEAD, which is the whole point of the warning.
    expect(message).toContain('No available options')
  })

  it('lists the types that would have worked', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = useListFilters(makeDeps())

    f.addFilter('item_id', { type: 'text' })

    const message = String(spy.mock.calls[0][0])
    for (const type of FILTER_TYPES) expect(message).toContain(type)
  })

  it.each(FILTER_TYPES)('says nothing about %s', (type) => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = useListFilters(makeDeps())

    f.addFilter('state', { type })

    expect(spy).not.toHaveBeenCalled()
  })

  it('says nothing when no type is given at all', () => {
    // Omitting `type` is legitimate — the dropdown is the default.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = useListFilters(makeDeps())

    f.addFilter('state', { placeholder: 'State' })

    expect(spy).not.toHaveBeenCalled()
  })

  it('warns once per filter, not on every re-declaration', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = useListFilters(makeDeps())

    f.addFilter('item_id', { type: 'text' })
    f.addFilter('item_id', { type: 'text' })
    f.addFilter('item_id', { type: 'text' })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('warns about each bad filter separately', () => {
    // Two filters were wrong in the report, and hearing about one of them
    // would have sent someone hunting for a single cause.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = useListFilters(makeDeps())

    f.addFilter('item_id', { type: 'text' })
    f.addFilter('source_site', { type: 'text' })

    expect(spy).toHaveBeenCalledTimes(2)
  })
})
