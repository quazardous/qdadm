/**
 * qdadm-demo - Book Manager Demo
 *
 * This demo showcases qdadm capabilities:
 *
 * 1. KERNEL BOOTSTRAP
 *    - Single entry point for Vue app setup
 *    - Declarative configuration (modules, managers, pages, auth)
 *    - Auto-wires PrimeVue, Pinia, Router, and qdadm plugin
 *
 * 2. ENTITY MANAGERS
 *    - Define entities with fields, labels, storage
 *    - Custom managers extend EntityManager for permissions
 *    - Three permission levels: canRead, canWrite, canDelete
 *
 * 3. PERMISSION PATTERNS
 *    - UsersManager: admin-only (both read and write)
 *    - BooksManager: everyone can read/write, admin-only delete
 *    - LoansManager: ownership-based (users see only their loans)
 *
 * 4. MOCKAPISTORAGE
 *    - In-memory storage with localStorage persistence
 *    - Fixtures loaded via initialData option
 *    - Data survives page refresh
 */

import { Kernel, EntityManager, MockApiStorage, ApiStorage, MemoryStorage, LocalStorage } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'
import 'primeicons/primeicons.css'
import axios from 'axios'

import App from './App.vue'
import { version } from '../package.json'
import { authAdapter } from './adapters/authAdapter'
import { demoEntityAuthAdapter } from './adapters/entityAuthAdapter'

// ============================================================================
// DUMMYJSON STORAGE
// ============================================================================
// DummyJSON uses limit/skip pagination instead of page/page_size.
// Custom storage class converts qdadm pagination params to DummyJSON format.

class DummyJsonStorage extends ApiStorage {
  /**
   * List entities with DummyJSON pagination (limit/skip)
   */
  async list(params = {}) {
    const { page = 1, page_size = 20, sort_by, sort_order, filters = {} } = params
    // Convert page/page_size to limit/skip
    const limit = page_size
    const skip = (page - 1) * page_size

    const response = await this.client.get(this.endpoint, {
      params: { limit, skip, ...filters }
    })

    const data = response.data
    return {
      items: data[this.responseItemsKey] || data.items || data,
      total: data[this.responseTotalKey] || data.total || (Array.isArray(data) ? data.length : 0)
    }
  }
}

// ============================================================================
// REST COUNTRIES STORAGE
// ============================================================================
// REST Countries API returns all 250 countries in one call (no server pagination).
// Uses cca3 (3-letter country code) as unique identifier.
// Override list() to add required 'fields' param and do client-side pagination.

class RestCountriesStorage extends ApiStorage {
  constructor(options = {}) {
    super({
      ...options,
      idField: 'cca3'
    })
  }

  /**
   * List countries - API returns full dataset, we paginate client-side
   */
  async list(params = {}) {
    const { page = 1, page_size = 20, search } = params
    const fields = 'name,cca3,capital,region,population,flag,flags'

    const response = await this.client.get(this.endpoint, { params: { fields } })
    let items = response.data

    // Client-side search
    if (search) {
      const term = search.toLowerCase()
      items = items.filter(c =>
        c.name?.common?.toLowerCase().includes(term) ||
        c.cca3?.toLowerCase().includes(term) ||
        c.region?.toLowerCase().includes(term) ||
        c.capital?.some(cap => cap.toLowerCase().includes(term))
      )
    }

    // Client-side pagination
    const total = items.length
    const start = (page - 1) * page_size
    return { items: items.slice(start, start + page_size), total }
  }

  /**
   * Get single country by cca3 code
   */
  async get(id) {
    const fields = 'name,cca3,capital,region,population,flag,flags'
    const response = await this.client.get(`/v3.1/alpha/${id}`, { params: { fields } })
    return Array.isArray(response.data) ? response.data[0] : response.data
  }
}

// Fixtures for initial data (seeded to localStorage on first load)
import usersFixture from './fixtures/users.json'
import booksFixture from './fixtures/books.json'
import loansFixture from './fixtures/loans.json'
import genresFixture from './fixtures/genres.json'

