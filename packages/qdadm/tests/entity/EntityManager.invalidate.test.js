/**
 * manager.invalidate(id?) (#4959): the app says a record changed.
 *
 * It drops what the caches hold of it and emits `entity:data-invalidate` with
 * `source: 'app'`, which every listener for outside changes hears like
 * `'remote'`. With an id, only that record's detail entry goes; the list cache
 * goes whole, since a complete list cache also answers list() locally.
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

  constructor(items) {
    this._items = items
    this.listCalls = 0
    this.getCalls = 0
  }

  async list() {
    this.listCalls++
    return { items: this._items.map((i) => ({ ...i })), total: this._items.length }
  }

  async get(id) {
    this.getCalls++
    const item = this._items.find((i) => String(i.id) === String(id))
    return item ? { ...item } : null
  }
}

class AsymStorage extends CountingStorage {
  static capabilities = { ...CountingStorage.capabilities, asymmetric: true }
}

describe('EntityManager.invalidate', () => {
  let signals
  let emitted

  beforeEach(() => {
    signals = createSignalBus()
    emitted = []
    signals.on('entity:data-invalidate', (event) => emitted.push(event.data))
  })

  function symmetric() {
    const storage = new CountingStorage([{ id: 'prod', state: 'old' }, { id: 'preprod', state: 'old' }])
    const manager = new EntityManager({ name: 'instances', storage })
    manager.setSignals(signals)
    return { manager, storage }
  }

  it('emits data-invalidate with source app, the id and an update', async () => {
    const { manager } = symmetric()
    manager.invalidate('prod')
    await Promise.resolve()
    expect(emitted).toEqual([{ entity: 'instances', action: 'updated', id: 'prod', source: 'app' }])
  })

  it('without an id, concerns the whole entity: no id in the event', async () => {
    const { manager } = symmetric()
    manager.invalidate()
    await Promise.resolve()
    expect(emitted).toEqual([{ entity: 'instances', action: 'updated', source: 'app' }])
  })

  it('symmetric: get(id) never serves the stale row from the list cache', async () => {
    const { manager, storage } = symmetric()
    await manager.list()
    expect((await manager.get('prod')).state).toBe('old')
    expect(storage.getCalls).toBe(0) // served by the list cache

    storage._items[0].state = 'new'
    manager.invalidate('prod')

    expect((await manager.get('prod')).state).toBe('new')
    expect(storage.getCalls).toBe(1)
  })

  it('drops the list cache, so the next list is read again', async () => {
    const { manager, storage } = symmetric()
    await manager.list()
    await manager.list()
    expect(storage.listCalls).toBe(1)

    manager.invalidate('prod')
    await manager.list()
    expect(storage.listCalls).toBe(2)
  })

  it('works with no signal bus: the caches still go', async () => {
    const storage = new CountingStorage([{ id: 'prod', state: 'old' }])
    const manager = new EntityManager({ name: 'instances', storage })
    await manager.list()
    manager.invalidate('prod')
    expect(manager._cache.valid).toBe(false)
  })

  describe('asymmetric detail cache', () => {
    function asymmetric() {
      const storage = new AsymStorage([{ id: 'prod', state: 'old' }, { id: 'preprod', state: 'old' }])
      const manager = new EntityManager({ name: 'instances', storage, detailCacheTtlMs: 60000 })
      manager.setSignals(signals)
      return { manager, storage }
    }

    it('with an id, drops only that record', async () => {
      const { manager, storage } = asymmetric()
      await manager.get('prod')
      await manager.get('preprod')
      expect(storage.getCalls).toBe(2)

      manager.invalidate('prod')
      await manager.get('prod')
      await manager.get('preprod')
      expect(storage.getCalls).toBe(3) // prod read again, preprod still cached
    })

    it('without an id, drops every record', async () => {
      const { manager, storage } = asymmetric()
      await manager.get('prod')
      await manager.get('preprod')

      manager.invalidate()
      await manager.get('prod')
      await manager.get('preprod')
      expect(storage.getCalls).toBe(4)
    })

    it('a remote event with an id drops only that record too', async () => {
      const { manager, storage } = asymmetric()
      await manager.get('prod')
      await manager.get('preprod')

      await signals.emit('entity:data-invalidate', { entity: 'instances', action: 'updated', id: 'preprod', source: 'remote' })
      await manager.get('prod')
      await manager.get('preprod')
      expect(storage.getCalls).toBe(3)
    })
  })
})
