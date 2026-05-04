/**
 * MikroOrmMigrationRunner — concrete migration orchestrator on top of
 * MikroOrmBackendStorage + SqlMigrationStore + PluginRegistry.
 *
 * Phase 1b strategy (validate architecture, defer file generation):
 *
 * For every install/uninstall, we recompose the FULL desired schema from
 * the currently-installed plugin set and ask MikroORM SchemaGenerator to
 * `updateSchema()` against the live DB. MikroORM's diff engine works out
 * the CREATE/ALTER/DROP statements by comparing target metadata to actual
 * DB state.
 *
 * Why this works without an explicit "partial diff":
 * - Install: target = installed ∪ {new}. MikroORM sees new tables / new
 *   columns and creates them.
 * - Uninstall: target = installed \ {gone}. MikroORM sees missing tables /
 *   missing columns (per metadata) and drops them.
 *
 * The OwnershipTracker is NOT used here for filtering — the composed
 * schema IS the desired state. Ownership is tracked for audit/UI purposes
 * (which plugin contributed what); destructive operations follow naturally.
 *
 * Phase 2 will add: per-plugin migration file generation (`.up.sql` /
 * `.down.sql`), hash-based identity, tampering detection, dev-time CLI.
 * The contract surface stays the same.
 */

import {
  composePluginSchema,
  composeFullSchema,
  hashSchema,
  MigrationError,
  type Migration,
  type SqlDialect,
} from '../migration'
import {
  PluginConflictError,
  PluginDependencyError,
  type Plugin,
  type PluginId,
  type PluginManifest,
  type PluginRegistry,
} from '../plugin'
import { MikroOrmBackendStorage } from './MikroOrmBackendStorage'
import { SqlMigrationStore } from './SqlMigrationStore'

export interface MikroOrmMigrationRunnerOptions {
  storage: MikroOrmBackendStorage
  store: SqlMigrationStore
  registry: PluginRegistry
  /** SQL dialect — for hash computation and future per-dialect file lookup. */
  dialect: SqlDialect
}

export class MikroOrmMigrationRunner {
  private storage: MikroOrmBackendStorage
  private store: SqlMigrationStore
  private registry: PluginRegistry
  private dialect: SqlDialect

  constructor(opts: MikroOrmMigrationRunnerOptions) {
    this.storage = opts.storage
    this.store = opts.store
    this.registry = opts.registry
    this.dialect = opts.dialect
  }

  /**
   * Install a plugin: compute the new full schema, update the DB, record
   * the migration. Idempotent — if the same hash is already applied, no-op.
   *
   * Throws if:
   * - plugin not in registry
   * - any dependency is not currently installed (caller should resolveOrder
   *   and install in topological order)
   * - storage is not connected or fails mid-update
   */
  async install(pluginId: PluginId): Promise<Migration> {
    const entry = this.registry.get(pluginId)
    if (!entry) {
      throw new MigrationError(`unknown plugin "${pluginId}"`, pluginId)
    }
    const manifest = entry.plugin.manifest

    // Verify all declared dependencies are currently installed/active.
    for (const dep of manifest.dependencies ?? []) {
      const depEntry = this.registry.get(dep.id)
      if (!depEntry || (depEntry.state !== 'installed' && depEntry.state !== 'active')) {
        throw new PluginDependencyError(
          `cannot install "${pluginId}": dependency "${dep.id}" is not installed`,
          pluginId,
        )
      }
    }

    const migration = this.buildMigration(manifest)

    // Make sure the storage is connected before any MigrationStore call.
    // First-ever install bootstraps with just the system entities.
    await this.ensureStorageConnected()
    await this.store.init()

    // Idempotence: same plugin+hash already applied → no-op, return record.
    if (await this.store.isApplied(pluginId, migration.hash)) {
      this.registry.setState(pluginId, 'installed')
      return migration
    }

    // Schema-managed = false: skip DB schema work but still track state.
    if (manifest.schemaManaged === false) {
      await this.store.record(migration)
      this.registry.setState(pluginId, 'installed')
      return migration
    }

    // Compose desired state = currently active + this one.
    const activeManifests = this.activeManifests()
    const desiredManifests = [...activeManifests, manifest]
    const desired = composeFullSchema(desiredManifests)

    // Reload MikroORM with new entity set, then ask SchemaGenerator to
    // converge the live DB. Two-step disconnect/reconnect because v6
    // metadata is fixed at init.
    await this.storage.disconnect()
    this.storage.registerEntities(Object.values(desired))
    await this.storage.connect()
    await this.store.init() // ensure system table exists post-reconnect

    try {
      await this.storage
        .getOrm()
        .getSchemaGenerator()
        .updateSchema({ safe: false, dropTables: false })
    } catch (cause) {
      this.registry.setState(pluginId, 'failed', cause as Error)
      throw new MigrationError(
        `install of "${pluginId}" failed during schema update`,
        pluginId,
        migration.hash,
        cause,
      )
    }

    await this.store.record(migration)
    this.registry.setState(pluginId, 'installed')
    return migration
  }