// ============================================================================
// FIXTURES VERSIONING
// ============================================================================
// Bump this version when fixtures change to force localStorage refresh.
// Old data will be cleared and fixtures will be reloaded on next page load.
const FIXTURES_VERSION = 1
const FIXTURES_VERSION_KEY = 'qdadm_demo_fixtures_version'

const storedVersion = localStorage.getItem(FIXTURES_VERSION_KEY)
if (storedVersion !== String(FIXTURES_VERSION)) {
  // Clear all mockapi data and auth
  Object.keys(localStorage)
    .filter(k => k.startsWith('mockapi_') || k === 'qdadm_demo_auth')
    .forEach(k => localStorage.removeItem(k))
  localStorage.setItem(FIXTURES_VERSION_KEY, String(FIXTURES_VERSION))
  console.log(`[demo] Fixtures upgraded to v${FIXTURES_VERSION}, localStorage cleared`)
}

// ============================================================================
// FIELD OPTIONS
// ============================================================================
// Reusable options for select fields. These are passed to EntityManager
// and can be accessed via manager.getFieldConfig('fieldName').options

const genreOptions = [
  { label: 'Fiction', value: 'fiction' },
  { label: 'Non-Fiction', value: 'non-fiction' },
  { label: 'Science Fiction', value: 'sci-fi' },
  { label: 'Fantasy', value: 'fantasy' },
  { label: 'Mystery', value: 'mystery' }
]

const roleOptions = [
  { label: 'Admin', value: 'ROLE_ADMIN' },
  { label: 'User', value: 'ROLE_USER' }
]

// ============================================================================
// STORAGE INSTANCES
// ============================================================================
// MockApiStorage provides in-memory storage with localStorage persistence.
// Uses initialData to seed fixtures on first load (when localStorage is empty).
// localStorage key pattern: mockapi_${entityName}_data
//
// SEARCHFIELDS CAPABILITY (PRD-009):
// Storage can declare `searchFields` in capabilities to control which fields
// are searched locally. Loans searches by related book title and username:
class LoansStorage extends MockApiStorage {
  static capabilities = {
    ...MockApiStorage.capabilities,
    supportsCaching: true,  // Enable for EntityManager caching (needed for searchFields)
    searchFields: ['book.title', 'user.username']  // parentKey.field syntax
  }

  get supportsCaching() {
    return LoansStorage.capabilities.supportsCaching
  }
}

const usersStorage = new MockApiStorage({
  entityName: 'users',
  initialData: usersFixture
})
const booksStorage = new MockApiStorage({
  entityName: 'books',
  initialData: booksFixture
})
const loansStorage = new LoansStorage({
  entityName: 'loans',
  initialData: loansFixture
})
const genresStorage = new MockApiStorage({
  entityName: 'genres',
  initialData: genresFixture
})

// ============================================================================
// MEMORY STORAGE - Volatile (no persistence)
// ============================================================================
// MemoryStorage keeps data in-memory only. Data is lost on page refresh.
// Useful for session-scoped data like user preferences or temporary state.

const settingsStorage = new MemoryStorage({
  initialData: [
    { id: 'theme', key: 'theme', value: 'light', type: 'string' },
    { id: 'language', key: 'language', value: 'en', type: 'string' },
    { id: 'pageSize', key: 'pageSize', value: '20', type: 'number' }
  ]
})

// ============================================================================
// LOCAL STORAGE - Persistent (survives browser sessions)
// ============================================================================
// LocalStorage uses browser localStorage. Data persists across page refreshes
// and browser restarts. Useful for user favorites, bookmarks, or local cache.

const favoritesStorage = new LocalStorage({
  key: 'qdadm-demo-favorites'
})

// Export for authAdapter (validates login against stored users)
export { usersStorage }

// ============================================================================
// CUSTOM ENTITY MANAGERS
// ============================================================================
// Extend EntityManager to add custom permission logic.
//
// Permission methods:
//   - canRead(entity?)  -> can view (nav visibility, list access, row visibility)
//   - canCreate()       -> can create new entities
//   - canUpdate(entity?)-> can edit entities
//   - canDelete(entity?)-> can delete entities
//
// All default to true. Override in subclass for custom logic.
// Methods with entity parameter support row-level checks.

