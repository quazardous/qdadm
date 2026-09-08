/**
 * The two sides of route naming must agree (#1923).
 *
 * `crud()` NAMES the routes; `useListPage` LOOKS THEM UP through
 * `EntityManager.routePrefix`. They used to singularize with different
 * engines — six hand-rolled lines here, the vendored `pluralize` there — and
 * they agreed on every regular plural, which is precisely why the
 * disagreement on irregular ones went unnoticed. `crud()` posted
 * `people-show` while `useListPage` asked for `person-show`, so
 * `router.hasRoute()` was false everywhere: no error at boot, nothing at all
 * until someone clicked.
 *
 * These tests drive the REAL `crud()` and read the names it actually
 * registered, rather than re-implementing the rule — a test that mirrors the
 * code it checks would survive the very regression it exists to catch.
 *
 * NOTE: the module registry is global — every test uses unique entity names
 * to stay isolated.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { KernelContext } from '../../src/kernel/KernelContext'
import { Module } from '../../src/kernel/Module'
import { getRoutes } from '../../src/module/moduleRegistry'
import { EntityManager } from '../../src/entity/EntityManager'

const noopPage = () => Promise.resolve({ default: {} })

function makeCtx() {
  const kernel = {
    orchestrator: { isRegistered: () => true, get: () => ({ idField: 'id' }) },
    options: {},
    _pendingProvides: new Map(),
    _pendingComponents: new Map(),
  }
  return new KernelContext(kernel, new Module())
}

/** The prefix `crud()` really used, read off the list route it registered. */
function prefixCrudUsed(entity) {
  makeCtx().crud(entity, { list: noopPage, show: noopPage })
  const show = getRoutes().find((r) => r.path === `${entity}/:id` && r.name?.endsWith('-show'))
  return show.name.replace(/-show$/, '')
}

/** The prefix `useListPage` resolves to when nothing is pinned. */
function prefixListPageWants(entity) {
  return new EntityManager({ name: entity }).routePrefix
}

describe('route prefix — naming side and lookup side agree (#1923)', () => {
  // Regular plurals both engines always agreed on, then the irregular ones
  // that broke, then uncountables.
  const NAMES = [
    'agrbooks', 'agrcategories', 'agrstatuses', 'agrboxes', 'agraddresses',
    'agrpeople', 'agrchildren', 'agranalyses', 'agrcriteria', 'agrindices',
  ]

  it.each(NAMES)('agrees on "%s"', (entity) => {
    expect(prefixCrudUsed(entity)).toBe(prefixListPageWants(entity))
  })
})

describe('irregular plurals are singularized correctly, not merely consistently', () => {
  // Two identical bad engines would satisfy agreement alone. These pin the
  // right answer, so agreement cannot be bought by matching a wrong rule.
  it.each([
    ['irrpeople', 'irrperson'],
    ['irrchildren', 'irrchild'],
  ])('crud() names "%s" routes under "%s"', (entity, expected) => {
    expect(prefixCrudUsed(entity)).toBe(expected)
  })

  it('gets the plain irregular forms right on the lookup side', () => {
    expect(new EntityManager({ name: 'people' }).routePrefix).toBe('person')
    expect(new EntityManager({ name: 'analyses' }).routePrefix).toBe('analysis')
    expect(new EntityManager({ name: 'criteria' }).routePrefix).toBe('criterion')
    expect(new EntityManager({ name: 'indices' }).routePrefix).toBe('index')
  })
})

describe('an explicitly pinned prefix still wins on both sides', () => {
  it('crud() honours options.routePrefix', () => {
    makeCtx().crud('pinthings', { list: noopPage, show: noopPage }, { routePrefix: 'custom' })
    expect(getRoutes().some((r) => r.name === 'custom-show')).toBe(true)
  })

  it('EntityManager honours an explicit routePrefix', () => {
    // This is how an app worked around the divergence; pinning must keep
    // working, or the fix would break the workaround it makes unnecessary.
    expect(new EntityManager({ name: 'people', routePrefix: 'people' }).routePrefix).toBe('people')
  })
})
