/**
 * Unit tests for EntityManager asymmetric mode (list vs detail cache separation)
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'

/**
 * Fake storage that returns different structures for list() vs get().
 * list() returns summary fields, get() returns full detail.
 * Supports caching (supportsTotal: true, supportsCaching: true).
 */
class AsymmetricStorage {
  static capabilities = {
    supportsTotal: true,
    supportsFilters: false,
    supportsPagination: true,
    supportsCaching: true,
  }

  constructor(items = []) {
    this._items = items
    this.listCallCount = 0
    this.getCallCount = 0
  }

  async list(params = {}) {
    this.listCallCount++
    const { page = 1, page_size = 20 } = params
    // Return summary-only items (no detail fields)
    const summaries = this._items.map(({ id, name }) => ({ id, name }))
    const total = summaries.length
    const start = (page - 1) * page_size
    return { items: summaries.slice(start, start + page_size), total }
  }

  async get(id) {
    this.getCallCount++
    // Return full detail item
    const item = this._items.find(i => String(i.id) === String(id))
    if (!item) throw new Error(`Not found: ${id}`)
    return { ...item }
  }
}

/**
 * Simple storage for non-asymmetric (symmetric) mode tests.
 */
class SymmetricStorage {
  static capabilities = {
    supportsTotal: true,
    supportsFilters: false,
    supportsPagination: true,
    supportsCaching: true,
  }

  constructor(items = []) {
    this._items = items
    this.listCallCount = 0
    this.getCallCount = 0
  }

  async list(params = {}) {
    this.listCallCount++
    const { page = 1, page_size = 20 } = params
    const total = this._items.length
    const start = (page - 1) * page_size
    return { items: this._items.slice(start, start + page_size).map(i => ({ ...i })), total }
  }

  async get(id) {
    this.getCallCount++
    const item = this._items.find(i => String(i.id) === String(id))
    if (!item) throw new Error(`Not found: ${id}`)
    return { ...item }
  }
}

const DETAIL_ITEMS = [
  { id: 1, name: 'Alpha', description: 'Full details for Alpha', extra: 'a' },
  { id: 2, name: 'Beta', description: 'Full details for Beta', extra: 'b' },
  { id: 3, name: 'Gamma', description: 'Full details for Gamma', extra: 'c' },
]

