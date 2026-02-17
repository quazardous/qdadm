import type { StorageCapabilities, ParentConfig } from '../types'
import type { CacheInfo, EntityManagerInternal } from './EntityManager.types'

type Self = EntityManagerInternal<any>

/**
 * Patch EntityManager prototype with cache-related getters and methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyCacheMethods(EntityManagerClass: { prototype: any }): void {
  const proto = EntityManagerClass.prototype as Self

  // ============ THRESHOLD & TTL (getters) ============

  Object.defineProperty(proto, 'effectiveThreshold', {
    get(this: Self): number {
      return this.localFilterThreshold ?? 100
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'effectiveCacheTtlMs', {
    get(this: Self): number {
      // 1. Storage capabilities (can be set dynamically from API headers)
      const storageCaps =
        (this.storage as unknown as { capabilities?: StorageCapabilities })?.capabilities ||
        (this.storage?.constructor as { capabilities?: StorageCapabilities })?.capabilities
      if (storageCaps?.cacheTtlMs !== undefined) {
        return storageCaps.cacheTtlMs
      }

      // 2. Entity-level config
      if (this._cacheTtlMs !== null) {
        return this._cacheTtlMs
      }

      // 3. Global default from kernel options
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globalTtl = (this._orchestrator as any)?.kernelOptions?.defaultEntityCacheTtlMs
      if (globalTtl !== undefined) {
        return globalTtl
      }

      // 4. Default: infinite (no expiration)
      return -1
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'isCacheTtlDisabled', {
    get(this: Self): boolean {
      return this.effectiveCacheTtlMs === 0
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'storageSupportsTotal', {
    get(this: Self): boolean {
      const caps = (this.storage?.constructor as { capabilities?: Partial<StorageCapabilities> })
        ?.capabilities
      return caps?.supportsTotal ?? false
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'storageSearchFields', {
    get(this: Self): string[] | undefined {
      const caps = (this.storage?.constructor as { capabilities?: Partial<StorageCapabilities> })
        ?.capabilities
      return caps?.searchFields
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'isCacheEnabled', {
    get(this: Self): boolean {
      if (this.effectiveThreshold <= 0) return false
      if (this.isCacheTtlDisabled) return false // TTL=0 disables cache
      // Check capabilities (instance getter or static)
      const caps =
        (this.storage as unknown as { capabilities?: StorageCapabilities })?.capabilities ||
        (this.storage?.constructor as { capabilities?: StorageCapabilities })?.capabilities
      if (caps?.supportsCaching === false) return false
      if (!this.storageSupportsTotal) return false
      return true
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'overflow', {
    get(this: Self): boolean {
      const cache = this._cache
      return cache.valid && cache.total > cache.items.length
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'warmupEnabled', {
    get(this: Self): boolean {
      return this._warmup && this.isCacheEnabled
    },
    configurable: true,
  })

  // ============ ASYMMETRIC MODE ============

  Object.defineProperty(proto, 'isAsymmetric', {
    get(this: Self): boolean {
      if (this._asymmetric) return true
      // Fallback to storage capabilities
      const caps =
        (this.storage as unknown as { capabilities?: StorageCapabilities })?.capabilities ||
        (this.storage?.constructor as { capabilities?: StorageCapabilities })?.capabilities
      return caps?.asymmetric ?? false
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'effectiveDetailCacheTtlMs', {
    get(this: Self): number {
      return this._detailCacheTtlMs
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'effectiveDetailCacheMaxSize', {
    get(this: Self): number {
      return this._detailCacheMaxSize
    },
    configurable: true,
  })

  Object.defineProperty(proto, 'isDetailCacheEnabled', {
    get(this: Self): boolean {
      return this.isAsymmetric && this._detailCacheTtlMs !== 0
    },
    configurable: true,
  })

  // ============ INTERNAL METHODS ============

  proto._isCacheExpired = function (this: Self): boolean {
    const cache = this._cache
    if (!cache.valid || !cache.loadedAt) return false
    const ttl = this.effectiveCacheTtlMs
    if (ttl <= 0) return false // 0 = disabled (handled elsewhere), -1 = infinite
    return Date.now() - cache.loadedAt > ttl
  }

  proto._isDetailCacheEntryExpired = function (this: Self, loadedAt: number): boolean {
    const ttl = this.effectiveDetailCacheTtlMs
    if (ttl < 0) return false // -1 = infinite
    if (ttl === 0) return true // 0 = disabled
    return Date.now() - loadedAt > ttl
  }

  proto._evictDetailCache = function (this: Self): void {
    const maxSize = this._detailCacheMaxSize
    if (maxSize <= 0) return // 0 = unlimited
    const items = this._detailCache.items
    if (items.size <= maxSize) return

    // Evict oldest entries by loadedAt
    const entries = [...items.entries()].sort((a, b) => a[1].loadedAt - b[1].loadedAt)
    const toRemove = entries.length - maxSize
    for (let i = 0; i < toRemove; i++) {
      items.delete(entries[i][0])
    }
  }

  proto._getStorageRequiresAuth = function (this: Self): boolean {
    // Check instance capabilities first (may have dynamic requiresAuth)
    const instanceCaps = (this.storage as unknown as { capabilities?: Partial<StorageCapabilities> })
      ?.capabilities
    if (instanceCaps?.requiresAuth !== undefined) {
      return instanceCaps.requiresAuth
    }
    // Fallback to static capabilities
    const caps = (this.storage?.constructor as { capabilities?: Partial<StorageCapabilities> })
      ?.capabilities
    return caps?.requiresAuth ?? false
  }

  proto._parseSearchFields = function (
    this: Self,
    overrideSearchFields: string[] | null = null
  ): { ownFields: string[]; parentFields: Record<string, string[]> } {
    const search = overrideSearchFields ?? this.storageSearchFields ?? []
    const ownFields: string[] = []
    const parentFields: Record<string, string[]> = {}

    const parents: Record<string, ParentConfig> = this._parents

    for (const field of search) {
      if (!field.includes('.')) {
        ownFields.push(field)
        continue
      }

      // Split on first dot only
      const parts = field.split('.', 2)
      const parentKey = parts[0]
      const fieldName = parts[1]

      if (!parentKey || !fieldName) {
        continue
      }

      // Validate parentKey exists in parents config
      if (!parents[parentKey]) {
        console.warn(
          `[EntityManager:${this.name}] Unknown parent '${parentKey}' in searchFields '${field}', skipping`
        )
        continue
      }

      // Group by parentKey
      if (!parentFields[parentKey]) {
        parentFields[parentKey] = []
      }
      parentFields[parentKey].push(fieldName)
    }

    return { ownFields, parentFields }
  }

  proto._resolveSearchFields = async function (this: Self, items: unknown[]): Promise<void> {
    const { parentFields } = this._parseSearchFields()

    // No parent fields to resolve
    if (Object.keys(parentFields).length === 0) return

    const orchestrator = this._orchestrator
    const parents: Record<string, ParentConfig> = this._parents

    // Need orchestrator to access other managers
    if (!orchestrator) {
      console.warn(
        `[EntityManager:${this.name}] No orchestrator, cannot resolve parent fields`
      )
      return
    }

    // Process each parent type
    for (const [parentKey, fields] of Object.entries(parentFields)) {
      const config = parents[parentKey]

      if (!config) {
        console.warn(
          `[EntityManager:${this.name}] Missing parent config for '${parentKey}'`
        )
        continue
      }

      // Extract unique parent IDs (deduplicated)
      const ids = [
        ...new Set(
          items
            .map((i) => (i as Record<string, unknown>)[config.foreignKey as string] as string | number | undefined)
            .filter((id): id is string | number => id != null)
        ),
      ]
      if (ids.length === 0) continue

      // Batch fetch parent entities
      const manager = orchestrator.get(config.entity)
      if (!manager) {
        console.warn(
          `[EntityManager:${this.name}] Manager not found for '${config.entity}'`
        )
        continue
      }

      const parentItems = await manager.getMany(ids)
      const parentMap = new Map(
        parentItems.map((p) => [p[manager.idField as keyof typeof p], p])
      )

      // Cache resolved values in _search (non-enumerable)
      for (const item of items) {
        // Initialize _search as non-enumerable if needed
        const itemWithSearch = item as { _search?: Record<string, string>; [k: string]: unknown }
        if (!itemWithSearch._search) {
          Object.defineProperty(item, '_search', {
            value: {},
            enumerable: false,
            writable: true,
            configurable: true,
          })
        }

        const parent = parentMap.get(itemWithSearch[config.foreignKey as string])
        for (const field of fields) {
          itemWithSearch._search![`${parentKey}.${field}`] =
            (parent?.[field as keyof typeof parent] as string) ?? ''
        }
      }
    }
  }

  // ============ SIGNAL LISTENERS ============

  proto._setupCacheListeners = function (this: Self): void {
    const signals = this._signals
    if (!signals) return

    // Clean up existing listeners if any
    const existingCleanup = this._signalCleanup
    if (existingCleanup) {
      existingCleanup()
      this._signalCleanup = null
    }

    const cleanups: Array<() => void> = []
    const parents: Record<string, ParentConfig> = this._parents

    // Listen for parent data changes (if parents defined)
    if (parents && Object.keys(parents).length > 0) {
      const parentEntities = Object.values(parents).map((p) => p.entity)
      cleanups.push(
        signals.on(
          'entity:data-invalidate',
          (event: { name: string; data: unknown }) => {
            const { entity } = (event.data || {}) as { entity?: string }
            if (entity && parentEntities.includes(entity)) {
              this._clearSearchCache()
            }
          }
        )
      )
    }

    // Listen for own entity data changes to invalidate detail cache
    if (this.isAsymmetric && this.isDetailCacheEnabled) {
      cleanups.push(
        signals.on(
          'entity:data-invalidate',
          (event: { name: string; data: unknown }) => {
            const { entity } = (event.data || {}) as { entity?: string }
            if (entity === this.name) {
              this.invalidateDetailCache()
            }
          }
        )
      )
    }

    // Listen for datalayer invalidation
    cleanups.push(
      signals.on(
        'entity:datalayer-invalidate',
        (event: { name: string; data: unknown }) => {
          const { entity, actuator } = (event.data || {}) as {
            entity?: string
            actuator?: string
          }
          // Auth-triggered: only react if authSensitive
          if (actuator === 'auth' && !this._authSensitive) return

          // Check entity match (global or targeted)
          if (!entity || entity === '*' || entity === this.name) {
            this.invalidateDataLayer()
          }
        }
      )
    )

    // Combined cleanup function
    this._signalCleanup = () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }

  proto._clearSearchCache = function (this: Self): void {
    const cache = this._cache
    if (!cache.valid) return

    for (const item of cache.items) {
      const itemWithSearch = item as { _search?: Record<string, string> }
      if (itemWithSearch._search) {
        itemWithSearch._search = {}
      }
    }

    // Invalidate cache so next list() refetches
    this.invalidateCache()
  }

  // ============ CACHE STATE ============

  proto.invalidateDetailCache = function (this: Self): void {
    this._detailCache.items.clear()
    this._detailInflight.clear()
  }

  proto.invalidateCache = function (this: Self): void {
    const cache = this._cache
    cache.valid = false
    cache.items = []
    cache.total = 0
    cache.loadedAt = null
    this._cacheLoading = null
    // Also clear detail cache
    this.invalidateDetailCache()
  }

  proto.invalidateDataLayer = function (this: Self): void {
    this.invalidateCache()

    // Reset storage if it supports it (e.g., clear auth tokens, cached responses)
    if (typeof this.storage?.reset === 'function') {
      this.storage.reset()
    }
  }

  // ============ CACHE LOADING ============

  proto.ensureCache = async function (this: Self): Promise<boolean> {
    if (!this.isCacheEnabled) return false
    if (this._cache.valid) return true

    // Avoid concurrent cache loads
    if (this._cacheLoading) {
      await this._cacheLoading
      return this._cache.valid
    }

    this._cacheLoading = this._loadCache()
    const result = await this._cacheLoading
    this._cacheLoading = null
    return result
  }

  proto._loadCacheInBackground = function (this: Self): void {
    this._cacheLoading = this._loadCache()
    this._cacheLoading
      .catch((err: unknown) =>
        console.error(
          `[EntityManager:${this.name}] Background cache load failed:`,
          err
        )
      )
      .finally(() => {
        this._cacheLoading = null
      })
  }

  proto._loadCache = async function (this: Self): Promise<boolean> {
    const threshold = this.effectiveThreshold

    // First, check total count with minimal request
    // Use _internal to skip stats counting
    const probe = await this.list({ page_size: 1, _internal: true })

    if (probe.total > threshold) {
      // Too many items, don't cache
      this._cache.valid = false
      return false
    }

    // Load all items (internal operation, skip stats)
    const result = await this.list({
      page_size: probe.total || threshold,
      _internal: true,
    })
    const cache = this._cache
    cache.items = result.items || []
    cache.total = result.total
    cache.loadedAt = Date.now()
    cache.valid = true
    // Resolve parent fields for search (book.title, user.username, etc.)
    await this._resolveSearchFields(cache.items)
    return true
  }

  // ============ WARMUP ============

  proto.warmup = async function (this: Self): Promise<boolean | null> {
    // Skip if warmup disabled or caching not applicable
    if (!this._warmup) return null
    if (!this.isCacheEnabled) return null

    const deferred = this._orchestrator?.deferred

    // Wait for auth if app uses authentication (user context affects cache)
    if (deferred?.has('auth:ready')) {
      await deferred.await('auth:ready')
    }

    const key = `entity:${this.name}:cache`

    if (!deferred) {
      // Fallback: direct cache load without DeferredRegistry
      return this.ensureCache()
    }

    // Register in DeferredRegistry for loose coupling
    return deferred.queue(key, () => this.ensureCache())
  }

  proto.getCacheInfo = function (this: Self): CacheInfo {
    const ttlMs = this.effectiveCacheTtlMs
    const cache = this._cache
    const asymmetric = this.isAsymmetric
    return {
      enabled: this.isCacheEnabled,
      storageSupportsTotal: this.storageSupportsTotal,
      threshold: this.effectiveThreshold,
      valid: cache.valid,
      overflow: this.overflow,
      itemCount: cache.items.length,
      total: cache.total,
      loadedAt: cache.loadedAt,
      ttlMs,
      expiresAt: cache.loadedAt && ttlMs > 0
        ? cache.loadedAt + ttlMs
        : null,
      expired: this._isCacheExpired(),
      asymmetric,
      detailCache: asymmetric && this.isDetailCacheEnabled
        ? {
            enabled: true,
            ttlMs: this.effectiveDetailCacheTtlMs,
            size: this._detailCache.items.size,
            maxSize: this._detailCacheMaxSize,
          }
        : null,
    }
  }
}
