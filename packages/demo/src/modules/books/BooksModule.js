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

import { Module, MockApiStorage, EntityManager } from '@quazardous/qdadm'
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

// Books permissions are grants in the roles provider (main.js), not code:
// ROLE_USER reads and lists (entity:*:read, entity:*:list); ROLE_ADMIN also
// creates, updates and deletes (entity:*:create|update|delete)

// ============================================================================
// MODULE
// ============================================================================

const BooksListHeader = defineAsyncComponent(() => import('./components/BooksListHeader.vue'))
const BooksDetailPanel = defineAsyncComponent(() => import('./components/BooksDetailPanel.vue'))

export class BooksModule extends Module {
  static moduleName = 'books'
  static requires = []
  static priority = 10  // After core modules

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // I18N
    // Convention-derived keys: `entities.<entity>.fields.<field>` are picked
    // up by useFieldManager; `nav.sections.*` / `nav.routes.*` by useNavigation.
    // Inline `label:` props on entity fields stay as fallback when a key is
    // missing.
    // ════════════════════════════════════════════════════════════════════════
    ctx.messages('en', {
      entities: {
        books: {
          label: 'Book',
          labelPlural: 'Books',
          fields: {
            title: 'Title',
            author: 'Author',
            year: 'Year',
            genre: {
              _label: 'Genre',
              options: {
                fiction: 'Fiction',
                'non-fiction': 'Non-Fiction',
                'sci-fi': 'Sci-Fi',
                fantasy: 'Fantasy',
                mystery: 'Mystery',
              },
            },
          },
          groups: { basic: 'Basic Information', details: 'Publication Details' },
          demo: { changedElsewhere: 'Changed elsewhere' },
        },
        genres: {
          label: 'Genre',
          labelPlural: 'Genres',
          fields: { name: 'Name', description: 'Description' },
        },
      },
      nav: {
        sections: { Library: 'Library' },
        routes: { book: 'Books', genre: 'Genres', 'book-stats': 'Stats', 'book-board': 'Library board' },
      },
    })

