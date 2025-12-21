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
 * 4. FIXTURE SEEDING
 *    - JSON fixtures in ./fixtures/ folder
 *    - Seed to localStorage if empty on first load
 */

import { Kernel, EntityManager, LocalStorage } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { version } from '../package.json'
import { authAdapter } from './adapters/authAdapter'

// Fixtures for initial data (seeded to localStorage on first load)
import usersFixture from './fixtures/users.json'
import booksFixture from './fixtures/books.json'
import loansFixture from './fixtures/loans.json'
import genresFixture from './fixtures/genres.json'

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
  { label: 'Admin', value: 'admin' },
  { label: 'User', value: 'user' }
]

// ============================================================================
// STORAGE INSTANCES
// ============================================================================
// LocalStorage wraps browser localStorage with CRUD operations.
// Each entity gets its own storage instance with a unique key.

const usersStorage = new LocalStorage({ key: 'qdadm_demo_users' })
const booksStorage = new LocalStorage({ key: 'qdadm_demo_books' })
const loansStorage = new LocalStorage({ key: 'qdadm_demo_loans' })
const genresStorage = new LocalStorage({ key: 'qdadm_demo_genres' })

// ============================================================================
// FIXTURE SEEDING
// ============================================================================
// On first load, seed fixtures to localStorage if empty.
// This provides initial demo data without a backend.

function seedIfEmpty(storage, fixture) {
  const key = storage.key
  if (!key) return
  const existing = localStorage.getItem(key)
  if (!existing || existing === '[]') {
    localStorage.setItem(key, JSON.stringify(fixture))
    console.log(`[demo] Seeded ${fixture.length} items to ${key}`)
  }
}

seedIfEmpty(usersStorage, usersFixture)
seedIfEmpty(booksStorage, booksFixture)
seedIfEmpty(loansStorage, loansFixture)
seedIfEmpty(genresStorage, genresFixture)

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
    return authAdapter.getUser()?.role === 'admin'
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
    return authAdapter.getUser()?.role === 'admin'
  }
}

/**
 * LoansManager - Ownership-based access
 *
 * Demonstrates row-level permissions:
 * - Admin sees all loans
 * - Regular user only sees their own loans
 *
 * Pattern:
 *   1. Override list() to filter by user_id
 *   2. Override canRead/canUpdate/canDelete with entity parameter
 *   3. Check ownership when entity is provided
 */
class LoansManager extends EntityManager {
  /**
   * Check if current user is admin
   */
  _isAdmin() {
    return authAdapter.getUser()?.role === 'admin'
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

  /**
   * Override create() to enforce user_id for non-admin
   */
  async create(data) {
    if (!this._isAdmin()) {
      data.user_id = authAdapter.getUser()?.id
    }
    return this.storage.create(data)
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
// Each entity is defined with:
//   - name: Internal identifier (used in modules)
//   - label/labelPlural: Display names
//   - routePrefix: Used for route names (e.g., 'book' -> 'book-create', 'book-edit')
//   - labelField: Field to use as entity label (string or callback)
//   - fields: Field definitions for forms (type, label, default, options, required)
//   - storage: Storage adapter (LocalStorage, ApiAdapter, etc.)

const managers = {
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
    // labelField can be a callback for complex labels
    labelField: (loan) => `Loan #${loan.id?.slice(-6) || 'new'}`,
    fields: {
      book_id: { type: 'text', label: 'Book', required: true, default: '' },
      user_id: { type: 'text', label: 'User', required: true, default: '' },
      borrowed_at: { type: 'datetime', label: 'Borrowed At', default: () => new Date().toISOString() },
      returned_at: { type: 'datetime', label: 'Returned At', default: null },
      read: { type: 'boolean', label: 'Read?', default: false }
    },
    storage: loansStorage
  }),

  genres: new EntityManager({
    name: 'genres',
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
    storage: genresStorage
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
  // Auto-discover modules from ./modules/*/init.js
  // Each module exports init(registry) function
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  // Navigation sections order
  sectionOrder: ['Library', 'Administration'],
  managers,
  authAdapter,
  pages: {
    login: () => import('./pages/LoginPage.vue'),
    layout: () => import('./pages/MainLayout.vue')
  },
  // Redirect to this route after login
  homeRoute: 'book',
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
kernel.createApp().mount('#app')
