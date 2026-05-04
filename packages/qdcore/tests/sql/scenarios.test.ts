/**
 * Integration tests — broader scenarios on SQLite.
 *
 * Coverage:
 * - Repository CRUD smoke test (insert/select after install)
 * - Data preservation across plugin install (extension column added,
 *   existing rows still readable, new column NULL by default)
 * - Reinstall lifecycle (install → uninstall → install again)
 * - Conflict detection at runtime (table collision, column collision)
 * - Plugin not yet active is excluded from composition
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestRig, exec, listColumns, makeFakePlugin, type TestRig } from './_helpers'

let rig: TestRig

beforeEach(async () => {
  rig = await createTestRig()
})

afterEach(async () => {
  await rig.cleanup()
})

describe('repository smoke test', () => {
  it('can insert + read rows via raw SQL after install', async () => {
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
            },
          },
        ],
      }),
    )
    await rig.runner.install('core')

    await exec(rig.storage, `INSERT INTO core_users (id, email) VALUES (?, ?)`, [
      1,
      'alice@example.com',
    ])
    const rows = (await exec(
      rig.storage,
      `SELECT id, email FROM core_users WHERE id = ?`,
      [1],
    )) as { id: number; email: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe('alice@example.com')
  })
})

describe('data preservation across extension install', () => {
  it('existing rows are kept; new extension column is NULL', async () => {
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
            },
          },
        ],
      }),
    )
    rig.registry.register(
      makeFakePlugin({
        id: 'nl',
        prefix: 'nl',
        dependencies: [{ id: 'core' }],
        extensions: {
          core_users: {
            opt_in: { type: 'boolean', nullable: true },
          },
        },
      }),
    )
    await rig.runner.install('core')
    await exec(rig.storage, `INSERT INTO core_users (id, email) VALUES (1, 'alice@example.com')`)

    await rig.runner.install('nl')

    const rows = (await exec(
      rig.storage,
      `SELECT id, email, opt_in FROM core_users WHERE id = 1`,
    )) as { id: number; email: string; opt_in: number | null }[]
    expect(rows[0].email).toBe('alice@example.com')
    expect(rows[0].opt_in).toBeNull() // not yet set, default null
  })

  it('extension column drop preserves the rest of the row', async () => {
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
            },
          },
        ],
      }),
    )
    rig.registry.register(
      makeFakePlugin({
        id: 'nl',
        prefix: 'nl',
        dependencies: [{ id: 'core' }],
        extensions: {
          core_users: {
            opt_in: { type: 'boolean', nullable: true, default: true },
          },
        },
      }),
    )
    await rig.runner.install('core')
    await rig.runner.install('nl')
    await exec(
      rig.storage,
      `INSERT INTO core_users (id, email, opt_in) VALUES (1, 'a@example.com', 1)`,
    )

    await rig.runner.uninstall('nl')

    const cols = await listColumns(rig.storage, 'core_users')
    expect(cols).not.toContain('opt_in')

    const rows = (await exec(
      rig.storage,
      `SELECT id, email FROM core_users WHERE id = 1`,
    )) as { id: number; email: string }[]
    expect(rows[0].email).toBe('a@example.com')
  })
})

describe('reinstall lifecycle', () => {
  it('install → uninstall → install again works', async () => {
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
    await rig.runner.install('core')
    expect(rig.registry.get('core')?.state).toBe('installed')
    expect(await rig.runner.appliedFor('core')).toHaveLength(1)
  })
})

describe('runtime conflict detection (composer)', () => {
  // Note: same-prefix collisions are caught at register time by the
  // PluginRegistry (covered in pure-function tests). Same-tableName-with-
  // different-prefixes is normalised by the composer (each gets its own
  // prefix prepended). The runtime-relevant collision case is column-level
  // when two plugins extend the same foreign table — covered below.

  it('refuses install when two extensions add the same column', async () => {
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
    rig.registry.register(
      makeFakePlugin({
        id: 'a',
        prefix: 'a',
        dependencies: [{ id: 'core' }],
        extensions: {
          core_users: { bio: { type: 'text', nullable: true } },
        },
      }),
    )
    rig.registry.register(
      makeFakePlugin({
        id: 'b',
        prefix: 'b',
        dependencies: [{ id: 'core' }],
        extensions: {
          core_users: { bio: { type: 'text', nullable: true } }, // collision
        },
      }),
    )
    await rig.runner.install('core')
    await rig.runner.install('a')
    await expect(rig.runner.install('b')).rejects.toThrow(
      /column "core_users\.bio" claimed by both/,
    )
  })
})

describe('inactive plugins are excluded from composition', () => {
  it('a registered-but-not-installed plugin does not affect the schema', async () => {
    rig.registry.register(
      makeFakePlugin({
        id: 'a',
        prefix: 'a',
        entities: [
          {
            name: 'foo',
            tableName: 'foos',
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
            name: 'bar',
            tableName: 'bars',
            fields: { id: { type: 'integer', pk: true } },
          },
        ],
      }),
    )

    await rig.runner.install('a')
    // 'b' is registered but never installed; it should not appear in DB.
    expect(await listColumns(rig.storage, 'a_foos')).toContain('id')
    // PRAGMA table_info() returns empty for non-existent tables (doesn't throw).
    expect(await listColumns(rig.storage, 'b_bars')).toEqual([])
  })
})
