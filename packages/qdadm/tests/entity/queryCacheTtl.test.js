/**
 * query() honours cacheTtlMs (#5464): lists read through query(), which
 * filtered a valid cache locally without ever checking its age, so a list
 * kept showing its first read past the TTL.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'
import { ApiStorage } from '../../src/entity/storage/ApiStorage'

function manager(cacheTtlMs) {
  const calls = []
  const client = {
    async get(url, config) {
      calls.push(config?.params)
      return { data: { items: [{ id: 1 }, { id: 2 }], total: 2 }, headers: {} }
    },
  }
  const m = new EntityManager({ name: 'tasks', storage: new ApiStorage({ endpoint: '/api/tasks', client }), ...(cacheTtlMs !== undefined ? { cacheTtlMs } : {}) })
  return { m, calls }
}

afterEach(() => vi.useRealTimers())

describe('query() and cacheTtlMs (#5464)', () => {
  it('within the TTL: the cache answers; past it: read again', async () => {
    vi.useFakeTimers()
    const { m, calls } = manager(1000)
    await m.query({ page: 1, page_size: 20 })
    expect(calls).toHaveLength(1)
    vi.advanceTimersByTime(500)
    const fresh = await m.query({ page: 1, page_size: 20 })
    expect(calls).toHaveLength(1)
    expect(fresh.fromCache).toBe(true)
    vi.advanceTimersByTime(5000)
    await m.query({ page: 1, page_size: 20 })
    expect(calls).toHaveLength(2)
  })

  it('the default (-1): never expires', async () => {
    vi.useFakeTimers()
    const { m, calls } = manager()
    await m.query({})
    vi.advanceTimersByTime(24 * 3600 * 1000)
    await m.query({})
    expect(calls).toHaveLength(1)
  })

  it('0: no cache, every query reads', async () => {
    const { m, calls } = manager(0)
    await m.query({})
    await m.query({})
    expect(calls).toHaveLength(2)
  })
})