/**
 * UsersManager - Admin-only access
 *
 * Only admins can see and manage users.
 * Used for: navigation visibility, route guards, action buttons
 */
class UsersManager extends EntityManager {
  _isAdmin() {
    return authAdapter.getUser()?.role === 'ROLE_ADMIN'
  }

  canRead() {
    return this._isAdmin()
  }

  canCreate() {
    return this._isAdmin()
  }

  canUpdate() {
    return this._isAdmin()
  }

  canDelete() {
    return this._isAdmin()
  }
}

/**
 * BooksManager - Everyone can edit, only admin can delete
 *
 * Demonstrates fine-grained permission:
 * - Everyone can read and write (inherited from EntityManager)
 * - Only admins see delete buttons and bulk delete
 */
class BooksManager extends EntityManager {
  canDelete() {
    return authAdapter.getUser()?.role === 'ROLE_ADMIN'
  }
}

/**
 * LoansManager - Ownership-based access + Related Entity Labels
 *
 * Demonstrates two patterns:
 *
 * 1. ROW-LEVEL PERMISSIONS
 *    - Admin sees all loans
 *    - Regular user only sees their own loans
 *    - Override list() to filter, canRead/canUpdate/canDelete for row checks
 *
 * 2. RELATED ENTITY LABELS (Enrichment Pattern)
 *    ─────────────────────────────────────────
 *    Problem: Loan has book_id and user_id, but we want to display
 *    "Le Petit Prince - bob" in breadcrumb/title instead of IDs.
 *
 *    Solution: Enrich data with related entity fields at fetch time.
 *
 *    Why not async labelField?
 *    - getEntityLabel() is sync (used in computed, templates)
 *    - Async would require await everywhere, break reactivity
 *    - Would cause N+1 queries and UI flicker
 *
 *    Pattern:
 *    1. Add _enrichLoan() to fetch related data and add display fields
 *    2. Override get(), create(), update() to call _enrichLoan()
 *    3. Use enriched fields in labelField callback (sync)
 *
 *    Result: labelField can be sync while using related entity data:
 *      labelField: (loan) => `${loan.book_title} - ${loan.username}`
 */
class LoansManager extends EntityManager {
  /**
   * Check if current user is admin
   */
  _isAdmin() {
    return authAdapter.getUser()?.role === 'ROLE_ADMIN'
  }

  /**
   * Check if current user owns the loan
   * @param {object|null} loan - Loan entity, or null for general check
   * @returns {boolean}
   */
  _isOwner(loan) {
    if (!loan) return true // General permission check (no specific entity)
    return loan.user_id === authAdapter.getUser()?.id
  }

  /**
   * Override list() for permission filtering:
   * Non-admin users only see their own loans.
   */
  async list(params = {}) {
    if (!this._isAdmin()) {
      params.filters = params.filters || {}
      params.filters.user_id = authAdapter.getUser()?.id
      params.cacheSafe = true  // Ownership filter is session-bound, safe to cache
    }
    return super.list(params)
  }

  // ============ ENRICHMENT PATTERN ============
  // Fetch related entity data and add display fields to the loan object.
  // This allows labelField to be synchronous while showing related entity info.

  /**
   * Enrich loan with related entity display fields
   *
   * Fetches book and user to add:
   * - book_title: for display in lists, breadcrumb, title
   * - username: for display in lists, breadcrumb, title
   *
   * These fields are used by labelField callback (defined in entity config below)
   */
  async _enrichLoan(data) {
    if (data.book_id) {
      const book = await booksStorage.get(data.book_id)
      data.book_title = book?.title || '?'
    }
    if (data.user_id) {
      const user = await usersStorage.get(data.user_id)
      data.username = user?.username || '?'
    }
  }

  /**
   * Override get() to enrich loan data
   * Called by: useForm (edit page), useNavContext (breadcrumb)
   */
  async get(id) {
    const data = await this.storage.get(id)
    if (data) {
      await this._enrichLoan(data)
    }
    return data
  }

  /**
   * Override create() to enforce user_id for non-admin and enrich
   */
  async create(data) {
    if (!this._isAdmin()) {
      data.user_id = authAdapter.getUser()?.id
    }
    await this._enrichLoan(data)
    return this.storage.create(data)
  }

