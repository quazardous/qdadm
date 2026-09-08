/**
 * The two `createManagers` no longer share a name (#1902).
 *
 * The root exports one from `entity/factory.ts` — `(config, context)` in, a
 * `Record` out. `./gen` exported another — one generated config in, a `Map`
 * out. Same name, two public entry points, different signatures, different
 * return types, and nothing to warn whoever reached for the wrong import: the
 * mistake surfaces at the first `.get()`, far from its cause.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { createGeneratedManagers, createManagers as genCreateManagers } from '../../src/gen'
import { createManagers as rootCreateManagers } from '../../src/entity/factory'

const config = {
  schemas: {},
  storages: {},
  entities: {},
}

describe('the gen factory has an unambiguous name', () => {
  it('is exported as createGeneratedManagers', () => {
    expect(typeof createGeneratedManagers).toBe('function')
  })

  it('still answers to the old name, so nobody is broken', () => {
    expect(genCreateManagers).toBe(createGeneratedManagers)
  })

  it('is NOT the root factory — that was the whole trap', () => {
    expect(genCreateManagers).not.toBe(rootCreateManagers)
  })
})

describe('the two return different shapes, which is why the collision bit', () => {
  it('the gen factory returns a Map', () => {
    const managers = createGeneratedManagers(config)

    expect(managers).toBeInstanceOf(Map)
    expect(typeof managers.get).toBe('function')
  })

  it('the root factory returns a plain Record, with no .get()', () => {
    const managers = rootCreateManagers({})

    expect(managers).not.toBeInstanceOf(Map)
    // Reaching for .get() on this is exactly how the wrong import announced
    // itself — several frames away from the import that caused it.
    expect(managers.get).toBeUndefined()
  })
})
