/**
 * OwnershipTracker — pure-function tests.
 *
 * Coverage focus:
 * - Register / unregister tables and columns
 * - Conflict detection (already-owned reassignment)
 * - Cascade: dropping a table drops its column ownership records
 * - Querying: tablesOwnedBy / extensionsBy / column lookup
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  OwnershipConflictError,
  OwnershipTracker,
} from '../../src/migration'

let tracker: OwnershipTracker

beforeEach(() => {
  tracker = new OwnershipTracker()
})

describe('table ownership', () => {
  it('registers and queries table owner', () => {
    tracker.registerTable('core_users', 'core')
    expect(tracker.tableOwner('core_users')).toBe('core')
  })

  it('returns undefined for unknown table', () => {
    expect(tracker.tableOwner('ghost')).toBeUndefined()
  })

  it('throws on double-registering same table to a different owner', () => {
    tracker.registerTable('core_users', 'core')
    expect(() => tracker.registerTable('core_users', 'shop')).toThrow(
      OwnershipConflictError,
    )
  })

  it('lists tables owned by a plugin', () => {
    tracker.registerTable('core_users', 'core')
    tracker.registerTable('core_sessions', 'core')
    tracker.registerTable('shop_orders', 'shop')
    expect(tracker.tablesOwnedBy('core').sort()).toEqual([
      'core_sessions',
      'core_users',
    ])
    expect(tracker.tablesOwnedBy('shop')).toEqual(['shop_orders'])
    expect(tracker.tablesOwnedBy('ghost')).toEqual([])
  })

  it('unregisterTable removes ownership', () => {
    tracker.registerTable('core_users', 'core')
    tracker.unregisterTable('core_users')
    expect(tracker.tableOwner('core_users')).toBeUndefined()
  })
})

describe('column (extension) ownership', () => {
  it('registers and queries column owner', () => {
    tracker.registerTable('core_users', 'core')
    tracker.registerColumn('core_users', 'newsletter_opt_in', 'shop')
    expect(tracker.columnOwner('core_users', 'newsletter_opt_in')).toBe('shop')
  })

  it('returns undefined for unknown column', () => {
    expect(tracker.columnOwner('core_users', 'ghost')).toBeUndefined()
  })

  it('throws on double-registering same (table, column) to a different owner', () => {
    tracker.registerColumn('core_users', 'bio', 'shop')
    expect(() => tracker.registerColumn('core_users', 'bio', 'blog')).toThrow(
      OwnershipConflictError,
    )
  })

  it('unregisterColumn removes only that column', () => {
    tracker.registerColumn('core_users', 'bio', 'shop')
    tracker.registerColumn('core_users', 'website', 'shop')
    tracker.unregisterColumn('core_users', 'bio')
    expect(tracker.columnOwner('core_users', 'bio')).toBeUndefined()
    expect(tracker.columnOwner('core_users', 'website')).toBe('shop')
  })

  it('extensionsBy returns columns added to OTHER plugins\' tables', () => {
    tracker.registerTable('core_users', 'core')
    tracker.registerTable('shop_orders', 'shop')
    tracker.registerColumn('core_users', 'bio', 'shop') // shop extends core
    tracker.registerColumn('shop_orders', 'tax', 'shop') // shop's own column
    const exts = tracker.extensionsBy('shop')
    expect(exts).toHaveLength(1)
    expect(exts[0]).toMatchObject({
      table: 'core_users',
      column: 'bio',
      owner: 'shop',
    })
  })

  it('extensionsBy excludes columns on tables owned by the same plugin', () => {
    tracker.registerTable('shop_orders', 'shop')
    tracker.registerColumn('shop_orders', 'extra', 'shop')
    expect(tracker.extensionsBy('shop')).toEqual([])
  })
})

describe('cascade behaviour', () => {
  it('unregisterTable cascades — column ownership rows for that table are dropped', () => {
    tracker.registerTable('core_users', 'core')
    tracker.registerColumn('core_users', 'bio', 'shop')
    tracker.registerColumn('core_users', 'website', 'shop')
    tracker.unregisterTable('core_users')
    expect(tracker.columnOwner('core_users', 'bio')).toBeUndefined()
    expect(tracker.columnOwner('core_users', 'website')).toBeUndefined()
  })

  it('cascade does NOT touch column rows on unrelated tables', () => {
    tracker.registerTable('core_users', 'core')
    tracker.registerTable('shop_orders', 'shop')
    tracker.registerColumn('core_users', 'bio', 'shop')
    tracker.registerColumn('shop_orders', 'tax', 'shop')
    tracker.unregisterTable('core_users')
    expect(tracker.columnOwner('shop_orders', 'tax')).toBe('shop')
  })
})

describe('snapshot + clear', () => {
  it('snapshot exposes all ownership entries', () => {
    tracker.registerTable('core_users', 'core')
    tracker.registerColumn('core_users', 'bio', 'shop')
    const snap = tracker.snapshot()
    expect(snap.tables).toHaveLength(1)
    expect(snap.columns).toHaveLength(1)
    expect(snap.tables[0]).toMatchObject({ table: 'core_users', owner: 'core' })
    expect(snap.columns[0]).toMatchObject({
      table: 'core_users',
      column: 'bio',
      owner: 'shop',
    })
  })

  it('clear empties everything', () => {
    tracker.registerTable('core_users', 'core')
    tracker.registerColumn('core_users', 'bio', 'shop')
    tracker.clear()
    expect(tracker.snapshot()).toEqual({ tables: [], columns: [] })
  })
})