  /**
   * Override update() to enrich loan data
   */
  async update(id, data) {
    await this._enrichLoan(data)
    return this.storage.update(id, data)
  }

  canRead(loan = null) {
    if (this._isAdmin()) return true
    return this._isOwner(loan)
  }

  canCreate() {
    // Everyone can create loans (for themselves)
    return true
  }

  canUpdate(loan = null) {
    if (this._isAdmin()) return true
    return this._isOwner(loan)
  }

  /**
   * Permission check for deleting
   * @param {object|null} loan - Specific loan or null for general check
   */
  canDelete(loan = null) {
    if (this._isAdmin()) return true
    return this._isOwner(loan)
  }
}

// ============================================================================
// ENTITY DEFINITIONS
// ============================================================================
// Kernel uses managerFactory to resolve managers from various config formats:
//
// PATTERN 1: Direct Instance (for custom managers with logic)
//   books: new BooksManager({ storage, fields, ... })
//   → Instance passed through directly
//
// PATTERN 2: Config Object (for basic managers with customization)
//   genres: { storage: genresStorage, label: 'Genre', fields: {...} }
//   → Factory creates EntityManager from config
//
// PATTERN 3: String Pattern (for qdadm-gen / declarative configs)
//   tasks: 'api:/api/tasks'
//   → Factory creates storage + manager from pattern
//
// This demo showcases Pattern 1 (books, users, loans) and Pattern 2 (genres).

const managers = {
  // PATTERN 1: Direct Instance - Custom manager with permission logic
  // Use this when you need canRead/canCreate/canUpdate/canDelete overrides.
  // The factory passes instances through unchanged.
  books: new BooksManager({
    name: 'books',
    label: 'Book',
    labelPlural: 'Books',
    routePrefix: 'book',
    labelField: 'title',  // Used in breadcrumbs, delete confirmations, etc.
    fields: {
      title: { type: 'text', label: 'Title', required: true, default: '' },
      author: { type: 'text', label: 'Author', required: true, default: '' },
      year: { type: 'number', label: 'Year', default: () => new Date().getFullYear() },
      genre: { type: 'select', label: 'Genre', options: genreOptions, default: 'fiction' }
    },
    // Child entities - displayed as tabs in edit form
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
  }),

  users: new UsersManager({
    name: 'users',
    label: 'User',
    labelPlural: 'Users',
    routePrefix: 'user',
    labelField: 'username',
    fields: {
      username: { type: 'text', label: 'Username', required: true, default: '' },
      password: { type: 'password', label: 'Password', required: true, default: '' },
      role: { type: 'select', label: 'Role', options: roleOptions, default: 'user' }
    },
    storage: usersStorage
  }),

  loans: new LoansManager({
    name: 'loans',
    label: 'Loan',
    labelPlural: 'Loans',
    routePrefix: 'loan',
    // PRD-009: Multi-parent config for searchFields parent field resolution
    parents: {
      book: { entity: 'books', foreignKey: 'book_id' },
      user: { entity: 'users', foreignKey: 'user_id' }
    },
    // ENRICHMENT PATTERN: labelField uses enriched fields (book_title, username)
    // added by _enrichLoan() in get()/create()/update() - see LoansManager above.
    // This keeps labelField sync while displaying related entity data.
    labelField: (loan) => loan.book_title && loan.username
      ? `${loan.book_title} - ${loan.username}`
      : `Loan #${loan.id?.slice(-6) || 'new'}`,
    fields: {
      book_id: { type: 'text', label: 'Book', required: true, default: '' },
      user_id: { type: 'text', label: 'User', required: true, default: '' },
      borrowed_at: { type: 'datetime', label: 'Borrowed At', default: () => new Date().toISOString() },
      returned_at: { type: 'datetime', label: 'Returned At', default: null },
      read: { type: 'boolean', label: 'Read?', default: false }
    },
    storage: loansStorage
  }),

  // PATTERN 2: Config Object - Factory creates EntityManager from config
  // Use this for basic entities without custom permission/business logic.
  // The factory resolves storage (can be string pattern or instance) and
  // creates an EntityManager with the provided config.
  genres: {
    label: 'Genre',
    labelPlural: 'Genres',
    routePrefix: 'genre',
    labelField: 'name',
    fields: {
      name: { type: 'text', label: 'Name', required: true, default: '' },
      description: { type: 'text', label: 'Description', default: '' }
    },
    // Child: books filtered by genre
    children: {
      books: { entity: 'books', foreignKey: 'genre', label: 'Books' }
    },
    storage: genresStorage  // Can also be: 'mock:genres' (string pattern)
  }
}

