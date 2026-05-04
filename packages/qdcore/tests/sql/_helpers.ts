/**
 * Test helpers for SQL integration tests.
 *
 * Each test gets a fresh in-memory SQLite + a freshly-bootstrapped
 * runner/registry/store/storage stack — total isolation, no leaks.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  InMemoryPluginRegistry,
  type Plugin,
  type PluginManifest,
} from '../../src/plugin'
import {
  MikroOrmBackendStorage,
  MikroOrmMigrationRunner,
  SqlMigrationStore,
} from '../../src/sql'

export interface TestRig {
  storage: MikroOrmBackendStorage
  store: SqlMigrationStore
  registry: InMemoryPluginRegistry
  runner: MikroOrmMigrationRunner
  /**
   * Tear down the in-memory DB. Call from `afterEach`.
   */
  cleanup(): Promise<void>
}

/**
 * Spin up a complete migration stack against a fresh in-memory SQLite.
 * No entities are registered yet — caller adds plugins via `registry.register()`
 * and calls `runner.install()`.
 */
export async function createTestRig(): Promise<TestRig> {
  // We use a temp-file SQLite, NOT `:memory:`. SQLite memory DBs are
  // per-connection — our runner disconnects/reconnects on every
  // schema change (MikroORM v6 metadata is fixed at init), which would
  // wipe the DB between operations and break any data-preservation test.
  // Temp files survive disconnect; teardown rm-rf's the directory.
  const dir = mkdtempSync(join(tmpdir(), 'qdcore-sql-'))
  const dbPath = join(dir, 'test.sqlite')

  const storage = new MikroOrmBackendStorage({
    ormOptions: {
      driver: (await import('@mikro-orm/sqlite')).SqliteDriver,
      dbName: dbPath,
      debug: false,
      allowGlobalContext: true,
    },
    entities: [],
  })

  const store = new SqlMigrationStore(storage)
  const registry = new InMemoryPluginRegistry()
  const runner = new MikroOrmMigrationRunner({
    storage,
    store,
    registry,
    dialect: 'sqlite',
  })

  return {
    storage,
    store,
    registry,
    runner,
    async cleanup() {
      try {
        await storage.disconnect()
      } catch {
        // already disconnected
      }
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // best-effort
      }
    },
  }
}

// ─── Fake plugin builder ──────────────────────────────────────────────────

export interface FakePluginInput {
  id: string
  prefix?: string
  version?: string
  dependencies?: { id: string; version?: string }[]
  entities?: PluginManifest['entities']
  extensions?: PluginManifest['extensions']
  schemaManaged?: boolean
}

export function makeFakePlugin(input: FakePluginInput): Plugin {
  return {
    manifest: {
      id: input.id,
      version: input.version ?? '1.0.0',
      prefix: input.prefix ?? input.id,
      dependencies: input.dependencies,
      entities: input.entities,
      extensions: input.extensions,
      schemaManaged: input.schemaManaged,
    },
  }
}

// ─── DB introspection helpers (raw SQL, dialect-specific) ────────────────

/**
 * SQLite-specific: list all user tables (excludes sqlite_* internal tables).
 */
export async function listTables(storage: MikroOrmBackendStorage): Promise<string[]> {
  const rows = (await storage
    .getOrm()
    .em.getConnection()
    .execute<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )) as { name: string }[]
  return rows.map((r) => r.name)
}

/**
 * SQLite-specific: list columns of a given table.
 * Uses PRAGMA table_info(<table>) — returns column names.
 */
export async function listColumns(
  storage: MikroOrmBackendStorage,
  table: string,
): Promise<string[]> {
  const rows = (await storage
    .getOrm()
    .em.getConnection()
    .execute<{ name: string }[]>(`PRAGMA table_info(${table})`)) as {
    name: string
  }[]
  return rows.map((r) => r.name)
}

/**
 * Convenience: run an arbitrary SQL statement.
 */
export async function exec(
  storage: MikroOrmBackendStorage,
  sql: string,
  params?: unknown[],
): Promise<unknown> {
  return await storage.getOrm().em.getConnection().execute(sql, params)
}
