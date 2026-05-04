import { describe, it, expect } from 'vitest'

import { I18n } from '../I18n'
import { LazyTranslationProvider, type LazyLoader } from '../LazyTranslationProvider'

describe('LazyTranslationProvider — domain cascade', () => {
  it('merges partial bundles from multiple domain loaders', async () => {
    const coreLoader: LazyLoader = async (locale) =>
      locale === 'en'
        ? { core: { actions: { save: 'Save', cancel: 'Cancel' } } }
        : null
    const shopLoader: LazyLoader = async (locale) =>
      locale === 'en'
        ? { shop: { cart: { title: 'Your cart', empty: 'Cart is empty' } } }
        : null
    const legalLoader: LazyLoader = async (locale) =>
      locale === 'en' ? { legal: { tos: { title: 'Terms of Service' } } } : null

    const provider = new LazyTranslationProvider({
      name: 'composite',
      loaders: [coreLoader, shopLoader, legalLoader],
      locales: ['en'],
    })

    const i18n = new I18n({ disableDefaultCoreBundle: true, providers: [provider] })
    await i18n.bootstrap()

    expect(i18n.t('core.actions.save')).toBe('Save')
    expect(i18n.t('shop.cart.title')).toBe('Your cart')
    expect(i18n.t('shop.cart.empty')).toBe('Cart is empty')
    expect(i18n.t('legal.tos.title')).toBe('Terms of Service')
  })

  it('later loaders override earlier ones (last-merge-wins)', async () => {
    const baseLoader: LazyLoader = async () => ({
      core: { actions: { save: 'Base save' } },
      shop: { cart: { title: 'Base cart' } },
    })
    const overrideLoader: LazyLoader = async () => ({
      core: { actions: { save: 'Override save' } },
    })

    const provider = new LazyTranslationProvider({
      loaders: [baseLoader, overrideLoader],
      locales: ['en'],
    })

    const i18n = new I18n({ disableDefaultCoreBundle: true, providers: [provider] })
    await i18n.bootstrap()

    // overridden by later loader
    expect(i18n.t('core.actions.save')).toBe('Override save')
    // untouched by override → still from base loader
    expect(i18n.t('shop.cart.title')).toBe('Base cart')
  })

  it('loader returning null is skipped', async () => {
    const presentLoader: LazyLoader = async () => ({
      shop: { cart: { title: 'Cart' } },
    })
    const missingLoader: LazyLoader = async () => null

    const provider = new LazyTranslationProvider({
      loaders: [missingLoader, presentLoader, missingLoader],
      locales: ['en'],
    })

    const i18n = new I18n({ disableDefaultCoreBundle: true, providers: [provider] })
    await i18n.bootstrap()

    expect(i18n.t('shop.cart.title')).toBe('Cart')
  })

  it('availableLocales reflects the configured locales', () => {
    const provider = new LazyTranslationProvider({
      loaders: [async () => ({})],
      locales: ['en', 'fr', 'de'],
    })
    expect(new Set(provider.availableLocales())).toEqual(new Set(['en', 'fr', 'de']))
  })

  it('two providers chained: the later one in options.providers wins', async () => {
    const baseProvider = new LazyTranslationProvider({
      loaders: [async () => ({ shop: { cart: { title: 'Default cart' } } })],
      locales: ['en'],
    })
    const overrideProvider = new LazyTranslationProvider({
      loaders: [async () => ({ shop: { cart: { title: 'Override cart' } } })],
      locales: ['en'],
    })

    const i18n = new I18n({
      disableDefaultCoreBundle: true,
      providers: [baseProvider, overrideProvider],
    })
    await i18n.bootstrap()

    expect(i18n.t('shop.cart.title')).toBe('Override cart')
  })
})
