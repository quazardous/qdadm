/**
 * Unit tests for query() on entities exceeding effectiveThreshold (#1204).
 *
 * The cache is an OPTIONAL layer: when the entity total exceeds the cache
 * threshold, the cache is never filled — query() must fall back to the
 * API instead of filtering an empty cache into {items:[], total:0}.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'
import { MemoryStorage } from '../../src/entity/storage/MemoryStorage'
import { ApiStorage } from '../../src/entity/storage/ApiStorage'

/** ApiStorage-flavored storage (supportsCaching=true) over in-memory data. */
class CachingStorage extends MemoryStorage {
  static capabilities = { ...ApiStorage.capabilities }
}

function makeManager(count, threshold = 100) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Task ${i + 1}`,
  }))
  const storage = new CachingStorage({ initialData: items })
  return new EntityManager({
    name: 'tasks',
    storage,
    localFilterThreshold: threshold,
  })
}

describe('query() vs cache threshold (#1204)', () => {
  it('returns data (not an empty list) when total exceeds effectiveThreshold', async () => {
    const manager = makeManager(105)
    const result = await manager.query({ page: 1, page_size: 10 })

    expect(result.items).toHaveLength(10)
    expect(result.total).toBe(105)
    expect(result.fromCache).not.toBe(true)
  })

  it('marks the manager as overflowed once list() observes total > threshold', async () => {
    const manager = makeManager(105)
    await manager.list({ page: 1, page_size: 10 })

    expect(manager.overflow).toBe(true)
    expect(manager._cache.valid).toBe(false)
  })

  it('does not re-attempt the cache fill on every query once overflowed', async () => {
    const manager = makeManager(105)
    let listCalls = 0
    const originalList = manager.storage.list.bind(manager.storage)
    manager.storage.list = async (...args) => {
      listCalls++
      return originalList(...args)
    }

    await manager.query({ page: 1, page_size: 10 }) // fill attempt + api = 2
    const after = listCalls
    await manager.query({ page: 2, page_size: 10 }) // api only = 1

    expect(listCalls - after).toBe(1)
  })

  it('still serves small entities from the cache', async () => {
    const manager = makeManager(20)
    const result = await manager.query({ page: 1, page_size: 10 })

    expect(result.items).toHaveLength(10)
    expect(result.total).toBe(20)
    expect(result.fromCache).toBe(true)
    expect(manager.overflow).toBe(false)
  })

  it('invalidateCache() resets the overflowed flag (shrunk entity can re-cache)', async () => {
    const manager = makeManager(105)
    await manager.query({ page: 1, page_size: 10 })
    expect(manager.overflow).toBe(true)

    // Entity shrinks below the threshold
    manager.storage._data = new Map(
      Array.from({ length: 5 }, (_, i) => [String(i + 1), { id: String(i + 1), name: `T${i}` }]),
    )
    manager.invalidateCache()
    expect(manager.overflow).toBe(false)

    const result = await manager.query({ page: 1, page_size: 10 })
    expect(result.total).toBe(5)
    expect(result.fromCache).toBe(true)
  })
})
