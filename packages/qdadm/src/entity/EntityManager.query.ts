import { QueryExecutor, type QueryObject } from '../query/QueryExecutor'
import type { ListParams, ListResult } from '../types'
import type { EntityManagerInternal, OperationStats, QueryOptions } from './EntityManager.types'

type Self = EntityManagerInternal<any>

/**
 * Patch EntityManager prototype with query-related methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyQueryMethods(EntityManagerClass: { prototype: any }): void {
  const proto = EntityManagerClass.prototype as Self

  /**
   * Query entities with automatic cache/API decision
   */
  proto.query = async function (
    this: Self,
    params: ListParams = {},
    options: QueryOptions = {}
  ): Promise<ListResult<any>> {
    const { context = {}, routingContext = null } = options

    // Check if this context uses a dynamic endpoint (no caching possible)
    const resolved = this._normalizeResolveResult(
      this.resolveStorage('list', routingContext ?? undefined),
      routingContext ?? undefined
    )
    const isDynamicEndpoint = !!resolved.endpoint

    // Ensure cache is filled (via list) — skip for dynamic endpoints
    // since list() disables caching when resolveStorage provides an endpoint
    const cache = this._cache
    if (!isDynamicEndpoint && !cache.valid && this.isCacheEnabled) {
      await this.list(
        { page_size: this.effectiveThreshold },
        routingContext ?? undefined
      )
    }

    let result: ListResult<any>

    // Dynamic endpoint, overflow, or cache disabled → use API directly
    if (isDynamicEndpoint || this.overflow || !this.isCacheEnabled) {
      result = await this.list(params, routingContext ?? undefined)
    } else {
      // Full cache available - filter locally
      const filtered = this._filterLocally(cache.items, params)
      result = { ...filtered, fromCache: true }
    }

    // Call hook if defined (for context-based customization)
    if (this.onQueryResult) {
      result = this.onQueryResult(result, context) || result
    }

    return result
  }

  /**
   * Build MongoDB-like query from filters object
   * @internal
   */
  proto._buildQuery = function (
    this: Self,
    filters: Record<string, unknown>
  ): QueryObject {
    const query: QueryObject = {}
    for (const [field, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      // Cast value to QueryCondition - QueryExecutor handles type validation
      query[field] = value as QueryObject[string]
    }
    return query
  }

  /**
   * Apply filters, search, sort and pagination locally
   * @internal
   */
  proto._filterLocally = function (
    this: Self,
    items: any[],
    params: ListParams & { searchFields?: string[] | null } = {}
  ): { items: any[]; total: number } {
    const {
      search = '',
      searchFields: overrideSearchFields = null,
      filters = {},
      sort_by = null,
      sort_order = 'asc',
      page = 1,
      page_size = 20,
    } = params

    let result = [...items]

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase()
      const searchFields = overrideSearchFields ?? this.storageSearchFields

      result = result.filter((item: any) => {
        if (searchFields) {
          const { ownFields, parentFields } =
            this._parseSearchFields(searchFields)

          // Search own fields
          for (const field of ownFields) {
            const value = item[field]
            if (
              typeof value === 'string' &&
              value.toLowerCase().includes(searchLower)
            ) {
              return true
            }
            if (
              typeof value === 'number' &&
              value.toString().includes(search)
            ) {
              return true
            }
          }

          // Search cached parent fields (in item._search)
          const itemWithSearch = item as {
            _search?: Record<string, string>
          }
          if (itemWithSearch._search) {
            for (const [parentKey, fields] of Object.entries(parentFields)) {
              for (const field of fields) {
                const key = `${parentKey}.${field}`
                const value = itemWithSearch._search[key]
                // _search values are always strings
                if (value && value.toLowerCase().includes(searchLower)) {
                  return true
                }
              }
            }
          }

          return false
        } else {
          // No searchFields declared: search all string/number fields
          return Object.values(item).some((value: unknown) => {
            if (typeof value === 'string') {
              return value.toLowerCase().includes(searchLower)
            }
            if (typeof value === 'number') {
              return value.toString().includes(search)
            }
            return false
          })
        }
      })
    }

    // Build query and apply filters using QueryExecutor
    const queryObj = this._buildQuery(filters)
    if (Object.keys(queryObj).length > 0) {
      const { items: filtered } = QueryExecutor.execute(result, queryObj)
      result = filtered as any[]
    }

    // Total after filtering (before pagination)
    const total = result.length

    // Apply sort (QueryExecutor does not sort)
    if (sort_by) {
      result.sort((a: any, b: any) => {
        const aVal = a[sort_by]
        const bVal = b[sort_by]

        // Handle nulls
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sort_order === 'asc' ? 1 : -1
        if (bVal == null) return sort_order === 'asc' ? -1 : 1

        // Compare
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const cmp = aVal.localeCompare(bVal)
          return sort_order === 'asc' ? cmp : -cmp
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sort_order === 'asc' ? cmp : -cmp
      })
    }

    // Apply pagination
    const start = (page - 1) * page_size
    const paged = result.slice(start, start + page_size)

    return { items: paged, total }
  }

  /**
   * Get operation stats (for debug panel)
   */
  proto.getStats = function (this: Self): OperationStats {
    return { ...this._stats }
  }

  /**
   * Reset operation stats
   */
  proto.resetStats = function (this: Self): void {
    this._stats = {
      list: 0,
      get: 0,
      create: 0,
      update: 0,
      delete: 0,
      cacheHits: 0,
      cacheMisses: 0,
      detailCacheHits: 0,
      detailCacheMisses: 0,
      maxItemsSeen: 0,
      maxTotal: 0,
    }
  }
}
