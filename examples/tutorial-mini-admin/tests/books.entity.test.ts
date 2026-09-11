/**
 * Testing an entity (docs/testing.md): an EntityManager on a MockApiStorage, no DOM, no kernel.
 *
 * Run: npm test -w examples/tutorial-mini-admin
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { EntityManager, MockApiStorage } from '@quazardous/qdadm'

interface Book {
  id: string
  title: string
  author: string
  year: number | null
}

// The same definition as src/modules/books/BooksModule.ts, on a storage key of its own.
function booksManager() {
  return new EntityManager<Book>({
    name: 'books',
    labelField: 'title',
    fields: {
      title: { type: 'text', label: 'Title', required: true, default: '' },
      author: { type: 'text', label: 'Author', default: '' },
      year: { type: 'number', label: 'Year', default: null },
    },
    storage: new MockApiStorage({
      entityName: 'books',
      storageKey: 'test_books',
      initialData: [{ id: '1', title: 'Dune', author: 'Frank Herbert', year: 1965 }],
    }),
  })
}

beforeEach(() => localStorage.clear())

describe('books entity', () => {
  it('lists the initial data, creates a book and updates it', async () => {
    const books = booksManager()
    expect((await books.list()).items.map((b) => b.title)).toEqual(['Dune'])

    const created = await books.create({ title: 'Neuromancer', author: 'William Gibson', year: 1984 })
    expect((await books.get(created.id)).title).toBe('Neuromancer')

    await books.update(created.id, { ...created, year: 1985 })
    expect((await books.get(created.id)).year).toBe(1985)
    expect((await books.list()).items).toHaveLength(2)
  })

  it('declares which fields a form must fill', () => {
    expect(booksManager().getRequiredFields()).toEqual(['title'])
  })
})
