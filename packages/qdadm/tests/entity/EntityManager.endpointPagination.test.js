/**
 * Unit tests for list() response normalization on the resolved-endpoint path
 * (resolveStorage → storage.request), qdadm #1197.
 *
 * When the API responds with a wrapper `{ data: [...], pagination: { total } }`
 * (or `{ data: [...], total }`), the total must come from the WRAPPER — not
 * fall back to the page length, which makes pagination believe there is only
 * one page.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager'
import { MemoryStorage } from '../../src/entity/storage/MemoryStorage'

/**
 * Storage whose request() returns a canned API response (wrapper shape
 * controlled per test), like an ApiStorage hitting a nested endpoint.
 */
class RequestStorage extends MemoryStorage {
  constructor(response) {
    super()
    this.response = response
    this.requests = []
  }

  async request(method, path, options = {}) {
    this.requests.push({ method, path, options })
    return this.response
  }
}

/** Child-list manager: resolveStorage returns a nested endpoint string */
class TasksManager extends EntityManager {
  resolveStorage() {
    return '/api/admin/jobs/1/tasks'
  }
}

function makeManager(apiResponse) {
  return new TasksManager({
    name: 'tasks',
    storage: new RequestStorage(apiResponse),
    cache: false,
  })
}

const pageItems = [
  { id: 't1', name: 'Task 1' },
  { id: 't2', name: 'Task 2' },
  { id: 't3', name: 'Task 3' },
]

describe('EntityManager.list — resolved endpoint response normalization (#1197)', () => {
  it('reads pagination.total from the response wrapper ({ data, pagination })', async () => {
    const manager = makeManager({
      data: pageItems,
      pagination: { page: 1, limit: 3, total: 12, totalPages: 4 },
    })
    const result = await manager.list({ page: 1, page_size: 3 })
    expect(result.items).toHaveLength(3)
    expect(result.total).toBe(12) // NOT the page length
  })

  it('reads total from the response wrapper ({ data, total })', async () => {
    const manager = makeManager({ data: pageItems, total: 12 })
    const result = await manager.list({ page: 1, page_size: 3 })
    expect(result.items).toHaveLength(3)
    expect(result.total).toBe(12)
  })

  it('still falls back to page length for a bare array response', async () => {
    const manager = makeManager(pageItems)
    const result = await manager.list()
    expect(result.items).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it('still honors totals carried on the inner data object', async () => {
    const manager = makeManager({
      data: { items: pageItems, total: 12 },
    })
    const result = await manager.list()
    expect(result.items).toHaveLength(3)
    expect(result.total).toBe(12)
  })
})
