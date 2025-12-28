/**
 * Books Module
 *
 * Demonstrates qdadm module pattern:
 * - Route registration
 * - Navigation registration
 * - Zone registration
 *
 * Note: Entity (books) is defined in main.js with EntityManager
 */

import { defineAsyncComponent } from 'vue'

// Lazy-load components to avoid useOrchestrator() being called before Vue app exists
const BooksListHeader = defineAsyncComponent(() => import('./components/BooksListHeader.vue'))
const BooksDetailPanel = defineAsyncComponent(() => import('./components/BooksDetailPanel.vue'))

export function init({ registry, zones }) {

  // ============ ZONES ============
  // Define zones owned by Books module
  // Other modules can use replace/extend/wrap operations on these zones
  zones.defineZone('books-list-header')
  zones.defineZone('books-detail-content')

  // Register default blocks (with IDs so other modules can target them)
  zones.registerBlock('books-list-header', {
    id: 'books-header',
    component: BooksListHeader,
    weight: 50
  })

  zones.registerBlock('books-detail-content', {
    id: 'books-detail',
    component: BooksDetailPanel,
    weight: 50
  })

  // ============ ROUTES ============
  // Layout is auto-detected from route names (-create, -edit suffixes)
  // or can be explicitly set via route meta: { meta: { layout: 'list' } }
  registry.addRoutes('books', [
    {
      path: '',
      name: 'book',  // routePrefix from EntityManager
      component: () => import('./pages/BookList.vue'),
      meta: { layout: 'list' }  // Explicit layout for list page (route name has no suffix)
    },
    {
      path: 'create',
      name: 'book-create',  // Auto-detected as 'form' layout from -create suffix
      component: () => import('./pages/BookCreate.vue')
    },
    {
      path: ':id/edit',
      name: 'book-edit',  // Auto-detected as 'form' layout from -edit suffix
      component: () => import('./pages/BookEdit.vue')
    }
  ], { entity: 'books' })

  // Child route: loans for a specific book
  registry.addRoutes('books/:bookId/loans', [
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

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'Library',
    route: 'book',
    icon: 'pi pi-book',
    label: 'Books'
  })

  // ============ ROUTE FAMILY ============
  // Maps 'book' to all 'book-*' routes for active state in nav
  registry.addRouteFamily('book', ['book-'])
}
