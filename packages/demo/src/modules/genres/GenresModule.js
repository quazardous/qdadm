/**
 * Genres Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, storage)
 * - Routes (CRUD + child route for books by genre)
 * - Navigation
 *
 * Demonstrates child routes with parent entity filtering:
 * - /genres - List all genres
 * - /genres/:genreId/books - Books of a specific genre
 */

import { Module, MockApiStorage } from 'qdadm'

// ============================================================================
// STORAGE
// ============================================================================

import genresFixture from '../../fixtures/genres.json'

// Auth check imported from shared config
import { authCheck } from '../../config/storages'

const genresStorage = new MockApiStorage({
  entityName: 'genres',
  initialData: genresFixture,
  authCheck
})

// ============================================================================
// MODULE
// ============================================================================

export class GenresModule extends Module {
  static name = 'genres'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('genres', {
      name: 'genres',
      labelField: 'name',
      fields: {
        name: { type: 'text', label: 'Name', required: true, default: '' },
        description: { type: 'text', label: 'Description', default: '' }
      },
      children: {
        books: { entity: 'books', foreignKey: 'genre', label: 'Books' }
      },
      storage: genresStorage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('genres', {
      list: () => import('./pages/GenreList.vue'),
      form: () => import('./pages/GenreForm.vue')
    }, {
      nav: { section: 'Library', icon: 'pi pi-tags' }
    })

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
  }
}

export default GenresModule