  /**
   * Uninstall a plugin: compute the new full schema (without this one),
   * update the DB (drops the removed tables and extension columns), then
   * unrecord the migration.
   *
   * Throws if:
   * - plugin not installed
   * - any other installed plugin depends on this one (registry refuses)
   */
  async uninstall(pluginId: PluginId): Promise<void> {
    const entry = this.registry.get(pluginId)
    if (!entry) {
      throw new MigrationError(`unknown plugin "${pluginId}"`, pluginId)
    }
    if (entry.state !== 'installed' && entry.state !== 'active') {
      throw new MigrationError(
        `plugin "${pluginId}" is not installed (state=${entry.state})`,
        pluginId,
      )
    }
    // Refuse if any installed plugin depends on this one.
    for (const other of this.registry.list()) {
      if (other.plugin.manifest.id === pluginId) continue
      if (other.state !== 'installed' && other.state !== 'active') continue
      const depends = other.plugin.manifest.dependencies?.some((d) => d.id === pluginId)
      if (depends) {
        throw new PluginConflictError(
          `cannot uninstall "${pluginId}": "${other.plugin.manifest.id}" depends on it`,
          pluginId,
        )
      }
    }

    const manifest = entry.plugin.manifest

    // Make sure storage is connected so the store table is reachable.
    await this.ensureStorageConnected()
    await this.store.init()

    // Schema-managed = false: skip DB schema work, just unrecord.
    if (manifest.schemaManaged === false) {
      const lastHash = await this.lastAppliedHash(pluginId)
      if (lastHash) await this.store.unrecord(pluginId, lastHash)
      this.registry.setState(pluginId, 'registered')
      return
    }

    // Compose desired state = active minus this one.
    const remainingManifests = this.activeManifests().filter(
      (m) => m.id !== pluginId,
    )
    const desired = composeFullSchema(remainingManifests)

    await this.storage.disconnect()
    this.storage.registerEntities(Object.values(desired))
    await this.storage.connect()
    await this.store.init()

    try {
      await this.storage
        .getOrm()
        .getSchemaGenerator()
        .updateSchema({ safe: false, dropTables: true })
    } catch (cause) {
      this.registry.setState(pluginId, 'failed', cause as Error)
      throw new MigrationError(
        `uninstall of "${pluginId}" failed during schema update`,
        pluginId,
        undefined,
        cause,
      )
    }

    const lastHash = await this.lastAppliedHash(pluginId)
    if (lastHash) await this.store.unrecord(pluginId, lastHash)
    this.registry.setState(pluginId, 'registered')
  }

  /** Status query: per-plugin applied hashes. */
  async appliedFor(pluginId: PluginId): Promise<string[]> {
    const rows = await this.store.appliedFor(pluginId)
    return rows.map((r) => r.hash)
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private activeManifests(): PluginManifest[] {
    return this.registry
      .list()
      .filter((e) => e.state === 'installed' || e.state === 'active')
      .map((e) => e.plugin.manifest)
  }

  private buildMigration(manifest: PluginManifest): Migration {
    const composed = composePluginSchema(manifest)
    const hash = hashSchema({
      pluginId: manifest.id,
      pluginVersion: manifest.version,
      schema: composed,
      dialect: this.dialect,
    })
    return {
      plugin: manifest.id,
      pluginVersion: manifest.version,
      hash,
      dialect: this.dialect,
      // .up / .down deferred to Phase 2 (file generation via SchemaGenerator
      // diff captured at dev-time instead of regenerated at runtime).
      up: '',
      down: '',
    }
  }

  private async lastAppliedHash(pluginId: PluginId): Promise<string | null> {
    const rows = await this.store.appliedFor(pluginId)
    return rows.length > 0 ? rows[rows.length - 1].hash : null
  }

  /**
   * Lazy connect — the storage requires non-empty entities at init, so we
   * defer connection until the first install/uninstall. Subsequent calls
   * reconnect with updated entity sets.
   */
  private async ensureStorageConnected(): Promise<void> {
    try {
      this.storage.getOrm()
      // Already connected — nothing to do.
    } catch {
      await this.storage.connect()
    }
  }
}

// Re-export for convenient typing on the consumer side.
export type { Plugin } from '../plugin'
