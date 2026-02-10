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

import { Module, EntityManager, MockApiStorage, useNotifications } from 'qdadm'
import { defineAsyncComponent, defineComponent, h, onMounted } from 'vue'

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
 * LoansManager - Enrichment pattern
 *
 * Enrichment: adds book_title and username from related entities
 */
class LoansManager extends EntityManager {
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
    await this._enrichLoan(data)
    return super.create(data)
  }

  async update(id, data) {
    await this._enrichLoan(data)
    return super.update(id, data)
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
        book_id: { type: 'select', label: 'Book', required: true, default: '', reference: { entity: 'books', labelField: 'title' } },
        user_id: { type: 'select', label: 'Borrower', required: true, default: '', reference: { entity: 'users', labelField: 'username' } },
        borrowed_at: { type: 'datetime', label: 'Borrowed At', default: () => new Date().toISOString() },
        returned_at: { type: 'datetime', label: 'Returned At', default: null },
        read: { type: 'boolean', label: 'Read?', default: false }
      },
      storage: loansStorage,
      // Ownership: user owns their own loans
      // Enables entity-own:loans:* permission checks
      isOwn: (record, user) => record?.user_id === user?.id
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

    // ════════════════════════════════════════════════════════════════════════
    // NOTIFICATION STATUS: overdue loans
    // ════════════════════════════════════════════════════════════════════════
    const OverdueLoanStatus = defineComponent({
      name: 'OverdueLoanStatus',
      setup() {
        // Must call useNotifications() synchronously in setup() for inject() to work
        const notifications = useNotifications()

        onMounted(async () => {
          try {
            // Count loans borrowed > 14 days ago and not returned
            const { items } = await loansStorage.list({ page_size: 1000 })
            const twoWeeksAgo = new Date()
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
            const overdueCount = items.filter(loan => {
              if (loan.returned_at) return false
              return new Date(loan.borrowed_at) < twoWeeksAgo
            }).length
            if (overdueCount > 0) {
              notifications.registerStatus({
                id: 'overdue-loans',
                label: `${overdueCount} loan(s) overdue`,
                severity: 'warn',
                count: overdueCount,
                icon: 'pi pi-clock',
                to: { name: 'loan' }
              })
            }
          } catch {
            // Notifications module may not be loaded
          }
        })
        return () => h('span', { style: 'display:none' })
      }
    })

    ctx.block('_app:notification-status', {
      id: 'loans-overdue-status',
      component: OverdueLoanStatus,
      weight: 10
    })
  }
}

export default LoansModule
