/**
 * Tests for computeSemanticBreadcrumb (#1356)
 *
 * The create page must keep the entity-list level: /books/create is
 * [entity-list, entity-create], not a single mutated entity-create item
 * (which rendered as `Dashboard > Create`, losing the "Books" crumb).
 */
import { describe, it, expect } from 'vitest'
import { computeSemanticBreadcrumb } from '../../src/composables/useSemanticBreadcrumb'

const ROUTES = [
  { name: 'dashboard', path: '/', meta: {} },
  { name: 'books', path: '/books', meta: { entity: 'books' } },
  { name: 'books-create', path: '/books/create', meta: { entity: 'books' } },
  { name: 'books-show', path: '/books/:id', meta: { entity: 'books' } },
  { name: 'books-edit', path: '/books/:id/edit', meta: { entity: 'books' } },
  { name: 'book-loans', path: '/books/:id/loans', meta: { entity: 'loans' } },
  {
    name: 'book-loans-create',
    path: '/books/:id/loans/create',
    meta: { entity: 'loans' },
  },
]

describe('computeSemanticBreadcrumb create pages (#1356)', () => {
  it('keeps the entity-list level on /books/create', () => {
    expect(computeSemanticBreadcrumb('/books/create', ROUTES)).toEqual([
      { kind: 'entity-list', entity: 'books', route: 'books' },
      { kind: 'entity-create', entity: 'books' },
    ])
  })

  it('treats /books/new like /books/create', () => {
    expect(computeSemanticBreadcrumb('/books/new', ROUTES)).toEqual([
      { kind: 'entity-list', entity: 'books', route: 'books' },
      { kind: 'entity-create', entity: 'books' },
    ])
  })

  it('keeps the child entity-list level on a nested create', () => {
    expect(computeSemanticBreadcrumb('/books/1/loans/create', ROUTES)).toEqual([
      { kind: 'entity-list', entity: 'books', route: 'books' },
      { kind: 'entity-show', entity: 'books', id: '1', route: 'books-show' },
      { kind: 'entity-list', entity: 'loans', route: 'book-loans' },
      { kind: 'entity-create', entity: 'loans' },
    ])
  })
})

describe('computeSemanticBreadcrumb regressions', () => {
  it('list page stays a single entity-list item', () => {
    expect(computeSemanticBreadcrumb('/books', ROUTES)).toEqual([
      { kind: 'entity-list', entity: 'books', route: 'books' },
    ])
  })

  it('edit page: the trailing action segment does not add a spurious item', () => {
    expect(computeSemanticBreadcrumb('/books/1/edit', ROUTES)).toEqual([
      { kind: 'entity-list', entity: 'books', route: 'books' },
      { kind: 'entity-edit', entity: 'books', id: '1', route: 'books-show' },
    ])
  })

  it('show page unchanged', () => {
    expect(computeSemanticBreadcrumb('/books/1', ROUTES)).toEqual([
      { kind: 'entity-list', entity: 'books', route: 'books' },
      { kind: 'entity-show', entity: 'books', id: '1', route: 'books-show' },
    ])
  })
})
