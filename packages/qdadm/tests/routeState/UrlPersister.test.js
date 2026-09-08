/**
 * Route state in the query string (#2146).
 *
 * The seam exists because qdadm had five unrelated persistence sites and no
 * rule: filters in sessionStorage AND the URL, sort in sessionStorage only,
 * page size in a year-long global cookie, the page nowhere until recently.
 * Each was invented where it was needed.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { UrlPersister } from '../../src/routeState/UrlPersister'

/** A router and route that behave like vue-router's, without one. */
function makeRouter(initial = {}) {
  const route = { query: { ...initial } }
  return {
    route,
    router: {
      replace: ({ query }) => {
        route.query = { ...query }
      },
    },
  }
}

function persister(initial) {
  const { route, router } = makeRouter(initial)
  return { p: new UrlPersister({ router, route }), route }
}

describe('writing', () => {
  it('namespaces by scope, so two lists stop fighting over `page`', () => {
    const { p, route } = persister()

    p.write('offers', { page: 2 })
    p.write('jobs', { page: 5 })

    expect(route.query).toEqual({ 'offers.page': '2', 'jobs.page': '5' })
  })

  it('leaves a pristine screen out of the link', () => {
    // Empty is absent, not stored empty — the whole point of a shareable URL.
    const { p, route } = persister({ 'offers.state': 'open' })

    p.write('offers', { state: null, search: '', page: undefined })

    expect(route.query).toEqual({})
  })

  it('keeps other scopes and unrelated params untouched', () => {
    const { p, route } = persister({ 'jobs.page': '3', tab: 'details' })

    p.write('offers', { page: 2 })

    expect(route.query).toEqual({ 'jobs.page': '3', tab: 'details', 'offers.page': '2' })
  })

  it('keeps primitives readable rather than perfectly round-tripped', () => {
    const { p, route } = persister()

    p.write('offers', { page: 2, active: true, name: 'vinted' })

    // A query string people paste into tickets is worth more than quoting.
    expect(route.query).toEqual({
      'offers.page': '2',
      'offers.active': 'true',
      'offers.name': 'vinted',
    })
  })

  it('JSON-encodes what has no readable form', () => {
    const { p, route } = persister()

    p.write('offers', { range: { from: 1, to: 9 }, tags: ['a', 'b'] })

    expect(route.query['offers.range']).toBe('{"from":1,"to":9}')
    expect(route.query['offers.tags']).toBe('["a","b"]')
  })
})

describe('reading', () => {
  it('returns null when the scope wrote nothing', () => {
    const { p } = persister({ 'jobs.page': '3' })

    expect(p.read('offers')).toBeNull()
  })

  it('reads back only its own scope', () => {
    const { p } = persister({ 'offers.page': '2', 'jobs.page': '9', tab: 'x' })

    expect(p.read('offers')).toEqual({ page: 2 })
  })

  it('restores types, with the coercion the URL sync already applied', () => {
    const { p } = persister({
      'offers.page': '2',
      'offers.active': 'true',
      'offers.missing': 'null',
      'offers.name': 'vinted',
    })

    expect(p.read('offers')).toEqual({ page: 2, active: true, missing: null, name: 'vinted' })
  })

  it('reads JSON back', () => {
    const { p } = persister({ 'offers.range': '{"from":1,"to":9}' })

    expect(p.read('offers')).toEqual({ range: { from: 1, to: 9 } })
  })

  it('does not choke on a value that merely starts like JSON', () => {
    const { p } = persister({ 'offers.note': '{not json' })

    expect(p.read('offers')).toEqual({ note: '{not json' })
  })

  it('round-trips what write produced', () => {
    const { p } = persister()
    const state = { page: 3, active: false, name: 'vinted', range: { from: 1 } }

    p.write('offers', state)

    expect(p.read('offers')).toEqual(state)
  })
})

describe('clearing', () => {
  it('removes its scope and nothing else', () => {
    const { p, route } = persister({ 'offers.page': '2', 'offers.state': 'open', 'jobs.page': '9' })

    p.clear('offers')

    expect(route.query).toEqual({ 'jobs.page': '9' })
  })
})
