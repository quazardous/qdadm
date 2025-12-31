/**
 * Favorites Module - LocalStorage Demo
 *
 * Demonstrates qdadm LocalStorage adapter for browser-local persistence.
 * Data survives page refresh and browser sessions.
 *
 * Features:
 * - Pure LocalStorage (no network calls)
 * - CRUD operations on favorites
 * - Filter by entity type
 * - Persists across browser sessions
 */

export function init({ registry }) {

  // ============ ROUTES ============
  registry.addRoutes('favorites', [
    {
      path: '',
      name: 'favorite',
      component: () => import('./pages/FavoritesPage.vue'),
      meta: { layout: 'list' }
    },
    {
      path: 'create',
      name: 'favorite-create',
      component: () => import('./pages/FavoriteForm.vue')
    },
    {
      path: ':id/edit',
      name: 'favorite-edit',
      component: () => import('./pages/FavoriteForm.vue')
    }
  ], { entity: 'favorites' })

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'Local Storage',
    route: 'favorite',
    icon: 'pi pi-star',
    label: 'Favorites'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('favorite', ['favorite-'])
}
