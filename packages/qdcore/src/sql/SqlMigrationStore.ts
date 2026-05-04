/**
 * SqlMigrationStore — MigrationStore impl over a SQL connection.
 *
 * Persists which (plugin, hash) pairs have been applied. The system table
 * is named `qdcms_schema_state` and is created by `init()` on first use
 * (idempotent — uses CREATE TABLE IF NOT EXISTS, dialect-portable).
 *
 * Schema:
 *   qdcms_schema_state
 *     plugin       TEXT NOT NULL
 *     hash         TEXT NOT NULL
 *     applied_at   TEXT NOT NULL  (ISO-8601)
 *     PRIMARY KEY (plugin, hash)
 *
 * Use ANSI SQL only here so the same code works for SQLite/MariaDB/Postgres.
 * If a dialect needs a special variant later we add a strategy hook.
 */

import { EntitySchema } from '@mikro-orm/core'
import type { Migration, MigrationStore } from '../migration/types'
import { MikroOrmBackendStorage } from './MikroOrmBackendStorage'

const TABLE = 'qdcms_schema_state'

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    plugin TEXT NOT NULL,
    hash TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    PRIMARY KEY (plugin, hash)
  )
`

/**
 * The MikroORM EntitySchema for the system tracking table. Exposed so the
 * runner can include it in the entity set on every reconnect — without
 * this, MikroORM v6 refuses to init with an empty entity list, and a
 * plugin with `schemaManaged: false` would have no other entities to
 * justify the connection.
 *
 * Marking it `extends: undefined` and `discriminatorColumn: undefined`
 * keeps it as a plain table; MikroORM will manage it like any other.
 */
export const SchemaStateEntity = new EntitySchema({
  name: TABLE,
  tableName: TABLE,
  properties: {
    plugin: { type: 'string', primary: true, length: 64 },
    hash: { type: 'string', primary: true, length: 64 },
    applied_at: { type: 'string', length: 32, fieldName: 'applied_at' },
  },
})

export class SqlMigrationStore implements MigrationStore {
  constructor(private storage: MikroOrmBackendStorage) {}

  async init(): Promise<void> {
    const orm = this.storage.getOrm()
    await orm.em.getConnection().execute(CREATE_TABLE_SQL)
  }

  async record(migration: Migration): Promise<void> {
    const orm = this.storage.getOrm()
    const now = new Date().toISOString()
    await orm.em.getConnection().execute(
      `INSERT INTO ${TABLE} (plugin, hash, applied_at) VALUES (?, ?, ?)`,
      [migration.plugin, migration.hash, now],
    )
  }

  async unrecord(plugin: string, hash: string): Promise<void> {
    const orm = this.storage.getOrm()
    await orm.em.getConnection().execute(
      `DELETE FROM ${TABLE} WHERE plugin = ? AND hash = ?`,
      [plugin, hash],
    )
  }

  async appliedFor(plugin: string): Promise<{ hash: string; appliedAt: Date }[]> {
    const orm = this.storage.getOrm()
    const rows = (await orm.em.getConnection().execute<
      { hash: string; applied_at: string }[]
    >(
      `SELECT hash, applied_at FROM ${TABLE} WHERE plugin = ? ORDER BY applied_at ASC`,
      [plugin],
    )) as { hash: string; applied_at: string }[]
    return rows.map((r: { hash: string; applied_at: string }) => ({
      hash: r.hash,
      appliedAt: new Date(r.applied_at),
    }))
  }

  async isApplied(plugin: string, hash: string): Promise<boolean> {
    const orm = this.storage.getOrm()
    const rows = await orm.em.getConnection().execute<{ count: number }[]>(
      `SELECT COUNT(*) AS count FROM ${TABLE} WHERE plugin = ? AND hash = ?`,
      [plugin, hash],
    )
    const c = rows[0]?.count ?? 0
    return Number(c) > 0
  }
}
