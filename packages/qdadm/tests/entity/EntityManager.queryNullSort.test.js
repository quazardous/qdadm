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

  it('asc: nulls still sort last', async () => {
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
})
