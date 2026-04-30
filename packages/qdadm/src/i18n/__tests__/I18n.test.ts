import { describe, it, expect } from 'vitest'

import { I18n } from '../I18n'
import type { TranslationProvider } from '../types'

describe('I18n — bootstrap and lookup', () => {
  it('ships default core EN bundle', async () => {
    const i18n = new I18n()
    await i18n.bootstrap()
    expect(i18n.t('core.actions.save')).toBe('Save')
    expect(i18n.t('core.errors.required')).toBe('Required')
  })

  it('disableDefaultCoreBundle skips default core', async () => {
    const i18n = new I18n({ disableDefaultCoreBundle: true })
    await i18n.bootstrap()
    expect(i18n.t('core.actions.save')).toBe('core.actions.save')
  })

  it('addMessages from kernel options', async () => {
    const i18n = new I18n({
      messages: {
        en: { entities: { books: { fields: { title: 'Title' } } } },
      },
    })
    await i18n.bootstrap()
    expect(i18n.t('entities.books.fields.title')).toBe('Title')
  })

  it('addMessages after bootstrap is immediately visible', async () => {
    const i18n = new I18n()
    await i18n.bootstrap()
    i18n.addMessages('en', { entities: { books: { fields: { author: 'Author' } } } })
    expect(i18n.t('entities.books.fields.author')).toBe('Author')
  })
})

describe('I18n — global strategy (default)', () => {
  it('routes entities.*.actions.* to core.actions.*', async () => {
    const i18n = new I18n()
    await i18n.bootstrap()
    expect(i18n.t('entities.books.actions.save')).toBe('Save')
    expect(i18n.t('entities.users.actions.delete')).toBe('Delete')
  })

  it('routes entities.*.fields.created_at to core.fields.created_at', async () => {
    const i18n = new I18n()
    await i18n.bootstrap()
    expect(i18n.t('entities.books.fields.created_at')).toBe('Created at')
  })
})

describe('I18n — module strategy', () => {
  it('routes entities.<entity>.* to modules.<module>.* with fallback to core', async () => {
    const i18n = new I18n({ keyStrategy: 'module' })
    i18n.registerEntityModule('books', 'BooksModule')
    await i18n.bootstrap()
    i18n.addMessages('en', {
      modules: {
        BooksModule: { actions: { delete: 'Discard' } },
      },
    })
    // Module override wins
    expect(i18n.t('entities.books.actions.delete')).toBe('Discard')
    // Fallback through module → core
    expect(i18n.t('entities.books.actions.save')).toBe('Save')
  })
})

describe('I18n — locale change', () => {
  it('emits locale:changed signal', async () => {
    const events: Array<{ signal: string; data: unknown }> = []
    const signals = {
      emit: (signal: string, data: unknown) => {
        events.push({ signal, data })
      },
      on: () => () => {},
    }
    const i18n = new I18n({ defaultLocale: 'en' }, { signals })
    await i18n.bootstrap()
    i18n.addMessages('fr', { core: { actions: { save: 'Enregistrer' } } })
    await i18n.changeLocale('fr')
    expect(i18n.locale.value).toBe('fr')
    expect(i18n.t('core.actions.save')).toBe('Enregistrer')
    const emitted = events.find((e) => e.signal === 'locale:changed')
    expect(emitted).toBeDefined()
    expect(emitted?.data).toBe('fr')
  })

  it('falls back to fallbackLocale for missing keys', async () => {
    const i18n = new I18n({ defaultLocale: 'en', fallbackLocale: 'en' })
    await i18n.bootstrap()
    i18n.addMessages('fr', { entities: { books: { fields: { title: 'Titre' } } } })
    await i18n.changeLocale('fr')
    expect(i18n.t('entities.books.fields.title')).toBe('Titre')
    // 'core.actions.save' not declared in fr → falls back to en
    expect(i18n.t('core.actions.save')).toBe('Save')
  })
})

describe('I18n — providers', () => {
  it('loads from a custom TranslationProvider during bootstrap', async () => {
    const provider: TranslationProvider = {
      name: 'mock',
      load: (locale) => {
        if (locale === 'en') {
          return { entities: { tasks: { fields: { name: 'Task name' } } } }
        }
        return {}
      },
      availableLocales: () => ['en'],
    }
    const i18n = new I18n({ providers: [provider] })
    await i18n.bootstrap()
    expect(i18n.t('entities.tasks.fields.name')).toBe('Task name')
  })

  it('async provider load works', async () => {
    const provider: TranslationProvider = {
      name: 'async-mock',
      load: async (locale) => {
        await new Promise((r) => setTimeout(r, 5))
        if (locale === 'en') {
          return { foo: { bar: 'Async value' } }
        }
        return {}
      },
    }
    const i18n = new I18n({ providers: [provider] })
    await i18n.bootstrap()
    expect(i18n.t('foo.bar')).toBe('Async value')
  })

  it('availableLocales unions across providers', async () => {
    const a: TranslationProvider = {
      name: 'a',
      load: () => ({}),
      availableLocales: () => ['en', 'fr'],
    }
    const b: TranslationProvider = {
      name: 'b',
      load: () => ({}),
      availableLocales: async () => ['de', 'fr'],
    }
    const i18n = new I18n({ providers: [a, b] })
    const locales = await i18n.availableLocales()
    expect(new Set(locales)).toEqual(new Set(['en', 'fr', 'de']))
  })
})

describe('I18n — dump', () => {
  it('returns the merged inline bundle', async () => {
    const i18n = new I18n()
    await i18n.bootstrap()
    i18n.addMessages('en', { entities: { books: { fields: { title: 'Title' } } } })
    const dumped = i18n.dump('en')
    expect(dumped.core).toBeDefined()
    expect(dumped.entities?.books?.fields?.title).toBe('Title')
  })
})