    ctx.messages('fr', {
      entities: {
        books: {
          label: 'Livre',
          labelPlural: 'Livres',
          fields: {
            title: 'Titre',
            author: 'Auteur',
            year: 'Année',
            genre: {
              _label: 'Genre',
              options: {
                fiction: 'Fiction',
                'non-fiction': 'Documentaire',
                'sci-fi': 'Science-fiction',
                fantasy: 'Fantastique',
                mystery: 'Mystère',
              },
            },
          },
          groups: { basic: 'Informations générales', details: 'Détails de publication' },
          demo: { changedElsewhere: 'Modifié ailleurs' },
        },
        genres: {
          label: 'Genre',
          labelPlural: 'Genres',
          fields: { name: 'Nom', description: 'Description' },
        },
      },
      nav: {
        sections: { Library: 'Bibliothèque' },
        routes: { book: 'Livres', genre: 'Genres', 'book-stats': 'Statistiques', 'book-board': 'Tableau de la bibliothèque' },
      },
    })

    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('books', new EntityManager({
      name: 'books',
      idField: 'bookId',  // Custom ID field name (also used as route param)
      labelField: 'title',
      description: 'The library catalog — every title we track, with author, year and genre.',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        author: { type: 'text', label: 'Author', required: true, default: '' },
        year: { type: 'number', label: 'Year', default: () => new Date().getFullYear() },
        genre: { type: 'select', label: 'Genre', reference: { entity: 'genres' }, default: 'fiction' }
      },
      children: {
        loans: { entity: 'loans', foreignKey: 'book_id' }
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
      description: 'Reference list of book genres — used to classify and filter the catalog.',
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
    // The show page pairs with edit to demo the breadcrumb View↔Edit
    // toggle (#1332, qdadmFeatures.breadcrumbModeToggle in main.js)
    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      show: () => import('./pages/BookShow.vue'),
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

    // The library's domain board (#5352): typed blocks, each reading its own data
    ctx.routes('books/board', [
      {
        path: '',
        name: 'book-board',
        component: () => import('./pages/LibraryBoard.vue'),
        meta: {
          breadcrumb: [
            { kind: 'route', route: 'book-board', label: 'Library' }
          ]
        }
      }
    ])
    ctx.navItem({ section: 'Library', route: 'book-board', icon: 'pi pi-th-large', label: 'Library board' })

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

    // A child page that acts (#4962): reading the book is not enough, it needs
    // `entity:books:update` too. bob and june (read-only) neither see its link
    // nor open it; the guard sends them back.
    ctx.childPage('book', 'reprint', {
      component: () => import('./pages/BookReprint.vue'),
      label: 'Reprint',
      icon: 'pi pi-print',
      permission: 'entity:books:update',
    })

    // A tabbed item (#4963): a book's pages (Details, Info, Reprint, Loans) as
    // tabs under the book's header, the page below; a tab switch keeps the
    // header. The pages are nested under one frame route; their names and
    // paths do not change.
    ctx.itemTabs('books')

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
      // No label: the tab reads the loans' labelPlural from the catalogue
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

    // ════════════════════════════════════════════════════════════════════════
    // DOMAIN (#5389): the Library's bar on top of each of its pages
    // ════════════════════════════════════════════════════════════════════════
    // Its pages: this module's (books, genres, the board, the stats) and,
    // through `entities`, the loans pages the loans module declares.
    const list = (entity) => ctx.orchestrator.get(entity).list({ page_size: 1000 }).then((r) => r.items)
    ctx.domain('library', {
      label: 'Library',
      icon: 'pi pi-building-columns',
      to: { name: 'book-board' },
      entities: ['loans'],
      nav: [
        { label: 'Board', route: 'book-board', icon: 'pi pi-th-large' },
        { label: 'Books', route: 'book', icon: 'pi pi-book', badge: 'toCheck' },
        { label: 'Loans', route: 'loan', icon: 'pi pi-arrow-right-arrow-left', badge: 'onLoan' },
        { label: 'Stats', route: 'book-stats', icon: 'pi pi-chart-bar' },
      ],
      indicators: [
        {
          id: 'onLoan',
          card: 'metric',
          title: 'On loan',
          icon: 'pi pi-arrow-right-arrow-left',
          refresh: 60,
          load: async () => {
            const loans = await list('loans')
            // The series (#5422): books out after each of the last loan events,
            // a sparkline in the full bar
            const events = loans
              .flatMap((l) => [[l.borrowed_at, 1], ...(l.returned_at ? [[l.returned_at, -1]] : [])])
              .sort(([a], [b]) => String(a).localeCompare(String(b)))
            let out = 0
            const series = events.map(([, step]) => (out += step)).slice(-10)
            return { value: loans.filter((l) => !l.returned_at).length, label: 'books', series }
          },
          // More than a few books out: worth a look
          status: (data) => (data.value > 3 ? 'watch' : null),
          to: { name: 'loan' },
        },
        {
          id: 'toCheck',
          card: 'queue',
          title: 'To check',
          icon: 'pi pi-search',
          load: async () => {
            const old = (await list('books')).filter((b) => b.year < 1970)
            return { total: old.length, items: old.slice(0, 3).map((b) => ({ label: b.title })) }
          },
          status: (data) => (data.total ? 'critical' : null),
          to: { name: 'book-stats' },
        },
        {
          id: 'readGoal',
          card: 'goal',
          title: 'Read',
          icon: 'pi pi-flag',
          load: async () => {
            const loans = await list('loans')
            return { value: loans.filter((l) => l.read).length, target: loans.length || 1 }
          },
        },
        // Several series, stacked (#5441): the library's door, in and out over
        // the last 12 hours (simulated). Full, a stacked area; compact, the
        // app's own chart, registered in main.js
        {
          id: 'door',
          card: 'metric',
          title: 'Door',
          icon: 'pi pi-users',
          load: async () => {
            const wave = (base, k) => Array.from({ length: 12 }, (_, h) => Math.round(base + base * 0.6 * Math.sin((h + k) / 2)))
            const enter = wave(20, 0)
            const leave = wave(14, 1)
            return { value: enter.at(-1) + leave.at(-1), label: 'people', series: [{ label: 'in', points: enter }, { label: 'out', points: leave }] }
          },
          options: { chart: 'area', stacked: true },
          compact: { options: { chart: 'dots' } },
        },
        // Dynamic indicators (#5438): which genre leads, and a slot that
        // stays out while nothing fills it
        {
          id: 'topGenre',
          card: 'metric',
          load: async () => {
            const counts = {}
            for (const b of await list('books')) counts[b.genre] = (counts[b.genre] ?? 0) + 1
            const [genre, value] = Object.entries(counts).sort((a, z) => z[1] - a[1])[0] ?? []
            return genre ? { value, genre } : null
          },
          title: (d) => (d ? `Top: ${d.genre}` : undefined),
          icon: (d) => (d?.genre === 'sci-fi' ? 'pi pi-sparkles' : 'pi pi-tag'),
          to: (d) => (d ? { name: 'book', query: { 'books.genre': d.genre } } : undefined),
          visible: (d) => !!d,
        },
        {
          id: 'future',
          card: 'metric',
          title: (d) => d?.label,
          // Books from the future: none, so the slot is left out
          load: async () => {
            const n = (await list('books')).filter((b) => Number(b.year) > 2100).length
            return n ? { value: n, label: 'From the future' } : null
          },
          visible: (d) => !!d,
        },
      ],
    })
  }
}

export default BooksModule