// ============================================================================
// JSONPLACEHOLDER MANAGERS
// ============================================================================
// External API integration demonstrating real REST API usage.
// Managers are prefixed with 'jp_' to avoid collision with local entities
// (e.g., jp_users vs users for local demo users).
//
// Note: JSONPlaceholder is read-only (changes are simulated but not persisted).

const jpClient = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com'
})

// Storage factory for JSONPlaceholder API
const jpStorage = (endpoint) => new ApiStorage({
  endpoint,
  client: jpClient
})

// Merge local managers with JSONPlaceholder managers
const allManagers = {
  ...managers,

  // JSONPlaceholder Users (prefixed to avoid collision with local users)
  jp_users: new EntityManager({
    name: 'jp_users',
    label: 'JP User',
    labelPlural: 'JP Users',
    routePrefix: 'jp_user',
    labelField: 'name',
    readOnly: true,
    localFilterThreshold: 0,  // Disable qdadm caching for external API
    fields: {
      id: { type: 'number', label: 'ID', readOnly: true },
      name: { type: 'text', label: 'Full Name', required: true },
      username: { type: 'text', label: 'Username', required: true },
      email: { type: 'email', label: 'Email', required: true },
      phone: { type: 'text', label: 'Phone' },
      website: { type: 'url', label: 'Website' }
    },
    storage: jpStorage('/users')
  }),

  // JSONPlaceholder Posts
  posts: new EntityManager({
    name: 'posts',
    label: 'Post',
    labelPlural: 'Posts',
    routePrefix: 'post',
    labelField: 'title',
    readOnly: true,
    localFilterThreshold: 0,  // Disable qdadm caching for external API
    fields: {
      id: { type: 'number', label: 'ID', readOnly: true },
      title: { type: 'text', label: 'Title', required: true },
      body: { type: 'text', label: 'Body', required: true },
      userId: { type: 'number', label: 'Author', required: true }
    },
    storage: jpStorage('/posts')
  }),

  // JSONPlaceholder Todos
  todos: new EntityManager({
    name: 'todos',
    label: 'Todo',
    labelPlural: 'Todos',
    routePrefix: 'todo',
    labelField: 'title',
    readOnly: true,
    localFilterThreshold: 0,  // Disable qdadm caching for external API
    fields: {
      id: { type: 'number', label: 'ID', readOnly: true },
      title: { type: 'text', label: 'Title', required: true },
      completed: { type: 'boolean', label: 'Completed' },
      userId: { type: 'number', label: 'Assigned To', required: true }
    },
    storage: jpStorage('/todos')
  }),

  // ============================================================================
  // DUMMYJSON MANAGERS
  // ============================================================================
  // DummyJSON API integration demonstrating different pagination style (limit/skip).
  // Note: DummyJSON is read-only (changes are simulated but not persisted).

  // DummyJSON Products
  products: new EntityManager({
    name: 'products',
    label: 'Product',
    labelPlural: 'Products',
    routePrefix: 'product',
    labelField: 'title',
    readOnly: true,
    localFilterThreshold: 0,  // Disable qdadm caching for external API
    fields: {
      id: { type: 'number', label: 'ID', readOnly: true },
      title: { type: 'text', label: 'Title', required: true },
      price: { type: 'number', label: 'Price' },
      category: { type: 'text', label: 'Category' },
      thumbnail: { type: 'url', label: 'Thumbnail' }
    },
    storage: new DummyJsonStorage({
      endpoint: '/products',
      client: axios.create({ baseURL: 'https://dummyjson.com' }),
      responseItemsKey: 'products'
    })
  }),

  // ============================================================================
  // REST COUNTRIES MANAGERS
  // ============================================================================
  // REST Countries API integration - returns all 250 countries.
  // Uses cca3 (3-letter ISO code) as unique identifier.
  // Read-only entity with client-side pagination and search.

  countries: new EntityManager({
    name: 'countries',
    label: 'Country',
    labelPlural: 'Countries',
    routePrefix: 'country',
    labelField: (country) => country.name?.common || country.cca3,
    idField: 'cca3',
    readOnly: true,
    localFilterThreshold: 0,  // Disable qdadm caching for external API
    fields: {
      cca3: { type: 'text', label: 'Code', readOnly: true },
      name: { type: 'object', label: 'Name', readOnly: true },
      capital: { type: 'array', label: 'Capital', readOnly: true },
      region: { type: 'text', label: 'Region', readOnly: true },
      population: { type: 'number', label: 'Population', readOnly: true },
      flag: { type: 'text', label: 'Flag', readOnly: true }
    },
    storage: new RestCountriesStorage({
      endpoint: '/v3.1/all',
      client: axios.create({ baseURL: 'https://restcountries.com' })
    })
  }),

  // ============================================================================
  // LOCAL STORAGE MANAGERS
  // ============================================================================
  // LocalStorage adapter for browser-local persistence.
  // Data survives page refresh and browser sessions.

  // Favorites - User bookmarks stored in localStorage
  favorites: new EntityManager({
    name: 'favorites',
    label: 'Favorite',
    labelPlural: 'Favorites',
    routePrefix: 'favorite',
    labelField: 'name',
    fields: {
      id: { type: 'text', label: 'ID', readOnly: true },
      name: { type: 'text', label: 'Name', required: true, default: '' },
      entityType: {
        type: 'select',
        label: 'Type',
        required: true,
        default: 'book',
        options: [
          { label: 'Book', value: 'book' },
          { label: 'User', value: 'user' },
          { label: 'Genre', value: 'genre' },
          { label: 'Loan', value: 'loan' }
        ]
      },
      entityId: { type: 'text', label: 'Entity ID', required: true, default: '' },
      createdAt: { type: 'datetime', label: 'Created At', readOnly: true }
    },
    storage: favoritesStorage
  }),

  // ============================================================================
  // MEMORY STORAGE MANAGERS
  // ============================================================================
  // Volatile storage - data lost on page refresh. Demonstrates MemoryStorage.

  // Settings - key/value pairs for app configuration (volatile)
  settings: new EntityManager({
    name: 'settings',
    label: 'Setting',
    labelPlural: 'Settings',
    routePrefix: 'setting',
    labelField: 'key',
    fields: {
      id: { type: 'text', label: 'ID', readOnly: true },
      key: { type: 'text', label: 'Key', required: true },
      value: { type: 'text', label: 'Value', required: true },
      type: {
        type: 'select',
        label: 'Type',
        options: [
          { label: 'String', value: 'string' },
          { label: 'Number', value: 'number' },
          { label: 'Boolean', value: 'boolean' }
        ],
        default: 'string'
      }
    },
    storage: settingsStorage
  })
}

