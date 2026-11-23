/**
 * A storage's list contract (#5463), as docs/storage.md states it: what
 * list(params) receives, the { items, total } it returns, where ApiStorage
 * reads the total, and when the manager pages from its local cache instead
 * of the server. Written to be copied: a backend serving 60 rows page by
 * page, with a known total.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'
import { ApiStorage } from '../../src/entity/storage/ApiStorage'
import { IStorage } from '../../src/entity/storage/IStorage'

const ROWS = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}` }))

/** A backend paged by page / page_size, answering { items, total } (or the total in a header) */
function backend({ totalIn = 'body' } = {}) {
  const calls = []
  return {
    calls,
    async get(url, config) {
      const params = config?.params ?? {}
      calls.push(params)
      const page = Number(params.page ?? 1)
      const size = Number(params.page_size ?? 20)
      const items = ROWS.slice((page - 1) * size, page * size)
      if (totalIn === 'header') return { data: { items }, headers: new Headers({ 'X-Total-Count': String(ROWS.length) }) }
      return { data: { items, total: ROWS.length }, headers: {} }
    },
  }
}

function tasks(client, more = {}) {
  return new EntityManager({ name: 'tasks', storage: new ApiStorage({ endpoint: '/api/tasks', client, ...more.storage }), ...more.manager })
}

describe("a storage's list contract (#5463)", () => {
  it('server paging: page 2 is asked for with page and page_size, the total is all the rows', async () => {
    const client = backend()
    const manager = tasks(client, { manager: { localFilterThreshold: 0 } })
    const res = await manager.query({ page: 2, page_size: 20, sort_by: 'title', sort_order: 'asc' })
    expect(client.calls.at(-1)).toMatchObject({ page: 2, page_size: 20, sort_by: 'title', sort_order: 'asc' })
    expect(res.items.map((r) => r.id)).toEqual(ROWS.slice(20, 40).map((r) => r.id))
    expect(res.total).toBe(60)
    expect(res.fromCache).toBe(false)
  })

  it('the total from a header: a fetch Headers object is read with get()', async () => {
    const client = backend({ totalIn: 'header' })
    const manager = tasks(client, { manager: { localFilterThreshold: 0 }, storage: { responseTotalHeader: 'X-Total-Count' } })
    const res = await manager.query({ page: 1, page_size: 20 })
    expect(res.total).toBe(60)
  })

  it('under the threshold: everything read once, then filtered, sorted and paged locally', async () => {
    const client = backend()
    const manager = tasks(client) // localFilterThreshold: 100 by default
    const first = await manager.query({ page: 1, page_size: 20 })
    // One read, unfiltered, of up to the threshold
    expect(client.calls).toHaveLength(1)
    expect(client.calls[0]).toMatchObject({ page_size: 100 })
    expect(first.total).toBe(60)
    const third = await manager.query({ page: 3, page_size: 20 })
    expect(client.calls).toHaveLength(1)
    expect(third.fromCache).toBe(true)
    expect(third.items.map((r) => r.id)).toEqual(ROWS.slice(40, 60).map((r) => r.id))
  })

  it('no total in the body: 0, and the list falls back to the page length, one page', async () => {
    const client = backend()
    client.get = async (url, config) => ({ data: { items: ROWS.slice(0, config.params.page_size) }, headers: {} })
    const manager = tasks(client, { manager: { localFilterThreshold: 0 } })
    const res = await manager.query({ page: 1, page_size: 20 })
    // No total in an object body: 0; useListPage then counts the rows it got
    // (total || items.length), so the paginator shows a single page
    expect(res.total).toBe(0)
    expect(res.total || res.items.length).toBe(20)
  })

  it('a storage of your own: no cache without supportsTotal, paging by offset / limit', async () => {
    const calls = []
    class TasksStorage extends IStorage {
      async list({ page = 1, page_size = 20 } = {}) {
        const offset = (page - 1) * page_size
        calls.push({ offset, limit: page_size })
        return { items: ROWS.slice(offset, offset + page_size), total: ROWS.length }
      }
    }
    const manager = new EntityManager({ name: 'tasks', storage: new TasksStorage() })
    expect(manager.isCacheEnabled).toBe(false)
    await manager.query({ page: 1, page_size: 20 })
    const res = await manager.query({ page: 2, page_size: 20 })
    expect(calls).toEqual([{ offset: 0, limit: 20 }, { offset: 20, limit: 20 }])
    expect(res.total).toBe(60)

    // Declared: it caches like ApiStorage
    class CachedTasksStorage extends TasksStorage {
      static capabilities = { supportsTotal: true, supportsFilters: true, supportsPagination: true, supportsCaching: true }
    }
    expect(new EntityManager({ name: 'tasks', storage: new CachedTasksStorage() }).isCacheEnabled).toBe(true)
  })
})
