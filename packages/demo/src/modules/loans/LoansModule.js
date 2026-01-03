/**
 * Loans Module - Module System v2 Implementation
 *
 * Class-based module demonstrating qdadm Module System v2 pattern
 * with CROSS-MODULE ZONE EXTENSION capabilities:
 * - replace: substitute existing blocks
 * - extend: add blocks relative to others
 * - wrap: decorate existing blocks
 *
 * Note: Entity (loans) is defined in main.js with EntityManager
 */

import { Module } from 'qdadm'
import { defineAsyncComponent } from 'vue'

// Lazy-load components to avoid composable calls before Vue app exists
const LoanAwareBooksHeader = defineAsyncComponent(() => import('./components/LoanAwareBooksHeader.vue'))
const LoanStatusColumn = defineAsyncComponent(() => import('./components/LoanStatusColumn.vue'))
const AvailabilityWrapper = defineAsyncComponent(() => import('./components/AvailabilityWrapper.vue'))

export class LoansModule extends Module {
  static name = 'loans'
  static requires = ['books'] // Depends on books module for zone extension
  static priority = 10 // Load after books

  async connect(ctx) {
    // Zone extensions - extend Books module zones
    // REPLACE: Substitute Books header with loan-aware version
    // EXTEND: Add overdue warning after header
    // WRAP: Decorate book detail with availability info
    ctx
      .block('books-list-header', {
        id: 'loans-header-replacement',
        component: LoanAwareBooksHeader,
        weight: 60,
        operation: 'replace',
        replaces: 'books-header'
      })
      .block('books-list-header', {
        id: 'loans-status-extension',
        component: LoanStatusColumn,
        weight: 70,
        operation: 'extend',
        after: 'loans-header-replacement'
      })
      .block('books-detail-content', {
        id: 'loans-availability-wrapper',
        component: AvailabilityWrapper,
        weight: 80,
        operation: 'wrap',
        wraps: 'books-detail'
      })

    // Routes
    ctx.routes('loans', [
      {
        path: '',
        name: 'loan',
        component: () => import('./pages/LoanList.vue')
      },
      {
        path: 'create',
        name: 'loan-create',
        component: () => import('./pages/LoanForm.vue')
      },
      {
        path: ':id/edit',
        name: 'loan-edit',
        component: () => import('./pages/LoanForm.vue')
      }
    ], { entity: 'loans' })

    // Navigation
    ctx.navItem({
      section: 'Library',
      route: 'loan',
      icon: 'pi pi-arrow-right-arrow-left',
      label: 'Loans'
    })

    // Route family - maps 'loan' to all 'loan-*' routes for active state in nav
    ctx.routeFamily('loan', ['loan-'])
  }
}

export default LoansModule
