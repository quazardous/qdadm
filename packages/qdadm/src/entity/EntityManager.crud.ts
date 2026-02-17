import type { ListParams, ListResult } from '../types'
import type { EntityManagerInternal, Orchestrator, RoutingContext } from './EntityManager.types'

type Self = EntityManagerInternal<any>

/**
 * API Response Contract for Caching
 * ==================================
 *
 * The storage/API must return responses in this format:
 *
 *   {
 *     items: T[],     // Items for current page/request
 *     total: number   // TOTAL count of ALL items matching the query (not just this page)
 *   }
 *
 * Why `total` is critical:
 * ------------------------
 * The `total` field enables the smart caching mechanism:
 *
 * 1. Cache eligibility: if `total <= localFilterThreshold`, EntityManager will cache all items
 * 2. Cache validation: `items.length >= total` confirms we received the complete dataset
 * 3. Background loading: if `items.length < total` but `total <= threshold`, loads all items in background
 *
 * Once cached, all filtering/sorting/pagination happens locally via QueryExecutor (MongoDB-like syntax).
 * This dramatically reduces API calls for small datasets.
 *
 * Common pitfalls:
 * ----------------
 * - `total` missing or 0: falls back to `items.length`, may create incomplete cache
 * - `total` incorrect (e.g., always returns page size): cache thinks it's complete when it's not
 * - `total` always equals real total (ignoring filters): cache works but may overflow threshold
 *
 * Example:
 * --------
 * // Good: API returns correct total
 * GET /api/users?page=1&page_size=20
 * → { items: [...20 users...], total: 45 }  // 45 users exist, got first 20
 *
 * // EntityManager sees: total(45) <= threshold(100), items(20) < total(45)
 * // → Triggers background load of all 45 users for cache
 */

