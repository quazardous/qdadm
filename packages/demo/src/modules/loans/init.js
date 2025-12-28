/**
 * Loans Module
 *
 * Book loans with user relationship.
 * Entity (loans) is defined in main.js with EntityManager.
 *
 * CROSS-MODULE ZONE EXTENSION
 * ===========================
 * Demonstrates extending zones defined by another module (Books)
 * without modifying the original module's code.
 */

import { defineAsyncComponent } from 'vue'

// Lazy-load components to avoid composable calls before Vue app exists
const LoanAwareBooksHeader = defineAsyncComponent(() => import('./components/LoanAwareBooksHeader.vue'))
const LoanStatusColumn = defineAsyncComponent(() => import('./components/LoanStatusColumn.vue'))
const AvailabilityWrapper = defineAsyncComponent(() => import('./components/AvailabilityWrapper.vue'))

export function init({ registry, zones }) {

  // ============ ZONE EXTENSIONS ============
  // Extend Books module zones to add loan-related UI

  // REPLACE: Substitute Books header with loan-aware version
  zones.registerBlock('books-list-header', {
    id: 'loans-header-replacement',
    component: LoanAwareBooksHeader,
    weight: 60,
    operation: 'replace',
    replaces: 'books-header'
  })

  // EXTEND: Add overdue warning after header
  zones.registerBlock('books-list-header', {
    id: 'loans-status-extension',
    component: LoanStatusColumn,
    weight: 70,
    operation: 'extend',
    after: 'loans-header-replacement'
  })

  // WRAP: Decorate book detail with availability info
  zones.registerBlock('books-detail-content', {
    id: 'loans-availability-wrapper',
    component: AvailabilityWrapper,
    weight: 80,
    operation: 'wrap',
    wraps: 'books-detail'
  })

  // ============ ROUTES ============
  registry.addRoutes('loans', [
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

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'Library',
    route: 'loan',
    icon: 'pi pi-arrow-right-arrow-left',
    label: 'Loans'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('loan', ['loan-'])
}
