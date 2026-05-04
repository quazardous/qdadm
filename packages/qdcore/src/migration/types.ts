/**
 * @quazardous/qdcore/migration — migration system contracts.
 *
 * **Node-only**. The migration runner uses `node:crypto`, file I/O, and
 * eventually spawns the schema-diff engine (MikroORM SchemaGenerator
 * subclass). Browser bundles must NOT import from here — use the entity
 * layer (`@quazardous/qdcore/entity`) which is environment-agnostic.
 *
 * Vocabulary (mirrors docs/qdcms-glossary.md):
 *   Migration         — one atomic schema change, identified by hash
 *   MigrationContext  — handle passed to `up`/`down` (driver, dialect, ...)
 *   MigrationRunner   — orchestrator (apply, rollback, status, dry-run)
 *   MigrationStore    — system table tracking applied migrations per plugin
 *   schemaHash        — sha256 over canonical(plugin_id + version + schema + dialect)
 */

import type { EntityDescriptor } from '../entity/types'

// ─── Dialect / target SQL flavour ─────────────────────────────────────────

/**
 * Supported SQL dialects in v1. Add to this union as new BackendStorage
 * implementations land. The hash includes the dialect so each gets its
 * own committed `.up.sql` file.
 */
export type SqlDialect = 'sqlite' | 'mariadb' | 'mysql' | 'postgres'

// ─── Migration descriptor (the unit of work) ──────────────────────────────

/**
 * One migration file. Keep in mind: most plugin authors never write these
 * by hand — they're generated from the YAML schema via `migrate:generate`.
 * The escape hatch is to edit the generated `.up.sql` for data transforms,
 * after which the hash is recomputed from the file content.
 */
export interface Migration {
  /**
   * Plugin id this migration belongs to.
   */
  plugin: string
  /**
   * Plugin version at the time the migration was generated.
   */
  pluginVersion: string
  /**
   * Hash identifying this migration uniquely.
   * @see hashSchema for how this is computed.
   */
  hash: string
  /** Target dialect this migration is written for. */
  dialect: SqlDialect
  /**
   * The forward SQL. Multiple statements separated by `;` — implementations
   * split + execute in order, ideally inside one transaction.
   */
  up: string
  /**
   * The rollback SQL. Same shape as `up`, applied in reverse order.
   * May be empty (irreversible migration) — a runner option decides whether
   * to allow that.
   */
  down: string
}

// ─── Snapshot of one plugin's schema state ────────────────────────────────

/**
 * The "what's currently applied" state for a plugin. Persisted in
 * `<plugin>/.state.json` next to the migrations.
 *
 * The schema field stores the rendered schema (post-templating) at the
 * last generation — used as the baseline for the next diff.
 */
export interface PluginSchemaState {
  pluginId: string
  pluginVersion: string
  /** Hash of the last generated schema — same value as the latest migration's hash. */
  hash: string
  /** Snapshot of the rendered schema (composed entities). Used as diff baseline. */
  schema: ComposedSchema
}

/**
 * A flat description of one plugin's contribution AFTER prefixing and
 * extension merging. The schema composer produces this for each plugin
 * before feeding the diff engine.
 */
export interface ComposedSchema {
  /** Tables this plugin OWNS (created at install, dropped at uninstall). */
  ownedTables: EntityDescriptor[]
  /**
   * Columns this plugin adds to OTHER plugins' tables. Indexed by foreign
   * physical table name. Each field carries `owner = pluginId`.
   */
  extensions: Record<string, EntityDescriptor['fields']>
}

// ─── Runner / Store contracts ─────────────────────────────────────────────

/**
 * Per-application state of all applied migrations. The implementation
 * persists it in the target DB itself (table `qdcms_schema_state`).
 */
export interface MigrationStore {
  /** Initialise the underlying tracking table if needed. Idempotent. */
  init(): Promise<void>
  /** Mark a migration as successfully applied. */
  record(migration: Migration): Promise<void>
  /** Mark a migration as rolled back (removed from applied set). */
  unrecord(plugin: string, hash: string): Promise<void>
  /** All applied hashes for a plugin, in apply order. */
  appliedFor(plugin: string): Promise<{ hash: string; appliedAt: Date }[]>
  /** Has this exact (plugin, hash) already been applied? */
  isApplied(plugin: string, hash: string): Promise<boolean>
}

export interface MigrationContext {
  dialect: SqlDialect
  /**
   * Execute raw SQL against the target DB. Implementations may wrap the
   * call in a transaction depending on options passed to the runner.
   */
  exec(sql: string): Promise<void>
}

/**
 * Apply / rollback / status orchestrator. Implementations typically wrap
 * a `BackendStorage` instance (for SQL exec) and a `MigrationStore`.
 */
export interface MigrationRunner {
  /**
   * Apply all pending migrations for a single plugin, in hash-file order.
   * Skips already-applied ones. Atomic per migration; on failure inside a
   * migration, rolls back that migration's transaction and aborts the
   * remaining queue.
   */
  apply(plugin: string, migrations: Migration[]): Promise<MigrationResult[]>
  /**
   * Roll back the last N applied migrations of a plugin. Default N = 1.
   */
  rollback(plugin: string, count?: number): Promise<MigrationResult[]>
  /**
   * Status report for a plugin: which migrations are applied, which are
   * pending, which are missing from disk (= tampering or rollback).
   */
  status(plugin: string, available: Migration[]): Promise<MigrationStatusEntry[]>
}

export interface MigrationResult {
  hash: string
  ok: boolean
  error?: Error
  durationMs: number
}

export interface MigrationStatusEntry {
  hash: string
  state: 'applied' | 'pending' | 'missing'
  appliedAt?: Date
}

// ─── Errors ───────────────────────────────────────────────────────────────

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly plugin?: string,
    public readonly hash?: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'MigrationError'
  }
}

export class MigrationOwnershipError extends MigrationError {
  constructor(message: string, plugin: string) {
    super(message, plugin)
    this.name = 'MigrationOwnershipError'
  }
}

export class MigrationHashMismatchError extends MigrationError {
  constructor(message: string, plugin: string, hash: string) {
    super(message, plugin, hash)
    this.name = 'MigrationHashMismatchError'
  }
}