/**
 * Patch EntityManager prototype with CRUD methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyCrudMethods(EntityManagerClass: { prototype: any }): void {
  const proto = EntityManagerClass.prototype as Self

  /**
   * List entities with pagination/filtering
   */
  proto.list = async function (
    this: Self,
    params: ListParams & { _internal?: boolean } = {},
    context?: RoutingContext
  ): Promise<ListResult<any>> {
    const resolved = this._normalizeResolveResult(
      this.resolveStorage('list', context),
      context
    )
    const { storage, endpoint, params: resolvedParams } = resolved
    if (!storage) {
      throw new Error(`[EntityManager:${this.name}] list() not implemented`)
    }

    // Extract internal flag and cacheSafe flag
    const { _internal = false, cacheSafe = false, ...queryParams } = params

    // Merge resolved params (defaults) with query params (overrides)
    const mergedParams = resolvedParams
      ? { ...resolvedParams, ...queryParams }
      : queryParams

    const stats = this._stats
    const cache = this._cache

    // Only count stats for non-internal operations
    if (!_internal) {
      stats.list++
    }

    const hasFilters =
      mergedParams.search ||
      Object.keys(mergedParams.filters || {}).length > 0
    // Disable cache when resolveStorage provides an endpoint override:
    // the endpoint varies by routing context (e.g. parent chain), so
    // caching would return stale data from a different context.
    const canUseCache = (!hasFilters || cacheSafe) && !endpoint

    // Check TTL expiration before using cache
    if (this._isCacheExpired()) {
      this.invalidateCache()
    }

    // 1. Cache valid + cacheable -> use cache with local filtering
    if (cache.valid && canUseCache) {
      if (!_internal) stats.cacheHits++
      console.log('[cache] Using local cache for entity:', this.name)
      const filtered = this._filterLocally(cache.items, mergedParams)
      // Update max stats
      if (filtered.items.length > stats.maxItemsSeen) {
        stats.maxItemsSeen = filtered.items.length
      }
      if (filtered.total > stats.maxTotal) {
        stats.maxTotal = filtered.total
      }
      return { ...filtered, fromCache: true }
    }

    if (!_internal) stats.cacheMisses++

    // 2. Fetch from API
    let response: { items?: any[]; data?: any[] | { items?: any[]; data?: any[] }; total?: number; pagination?: { total?: number } }
    if (endpoint && storage.request) {
      // Use request() with endpoint for multi-storage routing.
      // When using a dynamic endpoint, parent IDs are already encoded in the URL.
      // Strip parent-related filters to avoid duplication in query params.
      let requestParams = mergedParams
      if (context?.parentChain && mergedParams.filters) {
        const parentIds = new Set(
          context.parentChain.map((p: { id: string | number }) => String(p.id))
        )
        const cleaned = Object.fromEntries(
          Object.entries(mergedParams.filters as Record<string, unknown>).filter(
            ([, value]) => !parentIds.has(String(value))
          )
        )
        requestParams = { ...mergedParams }
        if (Object.keys(cleaned).length > 0) {
          requestParams.filters = cleaned
        } else {
          delete requestParams.filters
        }
      }
      const apiResponse = (await storage.request('GET', endpoint, {
        params: requestParams,
        context,
      })) as { data?: unknown }
      // Normalize response
      const data = apiResponse.data ?? apiResponse
      const dataObj = data as {
        items?: any[]
        data?: any[]
        total?: number
        pagination?: { total?: number }
      }
      response = {
        items: Array.isArray(data)
          ? (data as any[])
          : dataObj.items || dataObj.data || [],
        total:
          dataObj.total ??
          dataObj.pagination?.total ??
          (Array.isArray(data) ? (data as any[]).length : 0),
      }
    } else {
      // Standard storage.list() (normalizes response to { items, total })
      response = await storage.list(mergedParams, context)
    }
    const items = response.items || []
    const total = response.total ?? items.length

    // Update max stats
    if (items.length > stats.maxItemsSeen) {
      stats.maxItemsSeen = items.length
    }
    if (total > stats.maxTotal) {
      stats.maxTotal = total
    }

    // 3. Fill cache opportunistically
    if (canUseCache && this.isCacheEnabled && total <= this.effectiveThreshold) {
      // Only cache if we received ALL items (not a partial page)
      if (items.length >= total) {
        cache.items = items
        cache.total = total
        cache.valid = true
        cache.loadedAt = Date.now()
        // Resolve parent fields for search (book.title, user.username, etc.)
        await this._resolveSearchFields(items)
      }
      // If we got partial results but total fits threshold, load all items for cache
      else if (!this._cacheLoading) {
        // Fire-and-forget: load full cache in background
        this._loadCacheInBackground()
      }
    }

    return { items, total, fromCache: false }
  }

  /**
   * Get a single entity by ID
   */
  proto.get = async function (
    this: Self,
    id: string | number,
    context?: RoutingContext
  ): Promise<any> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('get', context),
      context
    )
    const stats = this._stats
    stats.get++

    // Check TTL expiration before using cache
    if (this._isCacheExpired()) {
      this.invalidateCache()
    }

    const cache = this._cache
    const idStr = String(id)

    // ── Asymmetric mode: skip list cache, use detail cache ──
    if (this.isAsymmetric) {
      // Check detail cache first
      if (this.isDetailCacheEnabled) {
        const entry = this._detailCache.items.get(idStr)
        if (entry && !this._isDetailCacheEntryExpired(entry.loadedAt)) {
          stats.detailCacheHits++
          return { ...entry.item }
        }
      }

      // Deduplicate concurrent get() calls for the same ID
      const inflight = this._detailInflight.get(idStr)
      if (inflight) {
        stats.detailCacheHits++
        const result = await inflight
        return { ...result }
      }

      // Fetch from storage
      stats.detailCacheMisses++
      if (!storage) {
        throw new Error(`[EntityManager:${this.name}] get() not implemented`)
      }

      const fetchPromise = (async () => {
        let result: any
        if (endpoint && storage.request) {
          const response = (await storage.request('GET', `${endpoint}/${id}`, {
            context,
          })) as { data?: any }
          result = response.data ?? response
        } else {
          result = await storage.get(id, context)
          if (!result) {
            throw new Error(
              `[EntityManager:${this.name}] Entity not found: ${id}`
            )
          }
        }

        // Store in detail cache
        if (this.isDetailCacheEnabled) {
          this._detailCache.items.set(idStr, { item: result, loadedAt: Date.now() })
          this._evictDetailCache()
        }

        return result
      })()

      // Register inflight promise
      this._detailInflight.set(idStr, fetchPromise)
      try {
        const result = await fetchPromise
        return result
      } finally {
        this._detailInflight.delete(idStr)
      }
    }

    // ── Symmetric mode (default): try list cache ──

    // Try cache first if valid and complete
    if (cache.valid && !this.overflow) {
      const cached = cache.items.find(
        (item: any) => String(item[this.idField]) === idStr
      )
      if (cached) {
        stats.cacheHits++
        return { ...cached } // Return copy to avoid mutation
      }
    }

    // Fallback to storage
    stats.cacheMisses++
    if (storage) {
      // Use request() with endpoint for multi-storage routing, otherwise use get()
      if (endpoint && storage.request) {
        const response = (await storage.request('GET', `${endpoint}/${id}`, {
          context,
        })) as { data?: any }
        return (response.data ?? response)
      }
      const result = await storage.get(id, context)
      if (!result) {
        throw new Error(
          `[EntityManager:${this.name}] Entity not found: ${id}`
        )
      }
      return result
    }
    throw new Error(`[EntityManager:${this.name}] get() not implemented`)
  }

  /**
   * Get multiple entities by IDs (batch fetch)
   */
  proto.getMany = async function (
    this: Self,
    ids: Array<string | number>,
    context?: RoutingContext
  ): Promise<any[]> {
    if (!ids || ids.length === 0) return []

    // Check TTL expiration before using cache
    if (this._isCacheExpired()) {
      this.invalidateCache()
    }

    const stats = this._stats
    const cache = this._cache

    // ── Asymmetric mode: check detail cache, fetch missing via get() ──
    if (this.isAsymmetric) {
      const found: any[] = []
      const missingIds: Array<string | number> = []

      if (this.isDetailCacheEnabled) {
        for (const id of ids) {
          const entry = this._detailCache.items.get(String(id))
          if (entry && !this._isDetailCacheEntryExpired(entry.loadedAt)) {
            stats.detailCacheHits++
            found.push({ ...entry.item })
          } else {
            missingIds.push(id)
          }
        }
      } else {
        missingIds.push(...ids)
      }

      // Fetch missing via individual get() calls (which populate detail cache)
      if (missingIds.length > 0) {
        const fetched = await Promise.all(
          missingIds.map((id) => this.get(id, context).catch((): null => null))
        )
        // get() already counted stats, so just merge results
        for (const item of fetched) {
          if (item !== null) found.push(item)
        }
      }

      return found
    }

    // ── Symmetric mode (default): try list cache ──

    // Try cache first if valid and complete
    if (cache.valid && !this.overflow) {
      const idStrs = new Set(ids.map(String))
      const cached = cache.items
        .filter((item: any) => idStrs.has(String(item[this.idField])))
        .map((item: any) => ({ ...item })) // Return copies

      // If we found all items in cache
      if (cached.length === ids.length) {
        stats.cacheHits += ids.length
        return cached
      }
      // Partial cache hit - fall through to storage
    }

    stats.cacheMisses += ids.length

    const { storage } = this._normalizeResolveResult(
      this.resolveStorage('getMany', context),
      context
    )
    if (storage && 'getMany' in storage && typeof storage.getMany === 'function') {
      return (storage as unknown as { getMany: (ids: Array<string | number>, context?: RoutingContext) => Promise<any[]> }).getMany(ids, context)
    }
    // Fallback: parallel get calls (get() handles its own stats)
    stats.cacheMisses -= ids.length // Avoid double counting
    const results = await Promise.all(
      ids.map((id) => this.get(id, context).catch((): null => null))
    )
    return results.filter((r: any): r is NonNullable<typeof r> => r !== null)
  }

  /**
   * Create a new entity
   */
  proto.create = async function (
    this: Self,
    data: Partial<any>,
    context?: RoutingContext
  ): Promise<any> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('create', context),
      context
    )
    this._stats.create++
    if (storage) {
      // Apply field defaults before presave hooks
      const dataWithDefaults = this.applyDefaults(data, context ?? null)

      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(dataWithDefaults, true)
      await this._invokeHook('presave', presaveContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use create()
      let result: any
      if (endpoint && storage.request) {
        const response = (await storage.request('POST', endpoint, {
          data: presaveContext.record,
          context,
        })) as { data?: any }
        result = (response.data ?? response)
      } else {
        result = await storage.create(presaveContext.record)
      }
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, true)
      await this._invokeHook('postsave', postsaveContext as unknown as Record<string, unknown>)

      this._emitSignal('created', {
        entity: result,
        manager: this.name,
        id: result?.[this.idField],
      })
      this._emitDataInvalidate('created', result?.[this.idField] as string | number | undefined)
      return result
    }
    throw new Error(`[EntityManager:${this.name}] create() not implemented`)
  }

  /**
   * Update an entity (PUT - full replacement)
   */
  proto.update = async function (
    this: Self,
    id: string | number,
    data: Partial<any>,
    context?: RoutingContext
  ): Promise<any> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('update', context),
      context
    )
    this._stats.update++
    if (storage) {
      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(data, false, id)
      await this._invokeHook('presave', presaveContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use update()
      let result: any
      if (endpoint && storage.request) {
        const response = (await storage.request('PUT', `${endpoint}/${id}`, {
          data: presaveContext.record,
          context,
        })) as { data?: any }
        result = (response.data ?? response)
      } else {
        result = await storage.update(id, presaveContext.record)
      }
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, false, id)
      await this._invokeHook('postsave', postsaveContext as unknown as Record<string, unknown>)

      this._emitSignal('updated', {
        entity: result,
        manager: this.name,
        id,
      })
      this._emitDataInvalidate('updated', id)
      return result
    }
    throw new Error(`[EntityManager:${this.name}] update() not implemented`)
  }

  /**
   * Partially update an entity (PATCH)
   */
  proto.patch = async function (
    this: Self,
    id: string | number,
    data: Partial<any>,
    context?: RoutingContext
  ): Promise<any> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('patch', context),
      context
    )
    this._stats.update++ // patch counts as update
    if (storage) {
      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(data, false, id)
      await this._invokeHook('presave', presaveContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use patch()
      let result: any
      if (endpoint && storage.request) {
        const response = (await storage.request('PATCH', `${endpoint}/${id}`, {
          data: presaveContext.record,
          context,
        })) as { data?: any }
        result = (response.data ?? response)
      } else if (storage.patch) {
        result = await storage.patch(id, presaveContext.record)
      } else {
        throw new Error(
          `[EntityManager:${this.name}] Storage does not support patch()`
        )
      }
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, false, id)
      await this._invokeHook('postsave', postsaveContext as unknown as Record<string, unknown>)

      this._emitSignal('updated', {
        entity: result,
        manager: this.name,
        id,
      })
      this._emitDataInvalidate('updated', id)
      return result
    }
    throw new Error(`[EntityManager:${this.name}] patch() not implemented`)
  }

  /**
   * Delete an entity
   */
  proto.delete = async function (
    this: Self,
    id: string | number,
    context?: RoutingContext
  ): Promise<void> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('delete', context),
      context
    )
    this._stats.delete++
    if (storage) {
      // Invoke predelete hooks (can throw to abort, e.g., for cascade checks)
      const predeleteContext = this._buildPredeleteContext(id)
      await this._invokeHook('predelete', predeleteContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use delete()
      if (endpoint && storage.request) {
        await storage.request('DELETE', `${endpoint}/${id}`, { context })
      } else {
        await storage.delete(id)
      }
      this.invalidateCache()
      this._emitSignal('deleted', {
        manager: this.name,
        id,
      })
      this._emitDataInvalidate('deleted', id)
      return
    }
    throw new Error(`[EntityManager:${this.name}] delete() not implemented`)
  }

  /**
   * Generic request for special operations
   */
  proto.request = async function (
    this: Self,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: {
      data?: unknown
      params?: Record<string, unknown>
      headers?: Record<string, string>
      invalidateCache?: boolean
    } = {}
  ): Promise<unknown> {
    if (this.storage?.request) {
      const { invalidateCache: shouldInvalidate, ...storageOptions } = options
      const result = await this.storage.request(method, path, storageOptions)

      // Auto-invalidate cache for mutation methods, or if explicitly requested
      if (shouldInvalidate ?? method !== 'GET') {
        this.invalidateCache()
      }

      return result
    }
    throw new Error(`[EntityManager:${this.name}] request() not implemented`)
  }

  /**
   * Hook: called when manager is registered with orchestrator
   */
  proto.onRegister = function (
    this: Self,
    orchestrator: Orchestrator
  ): void {
    this._orchestrator = orchestrator
  }
}
