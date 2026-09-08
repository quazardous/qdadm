/**
 * An API's pagination dialect is configuration, not a reason to subclass
 * (#2113).
 *
 * `paramMapping` used to reach the filters only: you could rename `status` to
 * `state`, but not `page_size` to `limit`. A backend speaking any other
 * pagination dialect — `_page`/`_limit`, `limit`/`offset` — forced consumers
 * to override `list()`, and our own demo had done exactly that, fetching
 * whole collections and slicing them client-side.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { ApiStorage } from '../../src/entity/storage/ApiStorage'

/** Records the params it was called with, answers with a fixed page. */
function fakeClient({ items = [{ id: 1 }], body = {}, headers = {} } = {}) {
  const calls = []
  return {
    calls,
    async get(url, config) {
      calls.push({ url, params: config?.params })
      return { data: { items, ...body }, headers }
    },
  }
}

describe("ApiStorage — the backend's dialect", () => {
  it("sends qdadm's own names when nothing is mapped", async () => {
    const client = fakeClient()
    const storage = new ApiStorage({ endpoint: '/posts', client })

    await storage.list({ page: 3, page_size: 25, sort_by: 'title', sort_order: 'desc' })

    expect(client.calls[0].params).toMatchObject({
      page: 3,
      page_size: 25,
      sort_by: 'title',
      sort_order: 'desc',
    })
  })

  it('renames the pagination and sort keys', async () => {
    const client = fakeClient()
    const storage = new ApiStorage({
      endpoint: '/posts',
      client,
      paramMapping: { page: '_page', page_size: '_limit', sort_by: '_sort', sort_order: '_order' },
    })

    await storage.list({ page: 2, page_size: 10, sort_by: 'id', sort_order: 'asc' })

    const params = client.calls[0].params
    expect(params).toMatchObject({ _page: 2, _limit: 10, _sort: 'id', _order: 'asc' })
    // The old names must be gone, not merely shadowed — a backend that sees
    // both may honour the wrong one.
    expect(params).not.toHaveProperty('page')
    expect(params).not.toHaveProperty('page_size')
  })

  it('still renames filters, and mixes both in one mapping', async () => {
    const client = fakeClient()
    const storage = new ApiStorage({
      endpoint: '/posts',
      client,
      paramMapping: { page_size: 'limit', status: 'state' },
    })

    await storage.list({ page_size: 50, filters: { status: 'open' } })

    expect(client.calls[0].params).toMatchObject({ limit: 50, state: 'open' })
  })

  it('leaves an unmapped key alone', async () => {
    const client = fakeClient()
    const storage = new ApiStorage({
      endpoint: '/posts',
      client,
      paramMapping: { page: '_page' },
    })

    await storage.list({ page: 2, page_size: 10 })

    expect(client.calls[0].params).toMatchObject({ _page: 2, page_size: 10 })
  })

  it('reads the total from a response header when told to', async () => {
    const client = fakeClient({ items: [{ id: 1 }], headers: { 'x-total-count': '200' } })
    const storage = new ApiStorage({
      endpoint: '/todos',
      client,
      responseTotalHeader: 'X-Total-Count',
    })

    const result = await storage.list({ page: 1, page_size: 1 })

    // Without this the paginator would trust items.length and show one page.
    expect(result.total).toBe(200)
  })

  it('reads a header exposed through an AxiosHeaders-like getter', async () => {
    const client = fakeClient({
      headers: { get: (name) => (name === 'X-Total-Count' ? '42' : null) },
    })
    const storage = new ApiStorage({
      endpoint: '/todos',
      client,
      responseTotalHeader: 'X-Total-Count',
    })

    expect((await storage.list()).total).toBe(42)
  })

  it('falls back to the body when the header is absent', async () => {
    const client = fakeClient({ body: { total: 7 }, headers: {} })
    const storage = new ApiStorage({
      endpoint: '/todos',
      client,
      responseTotalHeader: 'X-Total-Count',
    })

    expect((await storage.list()).total).toBe(7)
  })

  it('keeps a genuine zero from the header', async () => {
    // 0 is an answer ("nothing matches your filter"), not a missing value.
    const client = fakeClient({ items: [], headers: { 'x-total-count': '0' } })
    const storage = new ApiStorage({
      endpoint: '/todos',
      client,
      responseTotalHeader: 'X-Total-Count',
      responseTotalKey: 'total',
    })

    expect((await storage.list()).total).toBe(0)
  })

  it('ignores the header when no name is configured', async () => {
    const client = fakeClient({ body: { total: 3 }, headers: { 'x-total-count': '999' } })
    const storage = new ApiStorage({ endpoint: '/todos', client })

    expect((await storage.list()).total).toBe(3)
  })
})

/**
 * The search term reaches the backend (#2147).
 *
 * `search` has been part of `ListParams` all along, and `list()` never read
 * it. A user typed in the search box, `useListPage` built the query, and the
 * term was dropped here without a word — the rows came back unfiltered and
 * nothing said why. Reported against the demo's todos list; it was every
 * ApiStorage-backed list with a search box.
 */
describe('ApiStorage — the search term (#2147)', () => {
  it('puts the term on the wire', async () => {
    const client = fakeClient()
    const storage = new ApiStorage({ endpoint: '/todos', client })

    await storage.list({ search: 'delectus' })

    expect(client.calls[0].params).toMatchObject({ search: 'delectus' })
  })

  it('renames it like every other key', async () => {
    // JSONPlaceholder wants `q`; another backend wants `query`. The name
    // qdadm uses internally is its own business.
    const client = fakeClient()
    const storage = new ApiStorage({
      endpoint: '/todos',
      client,
      paramMapping: { search: 'q', page: '_page', page_size: '_limit' },
    })

    await storage.list({ search: 'delectus', page: 2, page_size: 10 })

    expect(client.calls[0].params).toMatchObject({ q: 'delectus', _page: 2, _limit: 10 })
    expect(client.calls[0].params).not.toHaveProperty('search')
  })

  it('sends nothing when there is no term, rather than an empty one', async () => {
    // `search=` on every request would be noise, and some backends read it
    // as "match the empty string".
    const client = fakeClient()
    const storage = new ApiStorage({ endpoint: '/todos', client })

    await storage.list({ page: 1 })

    expect(client.calls[0].params.search).toBeUndefined()
  })

  it('keeps searchFields on the front, where it belongs', async () => {
    // It says which fields to look at when filtering a cached page locally.
    // A backend that searches knows its own columns, and shipping an array
    // nobody asked for would be a new surprise in place of the old one.
    const client = fakeClient()
    const storage = new ApiStorage({ endpoint: '/todos', client })

    await storage.list({ search: 'x', searchFields: ['title', 'body'] })

    expect(client.calls[0].params).not.toHaveProperty('searchFields')
  })

  it('still lets a filter of the same name win', async () => {
    // The precedence rule the pagination keys already follow.
    const client = fakeClient()
    const storage = new ApiStorage({ endpoint: '/todos', client })

    await storage.list({ search: 'from-the-box', filters: { search: 'from-a-filter' } })

    expect(client.calls[0].params.search).toBe('from-a-filter')
  })
})
