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
import genresFixture from '../../fixtures/genres.json'

// Auth check imported from shared config (cross-module dependency)
import { authCheck } from '../../config/storages'

const booksStorage = new MockApiStorage({
  entityName: 'books',
  idField: 'bookId',
  initialData: booksFixture,
  authCheck
})

// Internal storage (no auth check) for other modules to enrich data
export const booksStorageInternal = new MockApiStorage({
  entityName: 'books',
  idField: 'bookId',
  initialData: booksFixture
})

const genresStorage = new MockApiStorage({
  entityName: 'genres',
  initialData: genresFixture,
  authCheck
})

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
      idField: 'bookId',  // Custom ID field name (also used as route param)
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        author: { type: 'text', label: 'Author', required: true, default: '' },
        year: { type: 'number', label: 'Year', default: () => new Date().getFullYear() },
        genre: { type: 'select', label: 'Genre', reference: { entity: 'genres' }, default: 'fiction' }
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

    ctx.entity('genres', new EntityManager({
      name: 'genres',
      labelField: 'name',
      fields: {
        id: { type: 'text', label: 'ID' },
        name: { type: 'text', label: 'Name' },
        description: { type: 'text', label: 'Description' }
      },
      storage: genresStorage
    }).setSeverityMap('id', {
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
    // Route param uses manager.idField ('bookId') automatically
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

    // Child page: custom non-entity tab on book item
    // DEMONSTRATES: ctx.childPage() for adding a simple page tab
    // - Registers route /books/:bookId/info, name: book-info
    // - Appears as "Info" tab alongside "Details" and "Loans"
    ctx.childPage('book', 'info', {
      component: () => import('./pages/BookInfo.vue'),
      label: 'Info',
      icon: 'pi pi-info-circle'
    })

    // Child CRUD: loans for a specific book
    // DEMONSTRATES: ctx.crud() with parentRoute for child entities
    // - Auto-generates list, create, edit routes under books/:bookId/loans
    // - Auto-configures parent meta for breadcrumb and foreign key injection
    ctx.crud('loans', {
      list: () => import('./pages/BookLoans.vue'),
      form: () => import('./pages/BookLoanForm.vue')
    }, {
      parentRoute: 'book',      // Mount under the 'book' route
      foreignKey: 'book_id',    // FK field in loans pointing to books
      label: 'Loans'            // Label for navlinks
      // routePrefix defaults to 'book-loan' (parentRoute + singular entity)
    })

    // ════════════════════════════════════════════════════════════════════════
    // GENRES (read-only with child books)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('genres', {
      list: () => import('./pages/GenreList.vue'),
      form: () => import('./pages/GenreForm.vue')
    }, {
      nav: { section: 'Library', icon: 'pi pi-tags' }
    })

    // Child: books for a specific genre
    ctx.crud('books', {
      list: () => import('./pages/GenreBooks.vue')
    }, {
      parentRoute: 'genre',
      foreignKey: 'genre',
      label: 'Books'
    })

  }
}

export default BooksModule
