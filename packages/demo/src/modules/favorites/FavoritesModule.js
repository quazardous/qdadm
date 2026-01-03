/**
 * Favorites Module (v2) - LocalStorage Demo
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

import { Module } from 'qdadm'

export class FavoritesModule extends Module {
  static name = 'favorites'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ============ ROUTES ============
    ctx.routes('favorites', [
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
    ctx.navItem({
      section: 'Local Storage',
      route: 'favorite',
      icon: 'pi pi-star',
      label: 'Favorites'
    })

    // ============ ROUTE FAMILY ============
    ctx.routeFamily('favorite', ['favorite-'])
  }
}

export default FavoritesModule
