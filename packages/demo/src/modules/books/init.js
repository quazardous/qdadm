/**
 * Books Module
 *
 * Demonstrates qdadm module pattern:
 * - Route registration
 * - Navigation registration
 *
 * Note: Entity (books) is defined in main.js with EntityManager
 */

export function init(registry) {

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
