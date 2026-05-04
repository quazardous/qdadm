/**
 * Schema composer — pure-function tests.
 *
 * Coverage focus:
 * - Single plugin: prefix application, owner stamping
 * - Multi-plugin merge: extensions land on the right table with owner
 * - Conflict detection: two plugins claim same table OR same column
 * - Idempotent prefixing (entities already prefixed don't get double-prefix)
 */

import { describe, expect, it } from 'vitest'
import {
  composeFullSchema,
  composePluginSchema,
  MigrationOwnershipError,
} from '../../src/migration'
import type { PluginManifest } from '../../src/plugin'

const corePlugin = (): PluginManifest => ({
  id: 'core',
  version: '1.0.0',
  prefix: 'core',
  entities: [
    {
      name: 'user',
      tableName: 'users', // unprefixed; composer should prefix it
      fields: {
        id: { type: 'uuid', pk: true },
        email: { type: 'string', length: 255, unique: true },
      },
      indexes: [{ fields: ['email'] }],
    },
  ],
})

const dcPlugin = (): PluginManifest => ({
  id: 'dc',
  version: '0.1.0',
  prefix: 'dc',
  dependencies: [{ id: 'core' }],
  entities: [
    {
      name: 'post',
      tableName: 'dc_posts', // already prefixed; composer should NOT double-prefix
      fields: { id: { type: 'uuid', pk: true } },
    },
  ],
  extensions: {
    core_users: { newsletter_opt_in: { type: 'boolean', default: false } },
  },
})

describe('composePluginSchema (single plugin)', () => {
  it('applies the plugin prefix to entity tableName', () => {
    const composed = composePluginSchema(corePlugin())
    expect(composed.ownedTables[0].tableName).toBe('core_users')
  })

  it('stamps owner on the entity', () => {
    const composed = composePluginSchema(corePlugin())
    expect(composed.ownedTables[0].owner).toBe('core')
  })

  it('stamps owner on each field', () => {
    const composed = composePluginSchema(corePlugin())
    expect(composed.ownedTables[0].fields.id.owner).toBe('core')
    expect(composed.ownedTables[0].fields.email.owner).toBe('core')
  })

  it('stamps owner on each index', () => {
    const composed = composePluginSchema(corePlugin())
    expect(composed.ownedTables[0].indexes?.[0].owner).toBe('core')
  })

  it('does NOT double-prefix already-prefixed table names', () => {
    const composed = composePluginSchema(dcPlugin())
    expect(composed.ownedTables[0].tableName).toBe('dc_posts') // not dc_dc_posts
  })

  it('stamps owner on extension fields', () => {
    const composed = composePluginSchema(dcPlugin())
    expect(composed.extensions.core_users.newsletter_opt_in.owner).toBe('dc')
  })

  it('handles plugin with no entities (empty owned)', () => {
    const composed = composePluginSchema({
      id: 'meta',
      version: '1.0.0',
      prefix: 'meta',
    })
    expect(composed.ownedTables).toEqual([])
    expect(composed.extensions).toEqual({})
  })
})

describe('composeFullSchema (multi-plugin)', () => {
  it('merges multiple plugins into a flat tables map', () => {
    const tables = composeFullSchema([corePlugin(), dcPlugin()])
    expect(Object.keys(tables).sort()).toEqual(['core_users', 'dc_posts'])
  })

  it('merges extension columns onto the foreign table', () => {
    const tables = composeFullSchema([corePlugin(), dcPlugin()])
    expect(tables.core_users.fields.newsletter_opt_in).toBeDefined()
    expect(tables.core_users.fields.newsletter_opt_in.owner).toBe('dc')
  })

  it('preserves the original column owner for owned-table fields', () => {
    const tables = composeFullSchema([corePlugin(), dcPlugin()])
    expect(tables.core_users.fields.email.owner).toBe('core')
    expect(tables.core_users.fields.newsletter_opt_in.owner).toBe('dc')
  })

  it('throws on table-name collision (two plugins claim same table)', () => {
    const a: PluginManifest = {
      id: 'a',
      version: '1.0.0',
      prefix: 'shared', // intentional collision via prefix
      entities: [
        {
          name: 'thing',
          tableName: 'shared_thing',
          fields: { id: { type: 'uuid', pk: true } },
        },
      ],
    }
    const b: PluginManifest = {
      id: 'b',
      version: '1.0.0',
      prefix: 'shared',
      entities: [
        {
          name: 'thing',
          tableName: 'shared_thing',
          fields: { id: { type: 'uuid', pk: true } },
        },
      ],
    }
    expect(() => composeFullSchema([a, b])).toThrow(MigrationOwnershipError)
  })

  it('throws on extension-column collision (two plugins same column on same table)', () => {
    const ext1: PluginManifest = {
      id: 'a',
      version: '1.0.0',
      prefix: 'a',
      dependencies: [{ id: 'core' }],
      extensions: { core_users: { bio: { type: 'text' } } },
    }
    const ext2: PluginManifest = {
      id: 'b',
      version: '1.0.0',
      prefix: 'b',
      dependencies: [{ id: 'core' }],
      extensions: { core_users: { bio: { type: 'text' } } },
    }
    expect(() => composeFullSchema([corePlugin(), ext1, ext2])).toThrow(
      /column "core_users\.bio" claimed by both/,
    )
  })

  it('throws when an extension targets a non-existent table', () => {
    const orphan: PluginManifest = {
      id: 'orphan',
      version: '1.0.0',
      prefix: 'orphan',
      extensions: { ghost_table: { x: { type: 'string' } } },
    }
    expect(() => composeFullSchema([orphan])).toThrow(/extends unknown table/)
  })
})
