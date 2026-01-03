/**
 * Genres Module (v2)
 *
 * Demonstrates child routes with parent entity filtering:
 * - /genres - List all genres
 * - /genres/:genreId/books - Books of a specific genre
 */

import { Module } from 'qdadm'

export class GenresModule extends Module {
  static name = 'genres'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ============ ROUTES ============
    ctx.routes('genres', [
      {
        path: '',
        name: 'genre',
        component: () => import('./pages/GenreList.vue'),
        meta: { layout: 'list' }
      },
      {
        path: 'create',
        name: 'genre-create',
        component: () => import('./pages/GenreForm.vue')
      },
      {
        path: ':id/edit',
        name: 'genre-edit',
        component: () => import('./pages/GenreForm.vue')
      }
    ], { entity: 'genres' })

    // Child route: books for a specific genre
    ctx.routes('genres/:genreId/books', [
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
    ctx.navItem({
      section: 'Library',
      route: 'genre',
      icon: 'pi pi-tags',
      label: 'Genres'
    })

    // ============ ROUTE FAMILY ============
    ctx.routeFamily('genre', ['genre-'])
  }
}

export default GenresModule
