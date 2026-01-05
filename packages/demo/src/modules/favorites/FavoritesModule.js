/**
 * Favorites Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, storage)
 * - Routes (CRUD)
 * - Navigation
 *
 * Demonstrates LocalStorage (persistent across browser sessions).
 */

import { Module, LocalStorage } from 'qdadm'

// ============================================================================
// STORAGE
// ============================================================================

const favoritesStorage = new LocalStorage({
  key: 'qdadm-demo-favorites'
})

// ============================================================================
// MODULE
// ============================================================================

export class FavoritesModule extends Module {
  static name = 'favorites'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('favorites', {
      name: 'favorites',
      labelField: 'name',
      fields: {
        id: { type: 'text', label: 'ID', readOnly: true },
        name: { type: 'text', label: 'Name', required: true, default: '' },
        entityType: {
          type: 'select',
          label: 'Type',
          required: true,
          default: 'book',
          options: [
            { label: 'Book', value: 'book' },
            { label: 'User', value: 'user' },
            { label: 'Genre', value: 'genre' },
            { label: 'Loan', value: 'loan' }
          ]
        },
        entityId: { type: 'text', label: 'Entity ID', required: true, default: '' },
        createdAt: { type: 'datetime', label: 'Created At', readOnly: true }
      },
      storage: favoritesStorage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('favorites', {
      list: () => import('./pages/FavoritesPage.vue'),
      form: () => import('./pages/FavoriteForm.vue')
    }, {
      nav: { section: 'Local Storage', icon: 'pi pi-star' }
    })
  }
}

export default FavoritesModule
