/**
 * InMemoryPluginRegistry — minimal reference implementation of the
 * `PluginRegistry` contract.
 *
 * **Use this for tests, prototypes, and small apps.** Production hosts
 * (qdcms-backend, qdadm) should ship their own implementation that:
 * - loads available plugins from YAML config (project-declared)
 * - reads a DB table for runtime overrides (which available plugins are
 *   enabled, per-plugin user config) — admin UI manageable
 * - persists state changes (`setState`) back to the same DB table
 *
 * The contract surface is identical (same `PluginRegistry` interface);
 * only the persistence and discovery strategies differ.
 *
 * Responsibilities of THIS implementation (Phase 1a — pure):
 * - Register plugins with manifest validation
 * - Detect prefix collisions and id duplicates
 * - Resolve install order via topological sort over `dependencies`
 * - Detect dependency cycles (DFS three-color coloring)
 * - Detect missing dependencies
 * - Expose ownership queries (which plugin owns which entity / extends which table)
 *
 * NOT in scope here (deferred to higher layers):
 * - Actually running install/activate hooks (= MigrationRunner job)
 * - Wiring `PluginContext.services` (= host job)
 * - Loading manifests from YAML (= CLI / loader job)
 * - Persisting state across reboots (= host job)
 */

import {
  Plugin,
  PluginConflictError,
  PluginDependencyError,
  PluginEntry,
  PluginId,
  type PluginManifest,
  type PluginRegistry,
  PluginState,
} from './types'
import { validateManifest } from './validation'

export class InMemoryPluginRegistry implements PluginRegistry {
  private entries = new Map<PluginId, PluginEntry>()

  /**
   * Register a plugin (manifest-only at this stage; lifecycle is the
   * runner's job). Throws on:
   * - invalid manifest (PluginValidationError, via validateManifest)
   * - duplicate id (PluginConflictError)
   * - prefix collision with an already-registered plugin (PluginConflictError)
   * - extension to an unknown table whose owner is not in `dependencies`
   *   (PluginDependencyError) — only validated if the dependency is
   *   already registered; cross-plugin checks happen on `resolveOrder`.
   */
  register(plugin: Plugin): void {
    validateManifest(plugin.manifest)
    const { id, prefix } = plugin.manifest

    if (this.entries.has(id)) {
      throw new PluginConflictError(
        `plugin "${id}" is already registered`,
        id,
      )
    }
    for (const [otherId, entry] of this.entries) {
      if (entry.plugin.manifest.prefix === prefix) {
        throw new PluginConflictError(
          `plugin "${id}" prefix "${prefix}" collides with plugin "${otherId}"`,
          id,
        )
      }
    }

    this.entries.set(id, { plugin, state: 'registered' })
  }

  /** Remove a plugin from the registry. No lifecycle action — purely table-level. */
  unregister(id: PluginId): void {
    if (!this.entries.has(id)) {
      throw new PluginDependencyError(
        `cannot unregister "${id}": not registered`,
        id,
      )
    }
    // Refuse if any other plugin depends on this one.
    for (const [otherId, entry] of this.entries) {
      if (otherId === id) continue
      if (entry.plugin.manifest.dependencies?.some((d) => d.id === id)) {
        throw new PluginDependencyError(
          `cannot unregister "${id}": "${otherId}" depends on it`,
          id,
        )
      }
    }
    this.entries.delete(id)
  }

  has(id: PluginId): boolean {
    return this.entries.has(id)
  }

  get(id: PluginId): PluginEntry | undefined {
    return this.entries.get(id)
  }

  list(): PluginEntry[] {
    return Array.from(this.entries.values())
  }

  /** All known plugin manifests, in registration order. */
  manifests(): PluginManifest[] {
    return this.list().map((e) => e.plugin.manifest)
  }

  // ─── State transitions (pure book-keeping; runner drives them) ──────────

