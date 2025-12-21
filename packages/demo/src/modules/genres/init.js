/**
 * Genres Module
 *
 * Demonstrates child routes with parent entity filtering:
 * - /genres - List all genres
 * - /genres/:genreId/books - Books of a specific genre
 */

export function init(registry) {

  // ============ ROUTES ============
  registry.addRoutes('genres', [
    {
      path: '',
      name: 'genre',
      component: () => import('./pages/GenreList.vue')
    },
    {
      path: ':id/edit',
      name: 'genre-edit',
      component: () => import('./pages/GenreForm.vue')
    }
  ], { entity: 'genres' })

  // Child route: books for a specific genre
  registry.addRoutes('genres/:genreId/books', [
    {
      path: '',
      name: 'genre-books',
      component: () => import('./pages/GenreBooks.vue')
    }
  ], {
    entity: 'books',
    parent: {
      entity: 'genres',
      param: 'genreId',
      foreignKey: 'genre'
    },
    label: 'Books'
  })

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'Library',
    route: 'genre',
    icon: 'pi pi-tags',
    label: 'Genres'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('genre', ['genre-'])
}
