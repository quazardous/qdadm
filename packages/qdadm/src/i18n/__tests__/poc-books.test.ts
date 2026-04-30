/**
 * POC smoke test — mirrors the messages BooksModule pushes into ctx.messages().
 * Validates that the conventional keys resolve correctly for FR and EN, and
 * that the global strategy aliases route core actions/fields properly.
 */

import { describe, it, expect } from 'vitest'

import { I18n } from '../I18n'
import type { MessagesBundle } from '../types'

const booksEn: MessagesBundle = {
  entities: {
    books: {
      label: 'Book',
      labelPlural: 'Books',
      fields: {
        title: 'Title',
        author: 'Author',
        year: 'Year',
        genre: {
          _label: 'Genre',
          options: {
            fiction: 'Fiction',
            'non-fiction': 'Non-Fiction',
            'sci-fi': 'Sci-Fi',
            fantasy: 'Fantasy',
            mystery: 'Mystery',
          },
        },
      },
    },
    genres: {
      label: 'Genre',
      labelPlural: 'Genres',
      fields: { name: 'Name', description: 'Description' },
    },
  },
  nav: {
    sections: { Library: 'Library' },
    routes: { 'book-stats': 'Stats' },
  },
}

const booksFr: MessagesBundle = {
  entities: {
    books: {
      label: 'Livre',
      labelPlural: 'Livres',
      fields: {
        title: 'Titre',
        author: 'Auteur',
        year: 'Année',
        genre: {
          _label: 'Genre',
          options: {
            fiction: 'Fiction',
            'non-fiction': 'Documentaire',
            'sci-fi': 'Science-fiction',
            fantasy: 'Fantastique',
            mystery: 'Mystère',
          },
        },
      },
    },
    genres: {
      label: 'Genre',
      labelPlural: 'Genres',
      fields: { name: 'Nom', description: 'Description' },
    },
  },
  core: {
    actions: { save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer' },
    fields: { id: 'Identifiant', created_at: 'Créé le' },
    errors: { required: 'Requis' },
  },
  nav: {
    sections: { Library: 'Bibliothèque' },
    routes: { 'book-stats': 'Statistiques' },
  },
}

describe('POC — books module messages', () => {
  it('resolves entity, fields and option labels in EN (default)', async () => {
    const i18n = new I18n({ defaultLocale: 'en' })
    i18n.addMessages('en', booksEn)
    await i18n.bootstrap()

    expect(i18n.t('entities.books.label')).toBe('Book')
    expect(i18n.t('entities.books.labelPlural')).toBe('Books')
    expect(i18n.t('entities.books.fields.title')).toBe('Title')
    expect(i18n.t('entities.books.fields.author')).toBe('Author')
    expect(i18n.t('entities.books.fields.genre')).toBe('Genre')
    expect(i18n.t('entities.books.fields.genre.options.fiction')).toBe('Fiction')
    expect(i18n.t('entities.books.fields.genre.options.non-fiction')).toBe('Non-Fiction')
    expect(i18n.t('nav.sections.Library')).toBe('Library')
    expect(i18n.t('nav.routes.book-stats')).toBe('Stats')
  })

  it('resolves to FR after locale switch and falls back to EN for missing keys', async () => {
    const i18n = new I18n({ defaultLocale: 'en', fallbackLocale: 'en' })
    i18n.addMessages('en', booksEn)
    i18n.addMessages('fr', booksFr)
    await i18n.bootstrap()
    await i18n.changeLocale('fr')

    expect(i18n.t('entities.books.label')).toBe('Livre')
    expect(i18n.t('entities.books.fields.title')).toBe('Titre')
    expect(i18n.t('entities.books.fields.genre.options.fantasy')).toBe('Fantastique')
    expect(i18n.t('nav.sections.Library')).toBe('Bibliothèque')
    expect(i18n.t('nav.routes.book-stats')).toBe('Statistiques')

    // genres.fields.description not declared in FR → falls back to EN
    expect(i18n.t('entities.genres.fields.description')).toBe('Description')
  })

  it('global strategy aliases route core action keys for any entity', async () => {
    const i18n = new I18n()
    i18n.addMessages('en', booksEn)
    i18n.addMessages('fr', booksFr)
    await i18n.bootstrap()

    expect(i18n.t('entities.books.actions.save')).toBe('Save')
    expect(i18n.t('entities.genres.actions.delete')).toBe('Delete')

    await i18n.changeLocale('fr')
    expect(i18n.t('entities.books.actions.save')).toBe('Enregistrer')
    expect(i18n.t('entities.genres.actions.cancel')).toBe('Annuler')
  })

  it('global strategy aliases route timestamp fields too', async () => {
    const i18n = new I18n()
    i18n.addMessages('fr', booksFr)
    await i18n.bootstrap()
    await i18n.changeLocale('fr')

    expect(i18n.t('entities.books.fields.id')).toBe('Identifiant')
    expect(i18n.t('entities.books.fields.created_at')).toBe('Créé le')
    // updated_at not declared in fr.core → falls back to en core defaults
    expect(i18n.t('entities.books.fields.updated_at')).toBe('Updated at')
  })

  it('snakeCaseToTitle still rescues unknown fields without breaking prototyping', async () => {
    const i18n = new I18n()
    i18n.addMessages('en', booksEn)
    await i18n.bootstrap()
    expect(i18n.t('entities.books.fields.published_at')).toBe('Published At')
  })
})
