/**
 * Posts Module - JSONPlaceholder Integration
 *
 * Posts listing with user relationship.
 * Features:
 * - Filter by userId (query param ?userId=X)
 * - Link to author user detail
 * - View full post detail
 */

export function init({ registry }) {

  // ============ ROUTES ============
  registry.addRoutes('posts', [
    {
      path: '',
      name: 'post',
      component: () => import('./pages/PostsPage.vue'),
      meta: { layout: 'list' }
    },
    {
      path: ':id',
      name: 'post-show',
      component: () => import('./pages/PostDetailPage.vue'),
      meta: { layout: 'form' }
    }
  ], { entity: 'posts' })

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'JSONPlaceholder',
    route: 'post',
    icon: 'pi pi-file-edit',
    label: 'Posts'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('post', ['post-'])
}