  setState(id: PluginId, state: PluginState, lastError?: Error): void {
    const entry = this.entries.get(id)
    if (!entry) {
      throw new PluginDependencyError(`unknown plugin "${id}"`, id)
    }
    entry.state = state
    if (state === 'failed') {
      entry.lastError = lastError
    } else {
      delete entry.lastError
    }
  }

  // ─── Dependency resolution ──────────────────────────────────────────────

  /**
   * Topological sort: returns plugin ids in the order they must be
   * installed (a plugin appears after all its dependencies). Throws on
   * missing deps and on cycles.
   *
   * Algorithm: DFS with three-color marking (white/gray/black). Gray on
   * re-visit = cycle. White = unvisited.
   */
  resolveOrder(): PluginId[] {
    const order: PluginId[] = []
    const color = new Map<PluginId, 'white' | 'gray' | 'black'>()
    for (const id of this.entries.keys()) color.set(id, 'white')

    const visit = (id: PluginId, stack: PluginId[]): void => {
      const c = color.get(id)
      if (c === 'black') return
      if (c === 'gray') {
        const cyclePath = [...stack, id].join(' → ')
        throw new PluginDependencyError(
          `dependency cycle detected: ${cyclePath}`,
          id,
        )
      }
      color.set(id, 'gray')
      const deps = this.entries.get(id)?.plugin.manifest.dependencies ?? []
      for (const dep of deps) {
        if (!this.entries.has(dep.id)) {
          throw new PluginDependencyError(
            `plugin "${id}" depends on "${dep.id}" which is not registered`,
            id,
          )
        }
        visit(dep.id, [...stack, id])
      }
      color.set(id, 'black')
      order.push(id)
    }

    for (const id of this.entries.keys()) visit(id, [])
    return order
  }

  /**
   * Cross-plugin extension validation: every extension target must be a
   * table owned by a plugin that's a declared dependency. Run this AFTER
   * all plugins are registered (typically as part of `resolveOrder`'s
   * caller flow).
   */
  validateExtensions(): void {
    for (const entry of this.entries.values()) {
      const m = entry.plugin.manifest
      if (!m.extensions) continue
      const declaredDeps = new Set(
        (m.dependencies ?? []).map((d) => d.id),
      )
      for (const tableName of Object.keys(m.extensions)) {
        // Find which registered plugin owns this table (by entity tableName,
        // post-prefix). Extension target convention: `<prefix>_<entityTable>`.
        const ownerId = this.findTableOwner(tableName)
        if (!ownerId) {
          throw new PluginDependencyError(
            `plugin "${m.id}" extends unknown table "${tableName}"`,
            m.id,
          )
        }
        if (ownerId === m.id) {
          // Extending its own table is a no-op vs. just declaring fields
          // — flag as a manifest mistake.
          throw new PluginDependencyError(
            `plugin "${m.id}" cannot extend its own table "${tableName}" — declare fields directly on the entity instead`,
            m.id,
          )
        }
        if (!declaredDeps.has(ownerId)) {
          throw new PluginDependencyError(
            `plugin "${m.id}" extends "${tableName}" (owned by "${ownerId}") but does not declare it as a dependency`,
            m.id,
          )
        }
      }
    }
  }

  /**
   * Resolve the plugin id that owns a fully-prefixed table name. Looks at
   * each plugin's `entities[*].tableName` after prefixing.
   *
   * Naming convention enforced here: physical name = `${prefix}_${entityTable}`
   * unless the entity's `tableName` already starts with `${prefix}_`.
   */
  findTableOwner(physicalTableName: string): PluginId | undefined {
    for (const entry of this.entries.values()) {
      const m = entry.plugin.manifest
      const prefix = m.prefix
      for (const ent of m.entities ?? []) {
        const physical = ent.tableName.startsWith(`${prefix}_`)
          ? ent.tableName
          : `${prefix}_${ent.tableName}`
        if (physical === physicalTableName) return m.id
      }
    }
    return undefined
  }
}
