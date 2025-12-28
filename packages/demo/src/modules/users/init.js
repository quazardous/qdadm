/**
 * Users Module
 *
 * User management with LocalStorage.
 * Entity (users) is defined in main.js with EntityManager.
 */

export function init({ registry }) {

  // ============ ROUTES ============
  registry.addRoutes('users', [
    {
      path: '',
      name: 'user',
      component: () => import('./pages/UserList.vue')
    },
    {
      path: 'create',
      name: 'user-create',
      component: () => import('./pages/UserForm.vue')
    },
    {
      path: ':id/edit',
      name: 'user-edit',
      component: () => import('./pages/UserForm.vue')
    }
  ], { entity: 'users' })

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'Administration',
    route: 'user',
    icon: 'pi pi-users',
    label: 'Users',
    entity: 'users'  // For permission checking
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('user', ['user-'])
}