// ============================================================================
// KERNEL CONFIGURATION
// ============================================================================
// Kernel is the all-in-one bootstrap class. It:
//   1. Creates Vue app with Pinia store
//   2. Configures PrimeVue with theme
//   3. Installs qdadm plugin with managers
//   4. Sets up router with module routes
//   5. Adds auth guard for protected routes
//
// Config options:
//   - root: Root Vue component
//   - modules: Glob pattern for module init files
//   - sectionOrder: Order of nav sections
//   - managers: Entity managers (keyed by name)
//   - authAdapter: Authentication adapter
//   - pages: Custom login/layout components
//   - homeRoute: Default route after login
//   - app: Branding (name, version)
//   - primevue: PrimeVue configuration

const kernel = new Kernel({
  root: App,
  basePath: import.meta.env.BASE_URL,
  hashMode: true, // Use /#/path for static hosting (GitHub Pages)
  // Auto-discover modules from ./modules/*/init.js
  // Each module exports init(registry) function
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  modulesOptions: {
    coreNavItems: [
      { section: 'Library', route: 'home', icon: 'pi pi-home', label: 'Home' }
    ]
  },
  // Navigation sections order
  sectionOrder: ['Library', 'Memory Storage', 'Local Storage', 'JSONPlaceholder', 'DummyJSON', 'REST Countries', 'Administration'],
  managers: allManagers,
  authAdapter,
  entityAuthAdapter: demoEntityAuthAdapter,
  // Security config: role hierarchy and permissions
  security: {
    role_hierarchy: {
      ROLE_ADMIN: ['ROLE_USER']  // Admin inherits User permissions
    },
    role_permissions: {
      ROLE_USER: ['entity:read', 'entity:list'],
      ROLE_ADMIN: ['entity:create', 'entity:update', 'entity:delete',
                   'user:manage', 'role:assign', 'user:impersonate']
    }
  },
  // EventRouter: declarative signal routing for cross-cutting concerns
  // Transforms high-level events into targeted signals that EntityManagers listen to.
  // Components stay simple - they only know their own signals, not global auth logic.
  eventRouter: {
    // When user impersonates another, invalidate user-scoped caches
    'auth:impersonate': [
      'cache:entity:invalidate:loans'  // Loans are user-scoped
    ],
    // Example with callback (commented - for demonstration)
    // 'auth:login': [
    //   (payload, { orchestrator }) => {
    //     console.log('[demo] User logged in:', payload.user.username)
    //   }
    // ]
  },
  pages: {
    login: () => import('./pages/LoginPage.vue'),
    layout: () => import('./pages/MainLayout.vue')
  },
  // Home page with welcome/presentation
  homeRoute: {
    name: 'home',
    component: () => import('./pages/WelcomePage.vue')
  },
  app: {
    name: 'Book Manager',
    shortName: 'Books',
    version
  },
  primevue: {
    plugin: PrimeVue,
    theme: Aura
  }
})

