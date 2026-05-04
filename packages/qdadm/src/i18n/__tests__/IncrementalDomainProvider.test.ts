import { describe, it, expect, vi } from 'vitest'

import { I18n } from '../I18n'
import { IncrementalDomainProvider, type DomainLoader } from '../IncrementalDomainProvider'

function makeSignals() {
  const events: Array<{ signal: string; data: unknown }> = []
  const handlers = new Map<string, Array<(e: { data: unknown }) => void>>()
  return {
    events,
    bus: {
      emit: (signal: string, data: unknown) => {
        events.push({ signal, data })
        for (const h of handlers.get(signal) ?? []) h({ data })
      },
      on: (signal: string, handler: (e: { data: unknown }) => void) => {
        const list = handlers.get(signal) ?? []
        list.push(handler)
        handlers.set(signal, list)
        return () => {}
      },
    },
  }
}

describe('IncrementalDomainProvider — lazy-by-domain', () => {
  it('only loads eagerDomains during bootstrap; lazy domains stay dormant', async () => {
    const coreLoader = vi.fn(async () => ({ actions: { save: 'Save' } }))
    const shopLoader = vi.fn(async () => ({ cart: { title: 'Cart' } }))

    const provider = new IncrementalDomainProvider({
      domains: { core: coreLoader, shop: shopLoader },
      eagerDomains: ['core'],
      locales: ['en'],
    })

    const i18n = new I18n({ disableDefaultCoreBundle: true, providers: [provider] })
    await i18n.bootstrap()

    expect(coreLoader).toHaveBeenCalledTimes(1)
    expect(shopLoader).not.toHaveBeenCalled()
    expect(i18n.t('core.actions.save')).toBe('Save')
  })

  it('t() on an unloaded domain triggers a lazy load + emits i18n:domain-loaded', async () => {
    const shopLoader = vi.fn(async () => ({ cart: { title: 'Cart' } }))

    const provider = new IncrementalDomainProvider({
      domains: { shop: shopLoader },
      locales: ['en'],
    })

    const sig = makeSignals()
    const i18n = new I18n(
      { disableDefaultCoreBundle: true, providers: [provider] },
      { signals: sig.bus }
    )
    await i18n.bootstrap()

    // First call: shop not loaded yet → returns the raw key, kicks off load
    const first = i18n.t('shop.cart.title')
    expect(first).toBe('shop.cart.title')

    // Wait one microtask tick for the async load to settle
    await vi.waitFor(() => {
      expect(sig.events.find((e) => e.signal === 'i18n:domain-loaded')).toBeDefined()
    })

    expect(shopLoader).toHaveBeenCalledTimes(1)

    // Second call: domain is in the registry now
    expect(i18n.t('shop.cart.title')).toBe('Cart')

    // Signal payload identifies the domain + locale
    const loaded = sig.events.find((e) => e.signal === 'i18n:domain-loaded')
    expect(loaded?.data).toEqual({ locale: 'en', domain: 'shop' })
  })

  it('dedupes concurrent lazy loads for the same (locale, domain)', async () => {
    let resolveLoader: ((value: unknown) => void) | undefined
    const shopLoader = vi.fn(
      () =>
        new Promise<{ cart: { title: string } }>((resolve) => {
          resolveLoader = resolve as (v: unknown) => void
        })
    )

    const provider = new IncrementalDomainProvider({
      domains: { shop: shopLoader as DomainLoader },
      locales: ['en'],
    })

    const i18n = new I18n({ disableDefaultCoreBundle: true, providers: [provider] })
    await i18n.bootstrap()

    // 50 concurrent lookups during the inflight window
    for (let i = 0; i < 50; i++) i18n.t('shop.cart.title')

    expect(shopLoader).toHaveBeenCalledTimes(1)
    resolveLoader?.({ cart: { title: 'Cart' } })
    await new Promise((r) => setTimeout(r, 0))

    expect(i18n.t('shop.cart.title')).toBe('Cart')
  })

  it('loadDomain() lets the app pre-warm a domain explicitly', async () => {
    const shopLoader = vi.fn(async () => ({ cart: { title: 'Cart' } }))

    const provider = new IncrementalDomainProvider({
      domains: { shop: shopLoader },
      locales: ['en'],
    })

    const i18n = new I18n({ disableDefaultCoreBundle: true, providers: [provider] })
    await i18n.bootstrap()

    await i18n.loadDomain('shop')
    // After explicit pre-warm, t() resolves immediately — no placeholder
    expect(i18n.t('shop.cart.title')).toBe('Cart')
    expect(shopLoader).toHaveBeenCalledTimes(1)
  })

  it('miss on a domain known to no provider stays a miss (no infinite trigger)', async () => {
    const shopLoader = vi.fn(async () => ({ cart: { title: 'Cart' } }))
    const provider = new IncrementalDomainProvider({
      domains: { shop: shopLoader },
      locales: ['en'],
    })

    const sig = makeSignals()
    const i18n = new I18n(
      { disableDefaultCoreBundle: true, providers: [provider] },
      { signals: sig.bus }
    )
    await i18n.bootstrap()

    // `legal.*` is unknown to every provider → no load attempt
    i18n.t('legal.tos.title')
    i18n.t('legal.tos.title')
    i18n.t('legal.tos.title')
    await new Promise((r) => setTimeout(r, 0))

    expect(shopLoader).not.toHaveBeenCalled()
    expect(sig.events.some((e) => e.signal === 'i18n:domain-loaded')).toBe(false)
  })
})
