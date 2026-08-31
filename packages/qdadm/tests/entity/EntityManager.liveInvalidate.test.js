/**
 * Remote invalidation (#1888 lot B, reported in #1887).
 *
 * The invalidation signals were written for LOCAL mutations, where the manager
 * that mutates repairs its own cache on the way out. A mutation that happened
 * elsewhere repairs nothing — so an app that emitted the canonical signal kept
 * serving a stale list while believing it had invalidated everything.
 *
 * The fix is gated on the origin marker, and these tests pin both halves: the
 * remote event MUST drop the list cache, and the local echo MUST NOT (otherwise
 * every write costs a pointless refetch of a list already held correctly).
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'
import { createSignalBus } from '../../src/kernel/SignalBus'

class CountingStorage {
  static capabilities = {
    supportsTotal: true,
    supportsFilters: false,
    supportsPagination: true,
    supportsCaching: true,
  }

  constructor(items = []) {
    this._items = items
    this.listCallCount = 0
  }

  async list() {
    this.listCallCount++
    return { items: [...this._items], total: this._items.length }
  }

  async get(id) {
    return this._items.find((i) => String(i.id) === String(id)) ?? null
  }

  async create(data) {
    const item = { id: this._items.length + 1, ...data }
    this._items.push(item)
    return item
  }

  async update(id, data) {
    const item = this._items.find((i) => String(i.id) === String(id))
    Object.assign(item, data)
    return item
  }

  async delete() {}
}

function makeManager(signals, name = 'runs') {
  const storage = new CountingStorage([{ id: 1, title: 'first' }])
  const manager = new EntityManager({ name, storage })
  manager.setSignals(signals)
  return { manager, storage }
}

describe('EntityManager — remote invalidation', () => {
  let signals

  beforeEach(() => {
    signals = createSignalBus()
  })

  it('drops the list cache when the entity changed remotely', async () => {
    const { manager, storage } = makeManager(signals)

    await manager.list()
    await manager.list()
    expect(storage.listCallCount).toBe(1) // second call served from cache

    await signals.emit('entity:data-invalidate', {
      entity: 'runs',
      action: 'updated',
      source: 'remote',
    })

    await manager.list()
    expect(storage.listCallCount).toBe(2) // refetched
  })

  it('ignores its own local echo — a local write must not cost a refetch', async () => {
    const { manager, storage } = makeManager(signals)

    await manager.list()
    expect(storage.listCallCount).toBe(1)

    await signals.emit('entity:data-invalidate', {
      entity: 'runs',
      action: 'updated',
      source: 'local',
    })

    await manager.list()
    expect(storage.listCallCount).toBe(1) // still cached
  })

  it('ignores a remote event aimed at another entity', async () => {
    const { manager, storage } = makeManager(signals)

    await manager.list()
    await signals.emit('entity:data-invalidate', {
      entity: 'jobs',
      action: 'updated',
      source: 'remote',
    })

    await manager.list()
    expect(storage.listCallCount).toBe(1)
  })

  it('ignores an unmarked event — origin unknown is not origin remote', async () => {
    const { manager, storage } = makeManager(signals)

    await manager.list()
    await signals.emit('entity:data-invalidate', { entity: 'runs', action: 'updated' })

    await manager.list()
    expect(storage.listCallCount).toBe(1)
  })

  it('works on a plain entity — the case that received nothing before', async () => {
    const { manager } = makeManager(signals)
    // No parents, not asymmetric: neither pre-existing handler covered it.
    expect(manager.isAsymmetric).toBe(false)

    await manager.list()
    await signals.emit('entity:data-invalidate', {
      entity: 'runs',
      action: 'updated',
      source: 'remote',
    })

    expect(manager._cache.valid).toBe(false)
  })

  it('marks its own CRUD emissions as local', async () => {
    const emitted = []
    const bus = createSignalBus()
    bus.on('entity:data-invalidate', (event) => emitted.push(event.data))

    const { manager } = makeManager(bus)
    await manager.create({ title: 'second' })

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toMatchObject({ entity: 'runs', action: 'created', source: 'local' })
  })
})
