/**
 * Integration tests — multi-plugin schema extensions on SQLite.
 *
 * The hard part of a plugin-based migration system: when plugin B adds a
 * column to plugin A's table, then is uninstalled, only B's column drops.
 *
 * Coverage:
 * - Extension creates the column on the foreign table
 * - Uninstalling the extending plugin drops only its column
 * - Owner of the foreign table stays present
 * - Multiple plugins extending the same table coexist
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

const corePlugin = () =>
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
  })

const newsletterPlugin = () =>
  makeFakePlugin({
    id: 'newsletter',
    prefix: 'nl',
    dependencies: [{ id: 'core' }],
    extensions: {
      core_users: {
        newsletter_opt_in: { type: 'boolean', nullable: true },
      },
    },
  })

const profilePlugin = () =>
  makeFakePlugin({
    id: 'profile',
    prefix: 'pf',
    dependencies: [{ id: 'core' }],
    extensions: {
      core_users: {
        bio: { type: 'text', nullable: true },
        website: { type: 'string', length: 255, nullable: true },
      },
    },
  })

describe('extension installation', () => {
  it('adds the extension column to the foreign table', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())

    await rig.runner.install('core')
    expect(await listColumns(rig.storage, 'core_users')).toEqual(
      expect.arrayContaining(['id', 'email']),
    )
    expect(await listColumns(rig.storage, 'core_users')).not.toContain(
      'newsletter_opt_in',
    )

    await rig.runner.install('newsletter')
    expect(await listColumns(rig.storage, 'core_users')).toContain(
      'newsletter_opt_in',
    )
  })

  it('does NOT create a separate table for the extending plugin (no entities)', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    await rig.runner.install('core')
    await rig.runner.install('newsletter')

    const tables = await listTables(rig.storage)
    // newsletter has no own entities, so no nl_* table.
    expect(tables.filter((t) => t.startsWith('nl_'))).toEqual([])
  })

  it('refuses to install the extending plugin before its dependency', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    await expect(rig.runner.install('newsletter')).rejects.toThrow(
      /dependency "core" is not installed/,
    )
  })
})

describe('extension uninstallation', () => {
  it('drops only the extension column on uninstall, keeps the table', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    await rig.runner.install('core')
    await rig.runner.install('newsletter')

    expect(await listColumns(rig.storage, 'core_users')).toContain(
      'newsletter_opt_in',
    )

    await rig.runner.uninstall('newsletter')

    const cols = await listColumns(rig.storage, 'core_users')
    expect(cols).not.toContain('newsletter_opt_in')
    expect(cols).toEqual(expect.arrayContaining(['id', 'email']))
    expect(await listTables(rig.storage)).toContain('core_users')
  })

  it('refuses uninstall of dependency while extender is still installed', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    await rig.runner.install('core')
    await rig.runner.install('newsletter')

    await expect(rig.runner.uninstall('core')).rejects.toThrow(
      /"newsletter" depends on it/,
    )
  })

  it('cascade uninstall (extender first, then dep) succeeds', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    await rig.runner.install('core')
    await rig.runner.install('newsletter')

    await rig.runner.uninstall('newsletter')
    await rig.runner.uninstall('core')

    expect(await listTables(rig.storage)).not.toContain('core_users')
  })
})

describe('multiple plugins extending the same table', () => {
  it('two extenders coexist — both columns are present', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    rig.registry.register(profilePlugin())

    await rig.runner.install('core')
    await rig.runner.install('newsletter')
    await rig.runner.install('profile')

    const cols = await listColumns(rig.storage, 'core_users')
    expect(cols).toContain('newsletter_opt_in')
    expect(cols).toContain('bio')
    expect(cols).toContain('website')
  })

  it('uninstalling one extender drops only its columns, leaves the other intact', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    rig.registry.register(profilePlugin())

    await rig.runner.install('core')
    await rig.runner.install('newsletter')
    await rig.runner.install('profile')

    await rig.runner.uninstall('newsletter')

    const cols = await listColumns(rig.storage, 'core_users')
    expect(cols).not.toContain('newsletter_opt_in')
    // Profile's columns should remain.
    expect(cols).toContain('bio')
    expect(cols).toContain('website')
    // Core's own columns intact.
    expect(cols).toContain('id')
    expect(cols).toContain('email')
  })
})

describe('install order via registry.resolveOrder()', () => {
  it('produces the correct topological order for dep chain', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    rig.registry.register(profilePlugin())

    const order = rig.registry.resolveOrder()
    expect(order.indexOf('core')).toBeLessThan(order.indexOf('newsletter'))
    expect(order.indexOf('core')).toBeLessThan(order.indexOf('profile'))
  })

  it('full pipeline: register all → resolveOrder → install in order', async () => {
    rig.registry.register(corePlugin())
    rig.registry.register(newsletterPlugin())
    rig.registry.register(profilePlugin())
    rig.registry.validateExtensions()

    for (const id of rig.registry.resolveOrder()) {
      await rig.runner.install(id)
    }

    const tables = await listTables(rig.storage)
    expect(tables).toContain('core_users')
    const cols = await listColumns(rig.storage, 'core_users')
    expect(cols).toContain('newsletter_opt_in')
    expect(cols).toContain('bio')
  })
})
