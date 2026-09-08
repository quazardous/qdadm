/**
 * useListFilters — the filter subsystem of useListPage (#1195, KPI-8).
 *
 * Mechanical extraction: owns the filter state (filtersMap/filterValues),
 * the three option-source modes (optionsEntity / optionsEndpoint /
 * optionsFromCache), session persistence, URL sync and registry auto-load.
 * useListPage composes it back in; behavior is unchanged.
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { FilterQuery, type QueryOrchestratorLike } from '../query/FilterQuery'
import type { FilterConfig, SearchConfig } from './useListPage.types'
import type { RouteStatePersister } from '../routeState'
import {
  SMART_FILTER_THRESHOLD,
  clearSessionFilters,
  setSessionFilters,
  snakeToTitle,
} from './useListPage.utils'

/** Dependencies injected by useListPage. */
export interface UseListFiltersDeps {
  /** Entity name used for the registry lookup. */
  entityName: string
  /** EntityManager (needs .request for optionsEndpoint mode). */
  manager: { request: (method: string, endpoint: string) => Promise<unknown> }
  /** Orchestrator, forwarded to FilterQuery for optionsEntity mode. */
  orchestrator: QueryOrchestratorLike | null | undefined
  /** Loaded list items (source for optionsFromCache mode). */
  items: Ref<unknown[]>
  /** Current page ref — filter changes reset it to 1. */
  page: Ref<number>
  /** Rows per page — persisted alongside the rest (#2146). */
  pageSize: Ref<number>
  /** Search query ref (shared with the search subsystem). */
  searchQuery: Ref<string>
  /** Session-restored filter values (already stripped of _search). */
  savedFilters: Record<string, unknown> | null
  persistFilters: boolean
  /** Where this list's state is remembered (#2146). */
  persister: RouteStatePersister | null
  /** This list's namespace, so two lists on one route stop colliding. */
  routeStateScope: string
  /**
   * Whether this list may WRITE its state back.
   *
   * Separate from having a persister because reading and writing were always
   * separate here: `syncUrlParams: false` stopped the query string being
   * written and never stopped it being read, so a hand-typed deep link still
   * restored. Collapsing the two would have changed that quietly.
   */
  routeStateWrites: boolean
  autoLoadFilters: boolean
  filterSessionKey: string
  /** Entity filters registry (injected by the consuming app). */
  entityFilters: Record<string, { search?: SearchConfig; filters?: FilterConfig[] }>
  /** Thunks — resolved lazily, the targets are declared later in useListPage. */
  loadItems: () => void
  setSearch: (searchCfg: Partial<SearchConfig>) => void
}

export interface UseListFiltersReturn {
  filtersMap: Ref<Map<string, FilterConfig>>
  filterValues: Ref<Record<string, unknown>>
  filters: ComputedRef<FilterConfig[]>
  hasActiveFilters: ComputedRef<boolean>
  addFilter: (name: string, filterConfig: Omit<FilterConfig, 'name'>) => void
  removeFilter: (name: string) => void
  setFilterValue: (name: string, value: unknown) => void
  updateFilters: (newValues: Record<string, unknown>) => void
  onFiltersChanged: () => void
  clearFilters: () => void
  isFilterAtDefault: (name: string) => boolean
  initFromRegistry: () => void
  loadFilterOptions: () => Promise<void>
  updateCacheBasedFilters: () => Promise<void>
  restoreFilters: () => void
  /** Push filters, search and the page number into the URL (#2113). */
  writeStateToUrl: () => void
}

