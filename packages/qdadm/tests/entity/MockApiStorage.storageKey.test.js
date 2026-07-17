/**
 * MockApiStorage storageKey option (#1382) — several apps sharing one origin
 * (GitHub Pages) must be able to namespace their localStorage keys, or the
 * first app to seed an entity name wins and the others' initialData is
 * silently ignored.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { MockApiStorage } from '../../src/entity/storage/MockApiStorage'

beforeEach(() => localStorage.clear())

describe('MockApiStorage storageKey option', () => {
  it('defaults to mockapi_<entityName>_data', async () => {
    const storage = new MockApiStorage({
      entityName: 'books',
      initialData: [{ id: '1', title: 'Dune' }],
    })
    await storage.list()
    expect(localStorage.getItem('mockapi_books_data')).toContain('Dune')
  })

  it('uses the custom key, isolating same-named entities across apps', async () => {
    const appA = new MockApiStorage({
      entityName: 'books',
      storageKey: 'app_a_books',
      initialData: [{ id: '1', title: 'Dune' }],
    })
    const appB = new MockApiStorage({
      entityName: 'books',
      storageKey: 'app_b_books',
      initialData: [{ id: '1', title: 'Neuromancer' }],
    })

    const a = await appA.list()
    const b = await appB.list()
    expect(a.items[0].title).toBe('Dune')
    expect(b.items[0].title).toBe('Neuromancer')
    expect(localStorage.getItem('mockapi_books_data')).toBeNull()
  })
})
