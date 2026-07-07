/**
 * Focused unit tests for the subsystems extracted from useListPage
 * (qdadm #1195, KPI-8): useListFilters and useListAlterHooks.
 *
 * The composables are exercised directly with mocked deps — the composed
 * behavior inside useListPage stays covered by useListPage.test.js.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useListFilters } from '../../src/composables/useListPage.filters'
import { useListAlterHooks } from '../../src/composables/useListPage.alterHooks'
import { useActionRegistry } from '../../src/composables/useActionRegistry'

beforeEach(() => sessionStorage.clear())

function makeFilterDeps(overrides = {}) {
  return {
    entityName: 'books',
    manager: { request: vi.fn() },
    orchestrator: null,
    items: ref([]),
    page: ref(3),
    searchQuery: ref(''),
    route: { query: {} },
    router: { replace: vi.fn() },
    savedFilters: null,
    persistFilters: true,
    syncUrlParams: false,
    autoLoadFilters: true,
    filterSessionKey: 'books',
    entityFilters: {},
    loadItems: vi.fn(),
    setSearch: vi.fn(),
    invokeFilterAlterHook: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('useListFilters (#1195)', () => {
  it('addFilter applies defaults and seeds the value', () => {
    const f = useListFilters(makeFilterDeps())
    f.addFilter('status', { default: 'open' })
    expect(f.filtersMap.value.get('status')).toMatchObject({
      name: 'status',
      type: 'select',
      placeholder: 'status',
    })
    expect(f.filterValues.value.status).toBe('open')
    expect(f.filters.value).toHaveLength(1)
  })

  it('updateFilters resets the page, reloads and persists non-empty values', () => {
    const deps = makeFilterDeps()
    const f = useListFilters(deps)
    f.addFilter('status', {})
    f.updateFilters({ status: 'open' })
    expect(deps.page.value).toBe(1)
    expect(deps.loadItems).toHaveBeenCalledOnce()
    expect(JSON.parse(sessionStorage.getItem('qdadm_filters_books'))).toEqual({ status: 'open' })
  })

  it('clearFilters restores defaults, clears search and the session', () => {
    const deps = makeFilterDeps()
    const f = useListFilters(deps)
    f.addFilter('status', { default: 'open' })
    f.updateFilters({ status: 'closed' })
    deps.searchQuery.value = 'dune'
    f.clearFilters()
    expect(f.filterValues.value.status).toBe('open')
    expect(deps.searchQuery.value).toBe('')
    expect(sessionStorage.getItem('qdadm_filters_books')).toBeNull()
  })

  it('isFilterAtDefault and hasActiveFilters track modifications', () => {
    const deps = makeFilterDeps()
    const f = useListFilters(deps)
    f.addFilter('status', { default: null })
    expect(f.isFilterAtDefault('status')).toBe(true)
    expect(f.hasActiveFilters.value).toBe(false)
    f.setFilterValue('status', 'open')
    expect(f.isFilterAtDefault('status')).toBe(false)
    expect(f.hasActiveFilters.value).toBe(true)
  })

  it('initFromRegistry wires search and filters from the injected registry', () => {
    const deps = makeFilterDeps({
      entityFilters: {
        books: {
          search: { placeholder: 'Search books...' },
          filters: [{ name: 'genre', options: [{ label: 'SF', value: 'sf' }] }],
        },
      },
    })
    const f = useListFilters(deps)
    f.initFromRegistry()
    expect(deps.setSearch).toHaveBeenCalledWith({ placeholder: 'Search books...' })
    expect(f.filtersMap.value.has('genre')).toBe(true)
  })

  it('restoreFilters coerces URL query values (bool/null/number)', () => {
    const deps = makeFilterDeps({
      route: { query: { active: 'true', level: '3', ghost: 'null', search: 'dune' } },
    })
    const f = useListFilters(deps)
    f.addFilter('active', {})
    f.addFilter('level', {})
    f.addFilter('ghost', {})
    f.restoreFilters()
    expect(f.filterValues.value).toMatchObject({ active: true, level: 3, ghost: null })
    expect(deps.searchQuery.value).toBe('dune')
  })

  it('loadFilterOptions maps optionsEndpoint responses and calls the alter hook', async () => {
    const deps = makeFilterDeps({
      manager: { request: vi.fn().mockResolvedValue(['draft', 'published']) },
    })
    const f = useListFilters(deps)
    f.addFilter('status', { optionsEndpoint: true })
    await f.loadFilterOptions()
    expect(deps.manager.request).toHaveBeenCalledWith('GET', 'distinct/status')
    const def = f.filtersMap.value.get('status')
    expect(def.options[0]).toMatchObject({ value: null }) // "All ..." entry
    expect(def.options.slice(1)).toEqual([
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
    ])
    expect(deps.invokeFilterAlterHook).toHaveBeenCalledOnce()
  })

  it('updateCacheBasedFilters builds options from loaded items', async () => {
    const deps = makeFilterDeps({
      items: ref([{ region: 'europe' }, { region: 'asia' }, { region: 'europe' }]),
    })
    const f = useListFilters(deps)
    f.addFilter('region', { optionsFromCache: true })
    await f.updateCacheBasedFilters()
    const def = f.filtersMap.value.get('region')
    expect(def._optionsLoaded).toBe(true)
    const values = def.options.map((o) => o.value)
    expect(values).toContain('europe')
    expect(values).toContain('asia')
  })
})

function makeHookDeps(hooks) {
  const actionRegistry = useActionRegistry({
    defaults: { severity: 'secondary' },
    resolve: (a) => a,
  })
  return {
    deps: {
      hooks,
      entity: 'books',
      manager: { name: 'books' },
      columnsMap: ref(new Map()),
      filtersMap: ref(new Map()),
      filterValues: ref({}),
      headerActionsMap: ref(new Map()),
      actionRegistry,
    },
    actionRegistry,
  }
}

describe('useListAlterHooks (#1195)', () => {
  it('is a no-op without a hook registry', async () => {
    const { deps } = makeHookDeps(null)
    const h = useListAlterHooks(deps)
    await expect(h.invokeListAlterHook()).resolves.toBeUndefined()
    await expect(h.invokeFilterAlterHook()).resolves.toBeUndefined()
  })

  it('list:alter can add actions — applied through the registry (order stays in sync)', async () => {
    const hooks = {
      alter: vi.fn(async (name, config) => ({
        ...config,
        actions: [...config.actions, { name: 'custom', label: 'Custom', onClick: () => {} }],
      })),
      hasHook: () => false,
    }
    const { deps, actionRegistry } = makeHookDeps(hooks)
    actionRegistry.add({ name: 'edit', label: 'Edit', onClick: () => {} })
    const h = useListAlterHooks(deps)
    await h.invokeListAlterHook()
    expect(actionRegistry.order.value).toEqual(['edit', 'custom'])
    expect(actionRegistry.actionsMap.value.has('custom')).toBe(true)
  })

  it('chains the entity-scoped hook after the global one', async () => {
    const calls = []
    const hooks = {
      alter: vi.fn(async (name, config) => {
        calls.push(name)
        return config
      }),
      hasHook: (name) => name === 'books:list:alter',
    }
    const { deps } = makeHookDeps(hooks)
    const h = useListAlterHooks(deps)
    await h.invokeListAlterHook()
    expect(calls).toEqual(['list:alter', 'books:list:alter'])
  })

  it('filter:alter replaces filters and seeds missing values', async () => {
    const hooks = {
      alter: vi.fn(async (name, snapshot) => ({
        ...snapshot,
        filters: [{ name: 'status', default: 'open' }],
      })),
      hasHook: () => false,
    }
    const { deps } = makeHookDeps(hooks)
    const h = useListAlterHooks(deps)
    await h.invokeFilterAlterHook()
    expect(deps.filtersMap.value.get('status')).toMatchObject({ name: 'status' })
    expect(deps.filterValues.value.status).toBe('open')
  })

  it('list:alter applies altered columns and header actions', async () => {
    const hooks = {
      alter: vi.fn(async (name, config) => ({
        ...config,
        columns: [{ field: 'title', header: 'Title' }],
        headerActions: [{ name: 'export', label: 'Export' }],
      })),
      hasHook: () => false,
    }
    const { deps } = makeHookDeps(hooks)
    const h = useListAlterHooks(deps)
    await h.invokeListAlterHook()
    expect(deps.columnsMap.value.get('title')).toMatchObject({ header: 'Title' })
    expect(deps.headerActionsMap.value.get('export')).toMatchObject({ label: 'Export' })
  })
})
