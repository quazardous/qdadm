/**
 * Loans Module
 *
 * Book loans with user relationship.
 * Entity (loans) is defined in main.js with EntityManager.
 */

export function init(registry) {

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
  ])

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