describe('EntityManager - Asymmetric Mode', () => {
  let storage
  let manager

  beforeEach(() => {
    storage = new AsymmetricStorage(DETAIL_ITEMS)
  })

  describe('configuration', () => {
    it('defaults to non-asymmetric', () => {
      manager = new EntityManager({ name: 'items', storage })
      expect(manager.isAsymmetric).toBe(false)
    })

    it('can be enabled via options', () => {
      manager = new EntityManager({ name: 'items', storage, asymmetric: true })
      expect(manager.isAsymmetric).toBe(true)
    })

    it('falls back to storage capabilities', () => {
      class AsymStorageCaps {
        static capabilities = {
          supportsTotal: true,
          supportsCaching: true,
          supportsPagination: true,
          supportsFilters: false,
          asymmetric: true,
        }
        async list() { return { items: [], total: 0 } }
        async get() { return null }
      }
      manager = new EntityManager({ name: 'items', storage: new AsymStorageCaps() })
      expect(manager.isAsymmetric).toBe(true)
    })

    it('detail cache is disabled by default (detailCacheTtlMs=0)', () => {
      manager = new EntityManager({ name: 'items', storage, asymmetric: true })
      expect(manager.effectiveDetailCacheTtlMs).toBe(0)
      expect(manager.isDetailCacheEnabled).toBe(false)
    })

    it('detail cache is enabled when detailCacheTtlMs > 0', () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: 60000,
      })
      expect(manager.isDetailCacheEnabled).toBe(true)
    })

    it('detail cache is enabled when detailCacheTtlMs = -1 (infinite)', () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: -1,
      })
      expect(manager.isDetailCacheEnabled).toBe(true)
    })

    it('detail cache is not enabled if not asymmetric', () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: false, detailCacheTtlMs: 60000,
      })
      expect(manager.isDetailCacheEnabled).toBe(false)
    })
  })

  describe('get() in asymmetric mode', () => {
    it('skips list cache and fetches from storage', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, localFilterThreshold: 100,
      })

      // Populate list cache
      await manager.list({ page_size: 100 })
      expect(storage.listCallCount).toBe(1)

      // get() should NOT use list cache - should call storage.get()
      const item = await manager.get(1)
      expect(storage.getCallCount).toBe(1)
      expect(item.description).toBe('Full details for Alpha')
      expect(item.extra).toBe('a')
    })

    it('returns full detail fields not available in list', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, localFilterThreshold: 100,
      })

      // Populate list cache
      await manager.list({ page_size: 100 })

      // Verify list cache has summary-only items (no description)
      const listResult = await manager.list({ page_size: 100 })
      expect(listResult.items[0].description).toBeUndefined()

      // get() returns full detail
      const detail = await manager.get(1)
      expect(detail.description).toBe('Full details for Alpha')
    })

    it('stores result in detail cache when enabled', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: 60000,
      })

      // First get: fetches from storage
      const item1 = await manager.get(1)
      expect(storage.getCallCount).toBe(1)
      expect(item1.description).toBe('Full details for Alpha')

      // Second get: served from detail cache
      const item2 = await manager.get(1)
      expect(storage.getCallCount).toBe(1) // No additional storage call
      expect(item2.description).toBe('Full details for Alpha')
    })

    it('does not use detail cache when disabled', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: 0,
      })

      await manager.get(1)
      expect(storage.getCallCount).toBe(1)

      // Second get: must fetch again (no detail cache)
      await manager.get(1)
      expect(storage.getCallCount).toBe(2)
    })

    it('tracks detailCacheHits and detailCacheMisses stats', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: -1,
      })

      await manager.get(1)  // miss
      await manager.get(1)  // hit
      await manager.get(2)  // miss
      await manager.get(2)  // hit
      await manager.get(2)  // hit

      const stats = manager.getStats()
      expect(stats.detailCacheMisses).toBe(2)
      expect(stats.detailCacheHits).toBe(3)
    })

    it('deduplicates concurrent get() calls for the same ID', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: -1,
      })

      // Fire two concurrent get() for the same ID
      const [item1, item2] = await Promise.all([
        manager.get(1),
        manager.get(1),
      ])

      // Only one storage call should have been made
      expect(storage.getCallCount).toBe(1)
      expect(item1.description).toBe('Full details for Alpha')
      expect(item2.description).toBe('Full details for Alpha')

      // Both should be independent copies
      expect(item1).not.toBe(item2)
    })

    it('deduplicates concurrent get() even without detail cache', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: 0,
      })

      const [item1, item2] = await Promise.all([
        manager.get(1),
        manager.get(1),
      ])

      expect(storage.getCallCount).toBe(1)
      expect(item1.description).toBe('Full details for Alpha')
      expect(item2.description).toBe('Full details for Alpha')
    })
  })

  describe('detail cache TTL', () => {
    it('expires entries based on detailCacheTtlMs', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: 100,
      })

      // Fetch to populate detail cache
      await manager.get(1)
      expect(storage.getCallCount).toBe(1)

      // Immediately: should serve from cache
      await manager.get(1)
      expect(storage.getCallCount).toBe(1)

      // Advance time past TTL
      vi.useFakeTimers()
      vi.advanceTimersByTime(150)

      // Should fetch again (expired)
      await manager.get(1)
      expect(storage.getCallCount).toBe(2)

      vi.useRealTimers()
    })

    it('infinite TTL never expires', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: -1,
      })

      await manager.get(1)
      expect(storage.getCallCount).toBe(1)

      vi.useFakeTimers()
      vi.advanceTimersByTime(999999999)

      await manager.get(1)
      expect(storage.getCallCount).toBe(1) // Still cached

      vi.useRealTimers()
    })
  })

  describe('cache invalidation', () => {
    it('invalidateDetailCache() clears only detail cache', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true,
        localFilterThreshold: 100, detailCacheTtlMs: -1,
      })

      // Populate both caches
      await manager.list({ page_size: 100 })
      await manager.get(1)
      expect(storage.getCallCount).toBe(1)

      // Invalidate only detail cache
      manager.invalidateDetailCache()

      // List cache should still be valid
      const cacheInfo = manager.getCacheInfo()
      expect(cacheInfo.valid).toBe(true)

      // Detail cache should be empty - get() fetches again
      await manager.get(1)
      expect(storage.getCallCount).toBe(2)
    })

    it('invalidateCache() clears both list and detail cache', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true,
        localFilterThreshold: 100, detailCacheTtlMs: -1,
      })

      // Populate both
      await manager.list({ page_size: 100 })
      await manager.get(1)

      // Invalidate all
      manager.invalidateCache()

      // Both should be empty
      const cacheInfo = manager.getCacheInfo()
      expect(cacheInfo.valid).toBe(false)
      expect(cacheInfo.detailCache.size).toBe(0)
    })
  })

  describe('getMany() in asymmetric mode', () => {
    it('fetches all items via individual get() calls', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: -1,
      })

      const items = await manager.getMany([1, 2])
      expect(items).toHaveLength(2)
      expect(items[0].description).toBe('Full details for Alpha')
      expect(items[1].description).toBe('Full details for Beta')
      expect(storage.getCallCount).toBe(2)
    })

    it('uses detail cache for previously fetched items', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: -1,
      })

      // Pre-fetch item 1
      await manager.get(1)
      expect(storage.getCallCount).toBe(1)

      // getMany for [1, 2]: item 1 from cache, item 2 fetched
      const items = await manager.getMany([1, 2])
      expect(items).toHaveLength(2)
      expect(storage.getCallCount).toBe(2) // Only item 2 was fetched
    })

    it('returns empty array for empty ids', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true,
      })

      const items = await manager.getMany([])
      expect(items).toEqual([])
    })
  })

  describe('getCacheInfo()', () => {
    it('reports asymmetric state', () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: 60000,
      })

      const info = manager.getCacheInfo()
      expect(info.asymmetric).toBe(true)
      expect(info.detailCache).toEqual({
        enabled: true,
        ttlMs: 60000,
        size: 0,
      })
    })

    it('reports null detailCache when not asymmetric', () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: false,
      })

      const info = manager.getCacheInfo()
      expect(info.asymmetric).toBe(false)
      expect(info.detailCache).toBeNull()
    })

    it('reports detail cache size after fetches', async () => {
      manager = new EntityManager({
        name: 'items', storage, asymmetric: true, detailCacheTtlMs: -1,
      })

      await manager.get(1)
      await manager.get(2)

      const info = manager.getCacheInfo()
      expect(info.detailCache.size).toBe(2)
    })
  })

  describe('non-regression: symmetric mode unchanged', () => {
    it('get() uses list cache in symmetric mode', async () => {
      const symStorage = new SymmetricStorage([
        { id: 1, name: 'Alpha', description: 'Full Alpha' },
        { id: 2, name: 'Beta', description: 'Full Beta' },
      ])

      manager = new EntityManager({
        name: 'items',
        storage: symStorage,
        localFilterThreshold: 100,
      })

      // Populate list cache
      await manager.list({ page_size: 100 })
      expect(symStorage.listCallCount).toBe(1)

      // get() should use list cache (no storage.get call)
      const item = await manager.get(1)
      expect(symStorage.getCallCount).toBe(0)
      expect(item.name).toBe('Alpha')
    })

    it('getMany() uses list cache in symmetric mode', async () => {
      const symStorage = new SymmetricStorage([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ])

      manager = new EntityManager({
        name: 'items',
        storage: symStorage,
        localFilterThreshold: 100,
      })

      // Populate list cache
      await manager.list({ page_size: 100 })

      // getMany() should use list cache
      const items = await manager.getMany([1, 2])
      expect(symStorage.getCallCount).toBe(0)
      expect(items).toHaveLength(2)
    })

    it('resetStats() includes detail cache stats', () => {
      manager = new EntityManager({ name: 'items', storage })
      manager.resetStats()
      const stats = manager.getStats()
      expect(stats.detailCacheHits).toBe(0)
      expect(stats.detailCacheMisses).toBe(0)
    })
  })
})
