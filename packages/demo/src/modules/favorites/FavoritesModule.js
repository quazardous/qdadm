/**
 * Favorites Module - Module-Centric Pattern
 *
 * Declares the two entities qdadm's favourites and recents live in (#5349):
 * `favorites` (the star beside a page title, "Save this search") and
 * `recents` (the records opened lately). qdadm reads and writes them through
 * their managers; here they are kept in the browser.
 *
 * Demonstrates LocalStorage (persistent across browser sessions).
 */

import { Module, LocalStorage } from '@quazardous/qdadm'

// ============================================================================
// STORAGE
// ============================================================================

const favoritesStorage = new LocalStorage({ key: 'qdadm-demo-favorites' })
const recentsStorage = new LocalStorage({ key: 'qdadm-demo-recents' })

const KINDS = [
  { label: 'Record', value: 'item' },
  { label: 'List', value: 'list' },
  { label: 'Search', value: 'search' },
  { label: 'Board', value: 'board' },
]

// ============================================================================
// MODULE
// ============================================================================

export class FavoritesModule extends Module {
  static moduleName = 'favorites'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // I18N
    // ════════════════════════════════════════════════════════════════════════
    ctx.messages('en', {
      entities: {
        favorites: {
          label: 'Favorite',
          labelPlural: 'Favorites',
          fields: {
            label: 'Name',
            kind: { _label: 'Kind', options: { item: 'Record', list: 'List', search: 'Search', board: 'Board' } },
            entity: 'Entity',
            itemId: 'Record',
            to: 'Page',
            at: 'Added',
          },
        },
        recents: {
          label: 'Recent record',
          labelPlural: 'Recent records',
          fields: { label: 'Name', entity: 'Entity', itemId: 'Record', to: 'Page', at: 'Opened' },
        },
      },
      nav: {
        sections: { 'Local Storage': 'Local Storage' },
        routes: { favorite: 'Favorites' },
      },
    })
    ctx.messages('fr', {
      entities: {
        favorites: {
          label: 'Favori',
          labelPlural: 'Favoris',
          fields: {
            label: 'Nom',
            kind: { _label: 'Sorte', options: { item: 'Fiche', list: 'Liste', search: 'Recherche', board: 'Tableau' } },
            entity: 'Entité',
            itemId: 'Fiche',
            to: 'Page',
            at: 'Ajouté le',
          },
        },
        recents: {
          label: 'Fiche récente',
          labelPlural: 'Fiches récentes',
          fields: { label: 'Nom', entity: 'Entité', itemId: 'Fiche', to: 'Page', at: 'Ouverte le' },
        },
      },
      nav: {
        sections: { 'Local Storage': 'Stockage local' },
        routes: { favorite: 'Favoris' },
      },
    })

    // ════════════════════════════════════════════════════════════════════════
    // ENTITIES: the fields qdadm writes (#5349)
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('favorites', {
      name: 'favorites',
      labelField: 'label',
      fields: {
        id: { type: 'text', label: 'ID', readOnly: true },
        label: { type: 'text', label: 'Name', required: true, default: '' },
        kind: { type: 'select', label: 'Kind', required: true, default: 'item', options: KINDS },
        entity: { type: 'text', label: 'Entity', default: '' },
        // Not written by qdadm: the form's book picker fills it, then `to`
        itemId: { type: 'text', label: 'Record', default: '' },
        to: { type: 'text', label: 'Page', default: '' },
        at: { type: 'datetime', label: 'Added', readOnly: true },
      },
      storage: favoritesStorage,
    })

    ctx.entity('recents', {
      name: 'recents',
      labelField: 'label',
      fields: {
        id: { type: 'text', label: 'ID', readOnly: true },
        label: { type: 'text', label: 'Name' },
        entity: { type: 'text', label: 'Entity' },
        itemId: { type: 'text', label: 'Record' },
        to: { type: 'text', label: 'Page' },
        at: { type: 'datetime', label: 'Opened', readOnly: true },
      },
      storage: recentsStorage,
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('favorites', {
      list: () => import('./pages/FavoritesPage.vue'),
      form: () => import('./pages/FavoriteForm.vue')
    }, {
      nav: { section: 'Local Storage', icon: 'pi pi-bookmark' }
    })
  }
}

export default FavoritesModule
