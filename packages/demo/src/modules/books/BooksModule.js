/**
 * Books Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, storage, manager)
 * - Routes (CRUD + children)
 * - Navigation
 * - Zones & Blocks
 *
 * This is the canonical pattern for qdadm modules.
 */

import { Module, MockApiStorage, EntityManager } from 'qdadm'
import { defineAsyncComponent } from 'vue'

// ============================================================================
// STORAGE
// ============================================================================

import booksFixture from '../../fixtures/books.json'

// Auth check imported from shared config (cross-module dependency)
import { authCheck } from '../../config/storages'

const booksStorage = new MockApiStorage({
  entityName: 'books',
  initialData: booksFixture,
  authCheck
})

// Internal storage (no auth check) for other modules to enrich data
export const booksStorageInternal = new MockApiStorage({
  entityName: 'books',
  initialData: booksFixture
})

// ============================================================================
// ENTITY CONFIG
// ============================================================================

const genreOptions = [
  { label: 'Fiction', value: 'fiction' },
  { label: 'Non-Fiction', value: 'non-fiction' },
  { label: 'Science Fiction', value: 'sci-fi' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Mystery', value: 'mystery' }
]

// Books permissions are handled by the SecurityChecker:
// - entity:books:* for admin access
// - entity:books:read, entity:books:list, entity:books:create, entity:books:update for regular users
// - entity:books:delete restricted to admin only via role permissions

// ============================================================================
// MODULE
// ============================================================================

const BooksListHeader = defineAsyncComponent(() => import('./components/BooksListHeader.vue'))
const BooksDetailPanel = defineAsyncComponent(() => import('./components/BooksDetailPanel.vue'))

export class BooksModule extends Module {
  static name = 'books'
  static requires = []
  static priority = 10  // After core modules

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        author: { type: 'text', label: 'Author', required: true, default: '' },
        year: { type: 'number', label: 'Year', default: () => new Date().getFullYear() },
        genre: { type: 'select', label: 'Genre', options: genreOptions, default: 'fiction' }
      },
      children: {
        loans: { entity: 'loans', foreignKey: 'book_id', label: 'Loans' }
      },
      storage: booksStorage
    }).setSeverityMap('genre', {
      'fiction': 'info',
      'non-fiction': 'secondary',
      'sci-fi': 'primary',
      'fantasy': 'warn',
      'mystery': 'danger'
    }))

    // ════════════════════════════════════════════════════════════════════════
    // ZONES
    // ════════════════════════════════════════════════════════════════════════
    ctx
      .zone('books-list-header')
      .zone('books-detail-content')
      .block('books-list-header', {
        id: 'books-header',
        component: BooksListHeader,
        weight: 50
      })
      .block('books-detail-content', {
        id: 'books-detail',
        component: BooksDetailPanel,
        weight: 50
      })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    // Single form pattern: same component for create & edit
    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      form: () => import('./pages/BookForm.vue')  // Handles both create & edit
    }, {
      nav: { section: 'Library', icon: 'pi pi-book' }
    })

    // ════════════════════════════════════════════════════════════════════════
    // CUSTOM PAGE (non-CRUD)
    // ════════════════════════════════════════════════════════════════════════
    ctx.routes('books/stats', [
      {
        path: '',
        name: 'book-stats',
        component: () => import('./pages/BookStats.vue'),
        meta: {
          breadcrumb: [
            { kind: 'route', route: 'book-stats', label: 'Statistics' }
          ]
        }
      }
    ])

    // Optional: add nav item for custom page
    ctx.navItem({
      section: 'Library',
      route: 'book-stats',
      icon: 'pi pi-chart-bar',
      label: 'Stats'
    })

    // Child route: loans for a specific book
    ctx.routes('books/:bookId/loans', [
      {
        path: '',
        name: 'book-loans',
        component: () => import('./pages/BookLoans.vue')
      }
    ], {
      entity: 'loans',
      parent: {
        entity: 'books',
        param: 'bookId',
        foreignKey: 'book_id'
      },
      label: 'Loans'
    })
  }
}

export default BooksModule
