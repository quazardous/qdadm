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
  registry.addRoutes('books', [
    {
      path: '',
      name: 'book',  // routePrefix from EntityManager
      component: () => import('./pages/BookList.vue')
    },
    {
      path: 'create',
      name: 'book-create',
      component: () => import('./pages/BookForm.vue')
    },
    {
      path: ':id/edit',
      name: 'book-edit',
      component: () => import('./pages/BookForm.vue')
    }
  ])

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