// Create and mount the app
// kernel.createApp() does all initialization, returns Vue app for mount()
const app = kernel.createApp()

// ============================================================================
// FEATURE DEMONSTRATIONS: Hooks and Zones
// ============================================================================
// These features require access to hooks/zones which are created during
// kernel.createApp(). Register them after createApp() but before mount().

// ---------- LIFECYCLE HOOKS ----------
// Demonstrate presave/postsave/predelete hooks for audit timestamps

/**
 * presave hook: Add/update audit timestamps
 * Called before create() and update()
 */
kernel.hooks.register('books:presave', (context) => {
  const { record, isNew } = context
  const now = new Date().toISOString()
  if (isNew) {
    record.created_at = now
  }
  record.updated_at = now
}, { priority: 50 })

/**
 * postsave hook: Log save operations
 * Called after create() and update()
 */
kernel.hooks.register('books:postsave', (context) => {
  const { result, isNew } = context
  console.log(`[demo] Book ${isNew ? 'created' : 'updated'}: ${result.title}`)
}, { priority: 50 })

/**
 * predelete hook: Log delete operations
 * Called before delete() - can throw to abort
 */
kernel.hooks.register('books:predelete', (context) => {
  console.log(`[demo] About to delete book ID: ${context.id}`)
}, { priority: 50 })

// ---------- ALTER HOOKS ----------
// Demonstrate list:alter and menu:alter hooks

/**
 * menu:alter hook: Add a custom nav item
 */
kernel.hooks.register('menu:alter', (context) => {
  // Find Library section and add a divider hint
  const librarySection = context.sections.find(s => s.title === 'Library')
  if (librarySection) {
    // Items already include Books, Loans, Genres from modules
    // This demonstrates that menu:alter can modify navigation
  }
  return context
}, { priority: 50 })

// ---------- ZONE REGISTRY ----------
// Zone blocks would typically be registered here for sidebar/footer content
// Example (uncomment to test):
// const zones = kernel.getZoneRegistry()
// zones.registerBlock('app:footer', {
//   id: 'demo-footer',
//   component: { template: '<div>Demo Footer Block</div>' },
//   weight: 50
// })

// Mount the app
app.mount('#app')
