/**
 * Integration tests — install / uninstall lifecycle on a real SQLite DB.
 *
 * Each test uses a fresh in-memory SQLite via createTestRig(). MikroORM
 * SchemaGenerator handles the actual DDL — we verify outcomes via raw
 * introspection (sqlite_master / PRAGMA table_info).
 *
 * Coverage:
 * - Single plugin install creates its tables (with prefix)
 * - Uninstall drops the tables
 * - Multi-plugin coexistence (independent prefixes)
 * - Idempotence (re-install same plugin = no-op)
 * - Schema-managed = false (registry state changes, no DB work)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestRig, listColumns, listTables, makeFakePlugin, type TestRig } from './_helpers'

let rig: TestRig

beforeEach(async () => {
  rig = await createTestRig()
})

afterEach(async () => {
  await rig.cleanup()
})

describe('install — single plugin', () => {
  it('creates the plugin tables with prefix applied', async () => {
    const plugin = makeFakePlugin({
      id: 'core',
      entities: [
        {
          name: 'user',
          tableName: 'users',
          fields: {
            id: { type: 'integer', pk: true },
            email: { type: 'string', length: 255 },
          },
        },
        {
          name: 'session',
          tableName: 'sessions',
          fields: {
            id: { type: 'integer', pk: true },
            token: { type: 'string', length: 64 },
          },
        },
      ],
    })
    rig.registry.register(plugin)
    await rig.runner.install('core')

    const tables = await listTables(rig.storage)
    expect(tables).toContain('core_users')
    expect(tables).toContain('core_sessions')
    // Our system table should also exist.
    expect(tables).toContain('qdcms_schema_state')
  })

  it('records the migration in qdcms_schema_state', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    const migration = await rig.runner.install('core')
    const applied = await rig.runner.appliedFor('core')
    expect(applied).toEqual([migration.hash])
  })

  it('moves plugin into "installed" state', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await rig.runner.install('core')
    expect(rig.registry.get('core')?.state).toBe('installed')
  })

  it('is idempotent — second install with same hash is a no-op', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    const m1 = await rig.runner.install('core')
    const m2 = await rig.runner.install('core')
    expect(m1.hash).toBe(m2.hash)
    const applied = await rig.runner.appliedFor('core')
    expect(applied).toHaveLength(1) // only one row, not duplicated
  })
})

describe('uninstall — single plugin', () => {
  it('drops the plugin tables', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await rig.runner.install('core')
    expect(await listTables(rig.storage)).toContain('core_users')

    await rig.runner.uninstall('core')
    expect(await listTables(rig.storage)).not.toContain('core_users')
  })

  it('unrecords the migration', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await rig.runner.install('core')
    await rig.runner.uninstall('core')
    expect(await rig.runner.appliedFor('core')).toEqual([])
  })

  it('moves plugin back to "registered" state', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await rig.runner.install('core')
    await rig.runner.uninstall('core')
    expect(rig.registry.get('core')?.state).toBe('registered')
  })

  it('throws when uninstalling a plugin that is not installed', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await expect(rig.runner.uninstall('core')).rejects.toThrow(/not installed/)
  })

  it('throws when uninstalling unknown plugin', async () => {
    await expect(rig.runner.uninstall('ghost')).rejects.toThrow(/unknown plugin/)
  })
})

describe('multi-plugin coexistence', () => {
  it('two independent plugins can be installed side by side', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'a',
        entities: [
          {
            name: 'thing',
            tableName: 'things',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    rig.registry.register(
      makeFakePlugin({
        id: 'b',
        prefix: 'b',
        entities: [
          {
            name: 'item',
            tableName: 'items',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await rig.runner.install('a')
    await rig.runner.install('b')
    const tables = await listTables(rig.storage)
    expect(tables).toContain('a_things')
    expect(tables).toContain('b_items')
  })

  it('uninstalling one plugin leaves the other intact', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'a',
        entities: [
          {
            name: 'thing',
            tableName: 'things',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    rig.registry.register(
      makeFakePlugin({
        id: 'b',
        prefix: 'b',
        entities: [
          {
            name: 'item',
            tableName: 'items',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await rig.runner.install('a')
    await rig.runner.install('b')
    await rig.runner.uninstall('a')

    const tables = await listTables(rig.storage)
    expect(tables).not.toContain('a_things')
    expect(tables).toContain('b_items')
  })
})

describe('schema_managed = false', () => {
  it('records install state without touching the DB', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'external',
        schemaManaged: false,
        entities: [
          {
            name: 'thing',
            tableName: 'things',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    await rig.runner.install('external')
    expect(rig.registry.get('external')?.state).toBe('installed')
    expect(await listTables(rig.storage)).not.toContain('external_things')
    expect(await rig.runner.appliedFor('external')).toHaveLength(1)
  })

  it('uninstall just unrecords, no DB operation', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'external',
        schemaManaged: false,
      }),
    )
    await rig.runner.install('external')
    await rig.runner.uninstall('external')
    expect(rig.registry.get('external')?.state).toBe('registered')
    expect(await rig.runner.appliedFor('external')).toEqual([])
  })
})

describe('hash properties at runtime', () => {
  it('the recorded hash matches what hashSchema would produce for the manifest', async () => {
    const plugin = makeFakePlugin({
      id: 'core',
      version: '2.5.0',
      entities: [
        {
          name: 'user',
          tableName: 'users',
          fields: { id: { type: 'integer', pk: true } },
        },
      ],
    })
    rig.registry.register(plugin)
    const migration = await rig.runner.install('core')
    expect(migration.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(migration.plugin).toBe('core')
    expect(migration.pluginVersion).toBe('2.5.0')
    expect(migration.dialect).toBe('sqlite')
  })

  it('changing plugin version changes the hash for the same schema', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'a',
        version: '1.0.0',
        entities: [
          {
            name: 'thing',
            tableName: 'things',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    const m1 = await rig.runner.install('a')

    // Re-register with same id but new version (after uninstall).
    await rig.runner.uninstall('a')
    rig.registry.unregister('a')
    rig.registry.register(
      makeFakePlugin({
        id: 'a',
        version: '2.0.0',
        entities: [
          {
            name: 'thing',
            tableName: 'things',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )
    const m2 = await rig.runner.install('a')

    expect(m1.hash).not.toBe(m2.hash)
  })
})

describe('listColumns sanity check', () => {
  it('reports the columns of a created table', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'core',
        entities: [
          {
            name: 'user',
            tableName: 'users',
            fields: {
              id: { type: 'integer', pk: true },
              email: { type: 'string', length: 255 },
              name: { type: 'string', length: 100 },
            },
          },
        ],
      }),
    )
    await rig.runner.install('core')
    const columns = await listColumns(rig.storage, 'core_users')
    expect(columns).toEqual(expect.arrayContaining(['id', 'email', 'name']))
  })
})
