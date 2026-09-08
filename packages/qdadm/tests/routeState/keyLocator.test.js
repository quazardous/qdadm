/**
 * How a (scope, key) pair becomes a stored key (#2146).
 *
 * Overridable, and one per persister type, because the right scheme differs
 * by medium: dots read well in a query string, colons are the convention in
 * web storage. Hard-coding either would make the naming a property of qdadm
 * rather than of the app.
 *
 * `decode` returning null for a foreign key is what lets a persister pick its
 * own entries out of a medium it shares — the whole reason scopes exist.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { dottedKeyLocator, namespacedKeyLocator } from '../../src/routeState/keyLocator'
import { UrlPersister } from '../../src/routeState/UrlPersister'

describe('the dotted locator, default in a query string', () => {
  it('encodes scope and key', () => {
    expect(dottedKeyLocator.encode('offers', 'page')).toBe('offers.page')
  })

  it('decodes its own', () => {
    expect(dottedKeyLocator.decode('offers', 'offers.page')).toBe('page')
  })

  it('returns null for someone else’s key', () => {
    // Not an error: the query string is shared with everything else on the
    // page, and this is how a persister knows what is not its business.
    expect(dottedKeyLocator.decode('offers', 'jobs.page')).toBeNull()
    expect(dottedKeyLocator.decode('offers', 'tab')).toBeNull()
  })
})

describe('the namespaced locator, for web storage', () => {
  it('encodes under the qdadm namespace', () => {
    expect(namespacedKeyLocator.encode('offers', 'page')).toBe('qdadm:offers:page')
  })

  it('round-trips', () => {
    const stored = namespacedKeyLocator.encode('offers', 'page')
    expect(namespacedKeyLocator.decode('offers', stored)).toBe('page')
  })

  it('leaves other apps’ storage alone', () => {
    expect(namespacedKeyLocator.decode('offers', 'someOtherApp:offers:page')).toBeNull()
  })
})

describe('a custom locator overrides the scheme entirely', () => {
  const underscored = {
    name: 'underscored',
    encode: (scope, key) => `${scope}_${key}`,
    decode: (scope, stored) => (stored.startsWith(`${scope}_`) ? stored.slice(scope.length + 1) : null),
  }

  it('is used for both writing and reading', () => {
    const route = { query: {} }
    const router = { replace: ({ query }) => { route.query = { ...query } } }
    const p = new UrlPersister({ router, route, keyLocator: underscored })

    p.write('offers', { page: 4 })

    expect(route.query).toEqual({ offers_page: '4' })
    expect(p.read('offers')).toEqual({ page: 4 })
  })
})

describe('the flat read fallback, for links written before the seam', () => {
  const make = (query, opts = {}) => {
    const route = { query: { ...query } }
    const router = { replace: ({ q }) => { void q } }
    return { p: new UrlPersister({ router, route, ...opts }), route }
  }

  it('reads an old flat link rather than showing the wrong page silently', () => {
    // qdadm wrote `?page=2` flat before scopes existed. Those links are in
    // bookmarks and tickets; ignoring them would land the reader on page 1
    // with no error at all.
    const { p } = make({ page: '2', state: 'open' })

    expect(p.read('offers')).toEqual({ page: 2, state: 'open' })
  })

  it('prefers the scoped keys once they exist', () => {
    const { p } = make({ page: '2', 'offers.page': '7' })

    expect(p.read('offers')).toEqual({ page: 7 })
  })

  it('does NOT hand one list another list’s scoped state', () => {
    // The trap this fallback nearly created: `jobs.page` is scoped by
    // somebody, so it is not pre-scope leftover state and must not be read
    // as this list's. Only keys nobody has scoped qualify.
    const { p } = make({ 'jobs.page': '3' })

    expect(p.read('offers')).toBeNull()
  })

  it('reads unscoped keys while leaving scoped ones to their owners', () => {
    const { p } = make({ page: '2', 'jobs.state': 'open' })

    expect(p.read('offers')).toEqual({ page: 2 })
  })

  it('can be switched off', () => {
    const { p } = make({ page: '2' }, { readFlatFallback: false })

    expect(p.read('offers')).toBeNull()
  })

  it('retires the legacy key when the scope is written', () => {
    // Otherwise the flat key would shadow the prefixed one on the next read,
    // and the fallback would turn against us.
    const route = { query: { page: '2' } }
    const router = { replace: ({ query }) => { route.query = { ...query } } }
    const p = new UrlPersister({ router, route })

    p.write('offers', { page: 5 })

    expect(route.query).toEqual({ 'offers.page': '5' })
  })
})
