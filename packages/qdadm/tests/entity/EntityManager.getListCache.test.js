/**
 * get() can skip the list cache (#2484).
 *
 * In symmetric mode a valid list cache answers get() with the LIST ROW. When
 * the list endpoint returns summaries, that row lacks detail fields — an edit
 * form filled from it saved them back empty, erasing a role's permissions in
 * production. `{ listCache: false }` reads the item itself.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'

/** The shape of the incident: /roles returns a summary, /roles/{id} the whole role. */
class SummaryListStorage {
  static capabilities = { supportsTotal: true, supportsFilters: false, supportsPagination: true, supportsCaching: true }

  constructor(items) {
    this._items = items
    this.getCalls = 0
  }

  async list() {
    return { items: this._items.map(({ id, name }) => ({ id, name })), total: this._items.length }
  }

  async get(id) {
    this.getCalls++
    return { ...this._items.find((i) => String(i.id) === String(id)) }
  }
}

const roles = () => {
  const storage = new SummaryListStorage([{ id: 'client', name: 'Client', permissions: ['entity:offers:read'] }])
  return { storage, manager: new EntityManager({ name: 'roles', storage }) }
}

describe('EntityManager.get() and the list cache (#2484)', () => {
  it('in symmetric mode, a loaded list answers get() with its row — a summary', async () => {
    const { storage, manager } = roles()
    await manager.list()

    const row = await manager.get('client')
    expect(row.permissions).toBeUndefined()
    expect(storage.getCalls).toBe(0)
  })

  it('{ listCache: false } reads the item itself, detail fields included', async () => {
    const { storage, manager } = roles()
    await manager.list()

    const item = await manager.get('client', undefined, { listCache: false })
    expect(item.permissions).toEqual(['entity:offers:read'])
    expect(storage.getCalls).toBe(1)
  })
})
