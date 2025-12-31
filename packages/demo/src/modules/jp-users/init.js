/**
 * JSONPlaceholder Users Module
 *
 * Showcases qdadm with external API (JSONPlaceholder).
 * Routes point to standalone pages in src/pages/.
 */

export function init({ registry }) {

  // ============ ROUTES ============
  // Register routes for JSONPlaceholder users
  // Route names follow EntityManager.routePrefix convention (jp_user)
  registry.addRoutes('jp-users', [
    {
      path: '',
      name: 'jp_user',
      component: () => import('../../pages/JpUsersPage.vue'),
      meta: { layout: 'list' }
    },
    {
      path: ':id',
      name: 'jp_user-show',
      component: () => import('../../pages/JpUserDetailPage.vue'),
      meta: { layout: 'form' }
    }
  ])

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'JSONPlaceholder',
    route: 'jp_user',
    icon: 'pi pi-users',
    label: 'Users'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('jp_user', ['jp_user-'])
}
