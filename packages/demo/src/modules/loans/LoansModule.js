/**
 * Loans Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, storage, manager with enrichment)
 * - Routes (CRUD + child routes from books)
 * - Navigation
 * - Zone extensions (extends Books module zones)
 *
 * Cross-module dependencies:
 * - booksStorageInternal: for enriching book_title
 * - usersStorageInternal: for enriching username
 */

import { Module, EntityManager, MockApiStorage } from 'qdadm'
import { defineAsyncComponent } from 'vue'

// ============================================================================
// STORAGE
// ============================================================================

import loansFixture from '../../fixtures/loans.json'

// Auth check imported from shared config
import { authCheck } from '../../config/storages'

// Internal storages for enrichment (cross-module imports)
import { booksStorageInternal } from '../books/BooksModule'
import { usersStorageInternal } from '../users/UsersModule'

/**
 * Loans storage with searchFields capability
 */
class LoansStorage extends MockApiStorage {
  static capabilities = {
    ...MockApiStorage.capabilities,
    searchFields: ['book.title', 'user.username']
  }
}

const loansStorage = new LoansStorage({
  entityName: 'loans',
  initialData: loansFixture,
  authCheck
})

// ============================================================================
// ENTITY MANAGER
// ============================================================================

/**
 * LoansManager - Ownership-based access + enrichment pattern
 *
 * - Admin sees all loans
 * - Regular user sees only their own loans
 * - Enrichment: adds book_title and username from related entities
 */
class LoansManager extends EntityManager {
  _isAdmin() {
    const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
    return user?.role === 'ROLE_ADMIN'
  }

  _isOwner(loan) {
    if (!loan) return true
    const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
    return loan.user_id === user?.id
  }

  async list(params = {}) {
    if (!this._isAdmin()) {
      const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
      params.filters = params.filters || {}
      params.filters.user_id = user?.id
      params.cacheSafe = true
    }
    return super.list(params)
  }

  async _enrichLoan(data) {
    if (data.book_id) {
      const book = await booksStorageInternal.get(data.book_id)
      data.book_title = book?.title || '?'
    }
    if (data.user_id) {
      const user = await usersStorageInternal.get(data.user_id)
      data.username = user?.username || '?'
    }
  }

  async get(id) {
    const data = await this.storage.get(id)
    if (data) await this._enrichLoan(data)
    return data
  }

  async create(data) {
    if (!this._isAdmin()) {
      const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
      data.user_id = user?.id
    }
    await this._enrichLoan(data)
    return this.storage.create(data)
  }

  async update(id, data) {
    await this._enrichLoan(data)
    return this.storage.update(id, data)
  }

  canRead(loan = null) {
    return this._isAdmin() || this._isOwner(loan)
  }

  canCreate() { return true }

  canUpdate(loan = null) {
    return this._isAdmin() || this._isOwner(loan)
  }

  canDelete(loan = null) {
    return this._isAdmin() || this._isOwner(loan)
  }
}

// ============================================================================
// ZONE EXTENSION COMPONENTS
// ============================================================================

const LoanAwareBooksHeader = defineAsyncComponent(() => import('./components/LoanAwareBooksHeader.vue'))
const LoanStatusColumn = defineAsyncComponent(() => import('./components/LoanStatusColumn.vue'))
const AvailabilityWrapper = defineAsyncComponent(() => import('./components/AvailabilityWrapper.vue'))

// ============================================================================
// MODULE
// ============================================================================

export class LoansModule extends Module {
  static name = 'loans'
  static requires = ['books', 'users']  // Dependencies for enrichment + zone extension
  static priority = 10  // Load after books

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('loans', new LoansManager({
      name: 'loans',
      parents: {
        book: { entity: 'books', foreignKey: 'book_id' },
        user: { entity: 'users', foreignKey: 'user_id' }
      },
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
    }))

    // ════════════════════════════════════════════════════════════════════════
    // ZONE EXTENSIONS (extends Books module zones)
    // ════════════════════════════════════════════════════════════════════════
    ctx
      // REPLACE: Substitute Books header with loan-aware version
      .block('books-list-header', {
        id: 'loans-header-replacement',
        component: LoanAwareBooksHeader,
        weight: 60,
        operation: 'replace',
        replaces: 'books-header'
      })
      // EXTEND: Add overdue warning after header
      .block('books-list-header', {
        id: 'loans-status-extension',
        component: LoanStatusColumn,
        weight: 70,
        operation: 'extend',
        after: 'loans-header-replacement'
      })
      // WRAP: Decorate book detail with availability info
      .block('books-detail-content', {
        id: 'loans-availability-wrapper',
        component: AvailabilityWrapper,
        weight: 80,
        operation: 'wrap',
        wraps: 'books-detail'
      })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('loans', {
      list: () => import('./pages/LoanList.vue'),
      form: () => import('./pages/LoanForm.vue')
    }, {
      nav: { section: 'Library', icon: 'pi pi-arrow-right-arrow-left' }
    })
  }
}

export default LoansModule
