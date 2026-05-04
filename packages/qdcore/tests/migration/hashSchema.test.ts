/**
 * Hash + canonicalisation — pure-function tests.
 *
 * Coverage focus:
 * - Determinism across key orders (canonical JSON property)
 * - Sensitivity to plugin id, version, dialect, schema content
 * - Tampering detection helper (hashContent)
 * - shortHash predictable trim
 */

import { describe, expect, it } from 'vitest'
import {
  canonicalJSON,
  hashContent,
  hashSchema,
  shortHash,
  type ComposedSchema,
} from '../../src/migration'

const baseSchema = (): ComposedSchema => ({
  ownedTables: [
    {
      name: 'post',
      tableName: 'dc_posts',
      owner: 'dc',
      fields: {
        id: { type: 'uuid', pk: true, owner: 'dc' },
        title: { type: 'string', length: 255, owner: 'dc' },
      },
    },
  ],
  extensions: {},
})

describe('canonicalJSON', () => {
  it('serialises primitives', () => {
    expect(canonicalJSON(null)).toBe('null')
    expect(canonicalJSON(true)).toBe('true')
    expect(canonicalJSON(42)).toBe('42')
    expect(canonicalJSON('hello')).toBe('"hello"')
  })

  it('sorts object keys lexicographically', () => {
    expect(canonicalJSON({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}')
  })

  it('preserves array order (significance)', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]')
  })

  it('recursive sorting (nested objects)', () => {
    const a = canonicalJSON({ outer: { z: 1, a: 2 } })
    expect(a).toBe('{"outer":{"a":2,"z":1}}')
  })

  it('drops undefined object values (matches JSON.stringify)', () => {
    expect(canonicalJSON({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}')
  })

  it('produces the same string regardless of object insertion order', () => {
    const a = canonicalJSON({ x: 1, y: 2, z: 3 })
    const b = canonicalJSON({ z: 3, y: 2, x: 1 })
    expect(a).toBe(b)
  })
})

describe('hashSchema', () => {
  const baseInput = () => ({
    pluginId: 'dc',
    pluginVersion: '1.0.0',
    schema: baseSchema(),
    dialect: 'sqlite' as const,
  })

  it('returns a 64-char hex string', () => {
    const h = hashSchema(baseInput())
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input → same hash', () => {
    expect(hashSchema(baseInput())).toBe(hashSchema(baseInput()))
  })

  it('is insensitive to object key order in the schema', () => {
    // Build a "shuffled" version of the schema with same content but
    // different field declaration order.
    const shuffled: ComposedSchema = {
      ownedTables: [
        {
          name: 'post',
          tableName: 'dc_posts',
          owner: 'dc',
          fields: {
            // reverse order vs. baseSchema()
            title: { length: 255, type: 'string', owner: 'dc' },
            id: { pk: true, type: 'uuid', owner: 'dc' },
          },
        },
      ],
      extensions: {},
    }
    expect(hashSchema({ ...baseInput(), schema: shuffled })).toBe(
      hashSchema(baseInput()),
    )
  })

  it('changes when plugin id changes', () => {
    const h1 = hashSchema(baseInput())
    const h2 = hashSchema({ ...baseInput(), pluginId: 'other' })
    expect(h1).not.toBe(h2)
  })

  it('changes when plugin version changes', () => {
    const h1 = hashSchema(baseInput())
    const h2 = hashSchema({ ...baseInput(), pluginVersion: '1.0.1' })
    expect(h1).not.toBe(h2)
  })

  it('changes when dialect changes', () => {
    const h1 = hashSchema(baseInput())
    const h2 = hashSchema({ ...baseInput(), dialect: 'postgres' })
    expect(h1).not.toBe(h2)
  })

  it('changes when schema content changes (added field)', () => {
    const h1 = hashSchema(baseInput())
    const modified = baseSchema()
    modified.ownedTables[0].fields.body = { type: 'text', owner: 'dc' }
    const h2 = hashSchema({ ...baseInput(), schema: modified })
    expect(h1).not.toBe(h2)
  })

  it('changes when an extension is added', () => {
    const h1 = hashSchema(baseInput())
    const withExt = baseSchema()
    withExt.extensions.core_users = {
      bio: { type: 'text', owner: 'dc' },
    }
    const h2 = hashSchema({ ...baseInput(), schema: withExt })
    expect(h1).not.toBe(h2)
  })
})

describe('hashContent', () => {
  it('hashes raw text content', () => {
    expect(hashContent('CREATE TABLE x (id INT);')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('detects tampering — changed whitespace yields different hash', () => {
    const a = hashContent('CREATE TABLE x (id INT);')
    const b = hashContent('CREATE  TABLE x (id INT);')
    expect(a).not.toBe(b)
  })
})

describe('shortHash', () => {
  it('returns the first 8 hex chars', () => {
    const full = 'a'.repeat(64)
    expect(shortHash(full)).toBe('aaaaaaaa')
  })
})
