/**
 * The persisters other than the URL (#2146).
 *
 * Each medium keeps the same contract — read what was written, drop what is
 * empty, clear only your own scope — and differs where the medium genuinely
 * differs. These pin both halves: the shared rule, and the deliberate
 * departures (a cookie is one blob because it rides on every request; memory
 * outlives the instance because a list rebuilds its persister on every
 * mount).
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebStoragePersister } from '../../src/routeState/WebStoragePersister'
import { CookiePersister } from '../../src/routeState/CookiePersister'
import { MemoryPersister, clearRouteStateMemory } from '../../src/routeState/MemoryPersister'
import { NullPersister } from '../../src/routeState/NullPersister'
import { CompositePersister } from '../../src/routeState/CompositePersister'
import { createDefaultRouteStatePersister } from '../../src/routeState/defaultPersister'
import { createRouteStatePersisterFactory } from '../../src/routeState/factory'
import { resolveRouteStatePersister } from '../../src/routeState/RouteStatePersister'

/** A Storage stand-in that behaves like the real one, index order included. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
    _map: map,
  }
}

describe('WebStoragePersister', () => {
  it('round-trips values with their types intact', () => {
    // The departure from the URL, and it is deliberate: a query string
    // coerces because people read it, web storage does not.
    const storage = fakeStorage()
    const p = new WebStoragePersister({ storage })

    p.write('offers', { page: 2, search: '42', active: true, tags: ['a', 'b'] })

    expect(p.read('offers')).toEqual({ page: 2, search: '42', active: true, tags: ['a', 'b'] })
  })

  it('namespaces by scope, so two lists do not read each other', () => {
    const storage = fakeStorage()
    const p = new WebStoragePersister({ storage })

    p.write('offers', { page: 2 })
    p.write('jobs', { page: 9 })

    expect(p.read('offers')).toEqual({ page: 2 })
    expect(p.read('jobs')).toEqual({ page: 9 })
  })

  it('removes an emptied key rather than storing it empty', () => {
    const storage = fakeStorage()
    const p = new WebStoragePersister({ storage })
    p.write('offers', { page: 2, search: 'nginx' })

    p.write('offers', { page: 2, search: '' })

    expect(p.read('offers')).toEqual({ page: 2 })
  })

  it('reads null when the scope holds nothing', () => {
    expect(new WebStoragePersister({ storage: fakeStorage() }).read('offers')).toBeNull()
  })

  it('clears its own scope and leaves everyone else alone', () => {
    // The bug this guards: Storage.key(i) walks a LIVE collection, so
    // removing while iterating renumbers what is left and skips entries.
    const storage = fakeStorage()
    const p = new WebStoragePersister({ storage })
    p.write('offers', { page: 2, search: 'a', state: 'open', kind: 'x' })
    p.write('jobs', { page: 9 })
    storage.setItem('unrelated-app-key', 'keep me')

    p.clear('offers')

    expect(p.read('offers')).toBeNull()
    expect(p.read('jobs')).toEqual({ page: 9 })
    expect(storage.getItem('unrelated-app-key')).toBe('keep me')
  })

  it('warns once and keeps the screen working when storage throws', () => {
    // Private browsing, blocked site data, a full quota. Announced, not
    // silent — but not fatal either.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const throwing = {
      getItem() { throw new Error('denied') },
      setItem() { throw new Error('denied') },
      removeItem() { throw new Error('denied') },
      key() { throw new Error('denied') },
      get length() { throw new Error('denied') },
    }
    const p = new WebStoragePersister({ storage: throwing, name: 'local_storage' })

    expect(() => p.write('offers', { page: 2 })).not.toThrow()
    expect(p.read('offers')).toBeNull()
    expect(() => p.clear('offers')).not.toThrow()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(String(spy.mock.calls[0][0])).toContain('local_storage')
  })

  it('hands back a value it did not write rather than dropping the key', () => {
    const storage = fakeStorage({ 'qdadm:offers:page': 'not json' })
    expect(new WebStoragePersister({ storage }).read('offers')).toEqual({ page: 'not json' })
  })
})

describe('CookiePersister', () => {
  function jar(initial = '') {
    return { cookie: initial }
  }

  it('keeps one cookie per scope, not one per key', () => {
    // The reason: every cookie rides on every request to the origin. Eight
    // filters must not become eight cookies on every image the page loads.
    const j = jar()
    const written = []
    const p = new CookiePersister({
      jar: {
        get cookie() { return j.cookie },
        set cookie(v) { written.push(v); j.cookie = v.split(';')[0] },
      },
    })

    p.write('offers', { page: 2, search: 'nginx', state: 'open' })

    expect(written).toHaveLength(1)
    expect(written[0].startsWith('qdadm_offers=')).toBe(true)
  })

  it('round-trips through a real-looking jar', () => {
    const j = jar()
    const p = new CookiePersister({
      jar: {
        get cookie() { return j.cookie },
        set cookie(v) { j.cookie = v.split(';')[0] },
      },
    })

    p.write('offers', { page: 2, search: 'ngin x' })

    expect(p.read('offers')).toEqual({ page: 2, search: 'ngin x' })
  })

  it('takes the cookie off the wire when nothing is left to remember', () => {
    // Rather than shipping `{}` on every request for the next year.
    const j = jar()
    const p = new CookiePersister({
      jar: {
        get cookie() { return j.cookie },
        set cookie(v) { j.cookie = v.split(';')[0] },
      },
    })
    p.write('offers', { page: 2 })

    p.write('offers', { page: null })

    expect(p.read('offers')).toBeNull()
  })

  it('ignores a corrupt blob instead of half-restoring a screen', () => {
    const p = new CookiePersister({ jar: { cookie: 'qdadm_offers=not-json' } })
    expect(p.read('offers')).toBeNull()
  })

  it('reads null for a scope nobody wrote', () => {
    const p = new CookiePersister({ jar: { cookie: 'qdadm_jobs=%7B%22page%22%3A9%7D' } })
    expect(p.read('offers')).toBeNull()
    expect(p.read('jobs')).toEqual({ page: 9 })
  })
})

describe('MemoryPersister', () => {
  beforeEach(() => clearRouteStateMemory())

  it('survives the persister that wrote it', () => {
    // The point: a list rebuilds its persister on every mount, so state held
    // on the instance would die on exactly the navigation this must survive.
    new MemoryPersister().write('offers', { page: 2 })

    expect(new MemoryPersister().read('offers')).toEqual({ page: 2 })
  })

  it('keeps an explicit store to itself', () => {
    const store = new Map()
    new MemoryPersister({ store }).write('offers', { page: 2 })

    expect(new MemoryPersister().read('offers')).toBeNull()
    expect(new MemoryPersister({ store }).read('offers')).toEqual({ page: 2 })
  })

  it('hands out a copy, so a caller cannot rewrite history by mutating it', () => {
    const p = new MemoryPersister()
    p.write('offers', { page: 2 })

    p.read('offers').page = 99

    expect(p.read('offers')).toEqual({ page: 2 })
  })

  it('forgets a scope with nothing left in it', () => {
    const p = new MemoryPersister()
    p.write('offers', { page: 2 })
    p.write('offers', { page: null })
    expect(p.read('offers')).toBeNull()
  })
})

describe('NullPersister', () => {
  it('remembers nothing, and is reached only by name', () => {
    const p = new NullPersister()
    p.write('offers', { page: 2 })
    expect(p.read('offers')).toBeNull()
    expect(p.name).toBe('none')
  })
})

describe('the factory', () => {
  const context = () => ({
    router: { replace: vi.fn() },
    route: { query: {} },
    localStorage: fakeStorage(),
    sessionStorage: fakeStorage(),
    cookieJar: { cookie: '' },
  })

  it.each([
    ['url', 'url'],
    ['local_storage', 'local_storage'],
    ['session_storage', 'session_storage'],
    ['cookie', 'cookie'],
    ['memory', 'memory'],
    ['none', 'none'],
  ])('builds %s', (slug, name) => {
    const p = resolveRouteStatePersister(slug, createRouteStatePersisterFactory(context()))
    expect(p.name).toBe(name)
  })

  it('throws on a slug it does not know, naming it', () => {
    // Never a fallback to the URL: a persistence choice that quietly does
    // something else is what ADR 0011 forbids, and what this seam cleans up.
    expect(() =>
      resolveRouteStatePersister('redis', createRouteStatePersisterFactory(context()))
    ).toThrow(/redis/)
  })

  it('takes an instance straight through', () => {
    const mine = new MemoryPersister({ store: new Map() })
    expect(resolveRouteStatePersister(mine, createRouteStatePersisterFactory(context()))).toBe(mine)
  })
})

describe('CompositePersister', () => {
  function setup() {
    const url = new MemoryPersister({ store: new Map() })
    const jar = new MemoryPersister({ store: new Map() })
    url.name = 'url'
    jar.name = 'cookie'
    const p = new CompositePersister({
      fallback: url,
      keys: { pageSize: { persister: jar, scope: 'app' } },
    })
    return { p, url, jar }
  }

  it('sends each key to its own medium', () => {
    const { p, url, jar } = setup()

    p.write('offers', { page: 2, pageSize: 50 })

    expect(url.read('offers')).toEqual({ page: 2 })
    expect(jar.read('app')).toEqual({ pageSize: 50 })
  })

  it('reads them back as one state', () => {
    const { p } = setup()
    p.write('offers', { page: 2, pageSize: 50 })

    expect(p.read('offers')).toEqual({ page: 2, pageSize: 50 })
  })

  it('remembers a pinned key once for the whole app, not per list', () => {
    // Which is what the year-long global cookie already meant.
    const { p } = setup()
    p.write('offers', { page: 2, pageSize: 50 })

    expect(p.read('jobs')).toEqual({ pageSize: 50 })
  })

  it('lets the owning medium win over a stale value in the fallback', () => {
    // A `?pageSize=10` somebody left in a URL must not beat the cookie that
    // owns the setting.
    const { p, url, jar } = setup()
    url.write('offers', { pageSize: 10 })
    jar.write('app', { pageSize: 100 })

    expect(p.read('offers').pageSize).toBe(100)
  })

  it('passes an absent routed key on as absent, so it gets removed', () => {
    const { p, jar } = setup()
    p.write('offers', { page: 2, pageSize: 50 })

    p.write('offers', { page: 2, pageSize: null })

    expect(jar.read('app')).toBeNull()
  })

  it('clearing one list does not reset an app-wide setting', () => {
    // Otherwise one list's "clear filters" would change every other list's
    // row count.
    const { p, jar } = setup()
    p.write('offers', { page: 2, pageSize: 50 })

    p.clear('offers')

    expect(p.read('offers')).toEqual({ pageSize: 50 })
    expect(jar.read('app')).toEqual({ pageSize: 50 })
  })

  it('reads null when no medium holds anything', () => {
    expect(setup().p.read('offers')).toBeNull()
  })

  it('names the media it composes, for diagnostics', () => {
    expect(setup().p.name).toBe('composite(url+cookie)')
  })
})

describe('the default composition', () => {
  it('keeps the page in the link and the row count out of it', () => {
    // The whole argument for the URL default is that a link shows what the
    // sender was looking at. A row count is not that — it is a comfort
    // setting, and a link carrying it would impose it on the reader.
    const replaced = []
    const route = { query: {} }
    const jar = { cookie: '' }
    const p = createDefaultRouteStatePersister({
      router: {
        replace: (arg) => {
          replaced.push(arg.query)
          route.query = arg.query
        },
      },
      route,
      cookieJar: {
        get cookie() { return jar.cookie },
        set cookie(v) { jar.cookie = v.split(';')[0] },
      },
    })

    p.write('offers', { page: 2, pageSize: 50 })

    expect(replaced.at(-1)).toMatchObject({ 'offers.page': '2' })
    expect(replaced.at(-1)).not.toHaveProperty(['offers.pageSize'])
    expect(jar.cookie.startsWith('qdadm_app=')).toBe(true)
  })

  it('reads both back as one state', () => {
    const route = { query: {} }
    const jar = { cookie: '' }
    const jarView = {
      get cookie() { return jar.cookie },
      set cookie(v) { jar.cookie = v.split(';')[0] },
    }
    const p = createDefaultRouteStatePersister({
      router: { replace: (arg) => { route.query = arg.query } },
      route,
      cookieJar: jarView,
    })

    p.write('offers', { page: 2, pageSize: 50 })

    expect(p.read('offers')).toEqual({ page: 2, pageSize: 50 })
  })

  it('carries the row count across lists, and the page not at all', () => {
    const route = { query: {} }
    const jar = { cookie: '' }
    const jarView = {
      get cookie() { return jar.cookie },
      set cookie(v) { jar.cookie = v.split(';')[0] },
    }
    const p = createDefaultRouteStatePersister({
      router: { replace: (arg) => { route.query = arg.query } },
      route,
      cookieJar: jarView,
    })
    p.write('offers', { page: 2, pageSize: 50 })

    expect(p.read('jobs')).toEqual({ pageSize: 50 })
  })
})
