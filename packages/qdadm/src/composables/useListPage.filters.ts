/**
 * useListFilters — the filter subsystem of useListPage (#1195, KPI-8).
 *
 * Mechanical extraction: owns the filter state (filtersMap/filterValues),
 * the three option-source modes (optionsEntity / optionsEndpoint /
 * optionsFromCache), session persistence, URL sync and registry auto-load.
 * useListPage composes it back in; behavior is unchanged.
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { FilterQuery, type QueryOrchestratorLike } from '../query/FilterQuery'
import type { FilterConfig, SearchConfig } from './useListPage.types'
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
  /** Search query ref (shared with the search subsystem). */
  searchQuery: Ref<string>
  route: RouteLocationNormalizedLoaded
  router: Router
  /** Session-restored filter values (already stripped of _search). */
  savedFilters: Record<string, unknown> | null
  persistFilters: boolean
  syncUrlParams: boolean
  autoLoadFilters: boolean
  filterSessionKey: string
  /** Entity filters registry (injected by the consuming app). */
  entityFilters: Record<string, { search?: SearchConfig; filters?: FilterConfig[] }>
  /** Thunks — resolved lazily, the targets are declared later in useListPage. */
  loadItems: () => void
  setSearch: (searchCfg: Partial<SearchConfig>) => void
  invokeFilterAlterHook: () => Promise<void>
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
}

export function useListFilters(deps: UseListFiltersDeps): UseListFiltersReturn {
  const {
    entityName,
    manager,
    orchestrator,
    items,
    page,
    searchQuery,
    route,
    router,
    savedFilters,
    persistFilters,
    syncUrlParams,
    autoLoadFilters,
    filterSessionKey,
    entityFilters,
    loadItems,
    setSearch,
    invokeFilterAlterHook,
  } = deps

  const filtersMap = ref<Map<string, FilterConfig>>(new Map())
  const filterValues = ref<Record<string, unknown>>(savedFilters || {})

  function addFilter(name: string, filterConfig: Omit<FilterConfig, 'name'>): void {
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
    if (syncUrlParams) {
      const query = { ...route.query } as Record<string, string>
      for (const [name, value] of Object.entries(filterValues.value)) {
        if (value !== null && value !== undefined && value !== '') {
          query[name] = String(value)
        } else {
          delete query[name]
        }
      }
      if (searchQuery.value) {
        query.search = searchQuery.value
      } else {
        delete query.search
      }
      router.replace({ query })
    }
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
    if (syncUrlParams) {
      const query = { ...route.query } as Record<string, string>
      for (const key of filtersMap.value.keys()) {
        delete query[key]
      }
      delete query.search
      router.replace({ query })
    }
    page.value = 1
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

  async function loadFilterOptions(): Promise<void> {
    // Process filters configured directly via addFilter() (smart filter modes)
    for (const [filterName, filterDef] of filtersMap.value) {
      if (filterDef.options && filterDef.options.length > 1) continue
      if (filterDef.optionsFromCache) continue

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

    // Invoke filter:alter hooks after all options are loaded
    await invokeFilterAlterHook()

    // Trigger Vue reactivity
    filtersMap.value = new Map(filtersMap.value)
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
    for (const key of filtersMap.value.keys()) {
      if (route.query[key] !== undefined) {
        let value: unknown = route.query[key]
        if (value === 'true') value = true
        else if (value === 'false') value = false
        else if (value === 'null') value = null
        else if (!isNaN(Number(value)) && value !== '') value = Number(value)
        filterValues.value[key] = value
      }
    }
    if (route.query.search) {
      searchQuery.value = route.query.search as string
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
  }
}
