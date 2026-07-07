/**
 * Unit tests for local-sort null placement in query() (qdadm #1221).
 *
 * The cache-path local sort placed nulls FIRST on desc (direction-aware
 * null handling) — a "Last Seen desc" list showed the never-seen rows on
 * top. Nulls now always sort LAST, both directions, matching the storage
 * adapters' shared comparator.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'
import { MemoryStorage } from '../../src/entity/storage/MemoryStorage'
import { ApiStorage } from '../../src/entity/storage/ApiStorage'

class CachingStorage extends MemoryStorage {
  static capabilities = { ...ApiStorage.capabilities }
}

function makeManager() {
  const items = [
    { id: '1', name: 'a', lastSeen: '2026-07-01' },
    { id: '2', name: 'b', lastSeen: null },
    { id: '3', name: 'c', lastSeen: '2026-07-03' },
    { id: '4', name: 'd', lastSeen: null },
    { id: '5', name: 'e', lastSeen: '2026-07-02' },
  ]
  return new EntityManager({
    name: 'bots',
    storage: new CachingStorage({ initialData: items }),
    localFilterThreshold: 100,
  })
}

describe('query() local sort — null placement (#1221)', () => {
  it('desc: nulls sort LAST (the skybot "Last Seen desc" case)', async () => {
    const manager = makeManager()
    const { items } = await manager.query({ sort_by: 'lastSeen', sort_order: 'desc' })
    expect(items.map((i) => i.lastSeen)).toEqual([
      '2026-07-03',
      '2026-07-02',
      '2026-07-01',
      null,
      null,
    ])
  })

  it('asc: nulls still sort last by default', async () => {
    const manager = makeManager()
    const { items } = await manager.query({ sort_by: 'lastSeen', sort_order: 'asc' })
    expect(items.map((i) => i.lastSeen)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      null,
      null,
    ])
  })

  it("field-level nullSort: 'low' puts \"Never\" beyond the oldest period (#1222)", async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: String(i + 1),
      lastSeen: [null, '2026-07-01', null, '2026-07-03', '2026-07-02'][i],
    }))
    const manager = new EntityManager({
      name: 'bots',
      storage: new CachingStorage({ initialData: items }),
      localFilterThreshold: 100,
      fields: {
        lastSeen: { type: 'date', label: 'Last Seen', nullSort: 'low' },
      },
    })
    // asc: nulls first ("never" is older than the oldest)
    const asc = await manager.query({ sort_by: 'lastSeen', sort_order: 'asc' })
    expect(asc.items.map((i) => i.lastSeen)).toEqual([null, null, '2026-07-01', '2026-07-02', '2026-07-03'])
    // desc: nulls last (recent-first list, "Never" at the end)
    const desc = await manager.query({ sort_by: 'lastSeen', sort_order: 'desc' })
    expect(desc.items.map((i) => i.lastSeen)).toEqual(['2026-07-03', '2026-07-02', '2026-07-01', null, null])
  })

  it("manager-level nullSort default applies when the field has none (#1222)", async () => {
    const manager = new EntityManager({
      name: 'bots',
      storage: new CachingStorage({ initialData: [
        { id: '1', lastSeen: '2026-07-01' },
        { id: '2', lastSeen: null },
      ] }),
      localFilterThreshold: 100,
      nullSort: 'low',
    })
    const asc = await manager.query({ sort_by: 'lastSeen', sort_order: 'asc' })
    expect(asc.items.map((i) => i.lastSeen)).toEqual([null, '2026-07-01'])
  })
})

describe('query() local sort — cache immutability (#1222)', () => {
  it('a sorted query does not mutate the cached order', async () => {
    const manager = makeManager()
    // Fill cache (insertion order)
    await manager.query({ page: 1, page_size: 10 })
    const before = manager._cache.items.map((i) => i.id)

    // Sorted read must not reorder the cache in place
    await manager.query({ page: 1, page_size: 10, sort_by: 'lastSeen', sort_order: 'desc' })
    const after = manager._cache.items.map((i) => i.id)

    expect(after).toEqual(before)

    // And an unsorted read returns the natural order, not the last sort
    const { items } = await manager.query({ page: 1, page_size: 10 })
    expect(items.map((i) => i.id)).toEqual(before)
  })
})
