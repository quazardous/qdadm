/**
 * Every storage honours the search term (#2147).
 *
 * `search` has been part of `ListParams` since the beginning, and three of
 * the five built-in storages never read it: ApiStorage dropped it before the
 * request, MemoryStorage and SdkStorage dropped it before filtering. The user
 * typed, the list rebuilt its query, and the term vanished — unfiltered rows
 * and nothing anywhere saying why.
 *
 * `searchItems` had existed since #1192 the whole time; LocalStorage and
 * MockApiStorage called it. That is the shape of this bug: not a missing
 * capability, a missing call, in the three places nobody checked.
 *
 * These are deliberately one test per storage rather than a shared loop —
 * each reaches the term by a different route, and a loop would hide which.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { MemoryStorage } from '../../src/entity/storage/MemoryStorage'
import { SdkStorage } from '../../src/entity/storage/SdkStorage'
import { LocalStorage } from '../../src/entity/storage/LocalStorage'
import { MockApiStorage } from '../../src/entity/storage/MockApiStorage'

const ROWS = [
  { id: 1, title: 'delectus aut autem', owner: 'ana' },
  { id: 2, title: 'quis ut nam facilis', owner: 'bo' },
  { id: 3, title: 'fugiat veniam minus', owner: 'ana' },
]

describe('MemoryStorage honours search (#2147)', () => {
  it('filters to the matching rows', async () => {
    const storage = new MemoryStorage({ initialData: ROWS })

    const result = await storage.list({ search: 'delectus' })

    expect(result.items.map((r) => r.id)).toEqual([1])
  })

  it('reports the total of what MATCHED, not of the collection', async () => {
    // A total counting unsearched rows would give the paginator pages that
    // are not there — the failure is quiet until someone clicks page 2.
    const storage = new MemoryStorage({ initialData: ROWS })

    const result = await storage.list({ search: 'ana' })

    expect(result.total).toBe(2)
  })

  it('leaves the list alone when there is no term', async () => {
    const storage = new MemoryStorage({ initialData: ROWS })
    expect((await storage.list({})).items).toHaveLength(3)
    expect((await storage.list({ search: '   ' })).items).toHaveLength(3)
  })
})

describe('SdkStorage honours search (#2147)', () => {
  it('passes the term to the SDK', async () => {
    const calls = []
    const storage = new SdkStorage({
      sdk: {},
      // A function method config is called as (sdk, params) — the params
      // arrive wrapped as `{ query: … }`.
      methods: {
        list: async (_sdk, params) => {
          calls.push(params)
          return { items: ROWS, total: 3 }
        },
      },
    })

    await storage.list({ search: 'delectus' })

    expect(calls[0].query.search).toBe('delectus')
  })

  it('also filters locally, so an SDK that ignored it cannot fake a page', async () => {
    // Otherwise the whole collection comes back and this branch paginates it
    // as though it had been searched.
    const storage = new SdkStorage({
      clientSidePagination: true,
      sdk: {},
      methods: { list: async () => ({ items: ROWS, total: 3 }) },
    })

    const result = await storage.list({ search: 'delectus' })

    expect(result.items.map((r) => r.id)).toEqual([1])
    expect(result.total).toBe(1)
  })
})

describe('the two that already worked keep working', () => {
  it('LocalStorage', async () => {
    const storage = new LocalStorage({ storageKey: 'qdadm-test-search' })
    for (const row of ROWS) await storage.create(row)

    const result = await storage.list({ search: 'delectus' })

    expect(result.items.map((r) => r.title)).toEqual(['delectus aut autem'])
  })

  it('MockApiStorage', async () => {
    const storage = new MockApiStorage({ entityName: 'searchables', initialData: ROWS })

    const result = await storage.list({ search: 'delectus' })

    expect(result.items.map((r) => r.id)).toEqual([1])
  })
})

describe('a term that survived a numeric round trip (#2147)', () => {
  it('still filters', async () => {
    // `searchItems` required a string and returned the list untouched for
    // anything else — so a reference number restored from a URL as a number
    // searched nothing, silently.
    const storage = new MemoryStorage({
      initialData: [{ id: 1, ref: '9876667194' }, { id: 2, ref: '1112223334' }],
    })

    const result = await storage.list({ search: 9876667194 })

    expect(result.items.map((r) => r.id)).toEqual([1])
  })

  it('ignores a term there is no sensible text for', async () => {
    const storage = new MemoryStorage({ initialData: ROWS })
    for (const nonsense of [{}, [], true, null, undefined]) {
      expect((await storage.list({ search: nonsense })).items).toHaveLength(3)
    }
  })
})