export function useListFilters(deps: UseListFiltersDeps): UseListFiltersReturn {
  const {
    entityName,
    manager,
    orchestrator,
    items,
    page,
    searchQuery,
    savedFilters,
    persistFilters,
    persister,
    routeStateScope,
    routeStateWrites,
    pageSize,
    autoLoadFilters,
    filterSessionKey,
    entityFilters,
    loadItems,
    setSearch,
  } = deps

  const filtersMap = ref<Map<string, FilterConfig>>(new Map())
  const filterValues = ref<Record<string, unknown>>(savedFilters || {})

  /** Names the route state already owns — a filter cannot have them (#2113). */
  const RESERVED_QUERY_KEYS = new Set(['page', 'search'])
  const warnedReserved = new Set<string>()

  /**
   * A filter named `page` or `search` silently overwrites the stored key of
   * the same name, and is overwritten back on restore. `search` has behaved
   * this way since the URL sync existed and nobody ever reported it, which
   * says how quiet the failure is; `page` joined it once the page number
   * started being remembered too.
   *
   * SCOPING DID NOT FIX THIS. Prefixing keys by entity separates this list
   * from other lists; it does not separate the list from qdadm's own two
   * keys, which live in the same scope it does — `offers.page` is written by
   * the pager whatever a filter called `page` wants.
   *
   * We name what happens INSTEAD of what was asked, rather than dropping the
   * filter — renaming someone's filter behind their back would be a worse
   * surprise than the collision (ADR 0011).
   */
  function warnIfReservedName(name: string): void {
    if (!RESERVED_QUERY_KEYS.has(name)) return
    // Gated on writing, not on the URL specifically: the collision is with
    // whatever medium this list persists to.
    if (!routeStateWrites) return
    if (warnedReserved.has(name)) return
    warnedReserved.add(name)
    console.warn(
      `[qdadm] Filter "${name}" on "${entityName}" collides with the key of ` +
        `the same name in this list's persisted route state. The list's own ` +
        `${name === 'page' ? 'page number' : 'search query'} wins and this ` +
        `filter will not survive a reload. Rename the filter, or turn the ` +
        `persistence off on this list with syncUrlParams: false.`
    )
  }

  function addFilter(name: string, filterConfig: Omit<FilterConfig, 'name'>): void {
    warnIfReservedName(name)
    filtersMap.value.set(name, {
      name,
      type: 'select',
      placeholder: name,
      ...filterConfig,
    })
    if (filterValues.value[name] === undefined) {
      filterValues.value[name] = filterConfig.default ?? null
    }
  }

  function removeFilter(name: string): void {
    filtersMap.value.delete(name)
    delete filterValues.value[name]
  }

  function setFilterValue(name: string, value: unknown): void {
    filterValues.value = { ...filterValues.value, [name]: value }
  }

  function updateFilters(newValues: Record<string, unknown>): void {
    filterValues.value = { ...filterValues.value, ...newValues }
    onFiltersChanged()
  }

  /**
   * Push the list's own state into the URL (#2113).
   *
   * Filters, search AND the page number, each written only when it differs
   * from the default and removed otherwise, so a pristine list leaves a clean
   * URL. `router.replace` rather than `push`: paging is not a history step of
   * its own, but the URL must carry the page at the moment the user leaves
   * for a detail view, so that coming back restores it.
   */
  function writeStateToUrl(): void {
    if (!persister || !routeStateWrites) return

    // Page 1 is the default and stays implicit, exactly like an unset filter:
    // the persister drops null/undefined/'' rather than storing them empty,
    // so a pristine list leaves a clean link.
    //
    // `search` and `page` still share the namespace with the filter names —
    // the scope separates this list from OTHER lists, not from qdadm's own
    // keys — which is why addFilter() still warns about a filter called
    // `page` or `search`.
    persister.write(routeStateScope, {
      ...filterValues.value,
      search: searchQuery.value || null,
      page: page.value > 1 ? page.value : null,
      // Always written, never conditional on a default: rows-per-page is a
      // choice somebody made, and the default is not "unset" — it is what
      // they get back if we forget. The default composition routes it to a
      // cookie, so it does not land in a shareable link.
      pageSize: pageSize.value,
    })
  }

  function onFiltersChanged(): void {
    page.value = 1
    loadItems()
    if (persistFilters) {
      const toPersist: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(filterValues.value)) {
        const filterDef = filtersMap.value.get(name)
        if (
          filterDef?.persist !== false &&
          value !== null &&
          value !== undefined &&
          value !== ''
        ) {
          toPersist[name] = value
        }
      }
      if (searchQuery.value) {
        toPersist._search = searchQuery.value
      }
      setSessionFilters(filterSessionKey, toPersist)
    }
    writeStateToUrl()
  }

  function clearFilters(): void {
    const cleared: Record<string, unknown> = {}
    for (const [key, filterDef] of filtersMap.value.entries()) {
      cleared[key] = filterDef.default ?? null
    }
    filterValues.value = cleared
    searchQuery.value = ''
    if (persistFilters) {
      clearSessionFilters(filterSessionKey)
    }
    page.value = 1
    if (routeStateWrites) persister?.clear(routeStateScope)
    loadItems()
  }

  const filters = computed(() => Array.from(filtersMap.value.values()))

  /**
   * Check if a filter is at its default value
   * Used for styling: default = blue (info), modified = orange (warning)
   */
  function isFilterAtDefault(name: string): boolean {
    const filterDef = filtersMap.value.get(name)
    if (!filterDef) return true
    const currentValue = filterValues.value[name]
    const defaultValue = filterDef.default ?? null
    return currentValue === defaultValue
  }

  /**
   * Check if any filter is NOT at its default value (or search is active)
   * Useful to show a "clear filters" button only when needed
   */
  const hasActiveFilters = computed(() => {
    if (searchQuery.value) return true
    for (const [name, filterDef] of filtersMap.value.entries()) {
      const currentValue = filterValues.value[name]
      const defaultValue = filterDef.default ?? null
      if (currentValue !== defaultValue) return true
    }
    return false
  })

  function initFromRegistry(): void {
    if (!autoLoadFilters) return

    const entityConfig = entityFilters[entityName]
    if (!entityConfig) return

    if (entityConfig.search) {
      setSearch(entityConfig.search)
    }

    if (entityConfig.filters) {
      for (const filterDef of entityConfig.filters) {
        addFilter(filterDef.name, filterDef)
      }
    }
  }

  /**
   * Fetch the remote options that populate filter dropdowns (#1934 lot 1).
   *
   * The loop used to be sequential: three filters with remote options cost
   * three round trips in a queue, and the rows waited behind the sum. They
   * are independent, so they now go together and cost the slowest.
   *
   * Deduplicated by `optionsEntity` on purpose. Sequential execution had one
   * accidental virtue — two filters on the same entity meant one fetch and
   * one cache hit — and firing them in parallel would turn that into two
   * concurrent fetches. Trading latency for duplicate requests is not a win,
   * so filters sharing an entity are still chained behind one another while
   * different entities run side by side.
   *
   * This no longer invokes `filter:alter`: that hook establishes what the
   * query will ask for, so it belongs with the other query-settling work in
   * `onMounted`, not behind the network (#1934 lot 2).
   */
  async function loadFilterOptions(): Promise<void> {
    const pending = Array.from(filtersMap.value).filter(([, filterDef]) => {
      if (filterDef.options && filterDef.options.length > 1) return false
      if (filterDef.optionsFromCache) return false
      return true
    })

    // One chain per source entity; everything else is a chain of its own.
    const chains = new Map<string, Promise<void>>()

    await Promise.all(
      pending.map(([filterName, filterDef]) => {
        const key = filterDef.optionsEntity ? `entity:${filterDef.optionsEntity}` : `own:${filterName}`
        const previous = chains.get(key) ?? Promise.resolve()
        const next = previous.then(() => loadOneFilterOptions(filterName, filterDef))
        chains.set(key, next)
        return next
      })
    )

    // Trigger Vue reactivity
    filtersMap.value = new Map(filtersMap.value)
  }

  async function loadOneFilterOptions(filterName: string, filterDef: FilterConfig): Promise<void> {
      try {
        let rawOptions: Array<{ label: string; value: unknown }> | null = null

        // Mode 1: optionsEntity - fetch from related EntityManager via FilterQuery
        if (filterDef.optionsEntity) {
          const filterQuery = new FilterQuery({
            source: 'entity',
            entity: filterDef.optionsEntity,
            label: filterDef.optionLabel || 'name',
            value: filterDef.optionValue || 'id',
          })

          rawOptions = (await filterQuery.getOptions(orchestrator)) as Array<{
            label: string
            value: unknown
          }>
          filterDef._filterQuery = filterQuery
        }
        // Mode 2: optionsEndpoint - fetch from API endpoint
        else if (filterDef.optionsEndpoint) {
          const endpoint =
            filterDef.optionsEndpoint === true
              ? `distinct/${filterName}`
              : filterDef.optionsEndpoint
          const response = await manager.request('GET', endpoint as string)
          const data = Array.isArray(response)
            ? response
            : ((response as Record<string, unknown>)?.items as unknown[]) || []
          rawOptions = data.map((opt) => {
            if (typeof opt === 'object' && opt !== null) {
              const o = opt as Record<string, unknown>
              return {
                label: (o.label || o.name || String(o.value ?? o.id)) as string,
                value: o.value ?? o.id,
              }
            }
            return { label: snakeToTitle(String(opt)), value: opt }
          })
        }

        if (rawOptions !== null) {
          const cacheOptions = filterDef.cacheOptions ?? 'auto'
          let shouldCache = cacheOptions === true

          if (cacheOptions === 'auto') {
            shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
          }

          const componentType =
            filterDef.component || (shouldCache ? 'dropdown' : 'autocomplete')
          const allLabel =
            filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
          let finalOptions = [{ label: allLabel, value: null as unknown }, ...rawOptions]

          if (typeof filterDef.processor === 'function') {
            finalOptions = filterDef.processor(finalOptions)
          }

          const updatedFilter: FilterConfig = {
            ...filterDef,
            options: finalOptions,
            type: componentType,
            _cacheOptions: shouldCache,
            _optionsLoaded: shouldCache,
          }
          delete updatedFilter.optionLabel
          delete updatedFilter.optionValue
          filtersMap.value.set(filterName, updatedFilter)
        }
      } catch (error) {
        console.warn(`[qdadm] Failed to load options for filter "${filterName}":`, error)
      }
  }

  async function updateCacheBasedFilters(): Promise<void> {
    if (items.value.length === 0) return

    let hasChanges = false

    for (const [filterName, filterDef] of filtersMap.value) {
      if (!filterDef.optionsFromCache) continue
      if (filterDef._optionsLoaded) continue
      // Skip if filter has an explicit query property (advanced usage)
      if (filterDef.query) continue

      const currentValue = filterValues.value[filterName]
      if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
        continue
      }

      const fieldName =
        typeof filterDef.optionsFromCache === 'string' ? filterDef.optionsFromCache : filterName

      const filterQuery = new FilterQuery({
        source: 'field',
        field: fieldName,
      })

      // Provide a minimal mock manager with cached data for field-based filtering
      filterQuery.setParentManager({
        _cache: items.value,
        list: async () => ({ items: items.value }),
      })

      const rawOptions = (await filterQuery.getOptions()) as Array<{ label: string; value: unknown }>

      const cacheOptions = filterDef.cacheOptions ?? 'auto'
      let shouldCache = true

      if (cacheOptions === 'auto') {
        shouldCache = rawOptions.length <= SMART_FILTER_THRESHOLD
      } else if (cacheOptions === false) {
        shouldCache = false
      }

      const componentType =
        filterDef.component ||
        (rawOptions.length <= SMART_FILTER_THRESHOLD ? 'dropdown' : 'autocomplete')

      const allLabel =
        filterDef.allLabel || filterDef.placeholder || `All ${snakeToTitle(filterName)}`
      let finalOptions = [
        { label: allLabel, value: null as unknown },
        ...rawOptions.map((opt) => ({
          label: snakeToTitle(String(opt.label)),
          value: opt.value,
        })),
      ]

      if (typeof filterDef.processor === 'function') {
        finalOptions = filterDef.processor(finalOptions)
      }

      const updatedFilter: FilterConfig = {
        ...filterDef,
        options: finalOptions,
        type: componentType,
        _cacheOptions: shouldCache,
        _optionsLoaded: true,
        _filterQuery: filterQuery,
      }

      filtersMap.value.set(filterName, updatedFilter)
      hasChanges = true
    }

    if (hasChanges) {
      filtersMap.value = new Map(filtersMap.value)
    }
  }

  function restoreFilters(): void {
    const stored = persister?.read(routeStateScope)
    if (!stored) return

    // Only keys this list declares as filters: the scope keeps other lists
    // out, but a persister may still hand back something the app put there.
    for (const key of filtersMap.value.keys()) {
      if (stored[key] !== undefined) filterValues.value[key] = stored[key]
    }

    // NOT `typeof === 'string'` (#2147). A term that survives a numeric round
    // trip — an order id, an invoice, a reference — comes back from the URL
    // as a number, and a string-only guard dropped it: the box came back
    // empty and the list unfiltered, so a shared link showed the recipient
    // something other than what the sender searched for.
    //
    // Safe to stringify because the persister no longer coerces lossily: a
    // value that could not be written back as the same text was left as text.
    if (stored.search !== null && stored.search !== undefined && stored.search !== '') {
      searchQuery.value = String(stored.search)
    }

    // The page must be restored HERE, before the first loadItems(): restoring
    // it later would mean a first request for page 1 and a second for the
    // real one (#2113).
    const restoredPage = Number(stored.page)
    if (Number.isInteger(restoredPage) && restoredPage > 0) {
      page.value = restoredPage
    }
  }

  return {
    filtersMap,
    filterValues,
    filters,
    hasActiveFilters,
    addFilter,
    removeFilter,
    setFilterValue,
    updateFilters,
    onFiltersChanged,
    clearFilters,
    isFilterAtDefault,
    initFromRegistry,
    loadFilterOptions,
    updateCacheBasedFilters,
    restoreFilters,
    writeStateToUrl,
  }
}
