/**
 * @quazardous/qdcore/plugin — plugin framework contracts.
 *
 * Pure types and minimal interfaces. The PluginRegistry implementation
 * lives in `./PluginRegistry.ts`; lifecycle execution lives in higher
 * layers (qdcms backend, qdadm) that compose with the migration runner
 * and storage.
 *
 * **Agnostic** — this module knows nothing about CMS/admin concepts. It
 * does NOT carry "block", "placement", "layout", "module", or any other
 * domain-specific notion. Consuming apps extend the `Plugin` interface
 * with their own scope declarations (e.g. `QdcmsPlugin extends Plugin`).
 */

import type { EntityDescriptor } from '../entity/types'
import type { SignalBus } from '../signal/SignalBus'

// ─── Manifest (declarative scope) ─────────────────────────────────────────

/**
 * Sem-ver version string. Validated at registry time via {@link isValidSemver}.
 */
export type PluginVersion = string

/**
 * Plugin id. Lowercase, snake-case-ish: `core`, `dynamic_content`, `my-shop`.
 *
 * Validated against `/^[a-z][a-z0-9_-]*$/` at registry time.
 */
export type PluginId = string

/**
 * Plugin prefix used to namespace tables (e.g. `dc` → tables `dc_posts`).
 *
 * Must be `/^[a-z][a-z0-9_]*$/`. Cannot contain `-` (would break table
 * naming on some dialects). Two plugins with the same prefix is a hard
 * conflict — the registry refuses to load the second.
 */
export type PluginPrefix = string

export interface PluginDependency {
  /** Plugin id required. */
  id: PluginId
  /**
   * Sem-ver range. Defaults to `'*'` (any version).
   * Examples: `'^1.0.0'`, `'>=2.3.0'`, `'1.x'`.
   */
  version?: string
}

/**
 * The minimum description any plugin must provide. Higher layers extend
 * this with their own contributions (`blocks`, `apiRoutes`, etc.).
 */
export interface PluginManifest {
  id: PluginId
  version: PluginVersion
  prefix: PluginPrefix
  /** Human-friendly title — surfaced in admin UI / debug bar. */
  title?: string
  /** One-line description. */
  description?: string
  /** Other plugins this one needs to be active. */
  dependencies?: PluginDependency[]
  /**
   * Entity descriptors this plugin contributes (its own tables). The
   * composer prefixes them with `prefix_` and stamps `owner = id`.
   */
  entities?: EntityDescriptor[]
  /**
   * Extensions: columns this plugin adds to other plugins' tables.
   * Indexed by the FULLY-QUALIFIED foreign table name (`core_users`).
   *
   * The extending plugin MUST list the owning plugin in `dependencies`,
   * otherwise the registry rejects the manifest.
   */
  extensions?: Record<string, EntityDescriptor['fields']>
  /**
   * If `false`, qdcms does NOT manage this plugin's schema (no migration
   * generation, no diff at install). Use for plugins that integrate with
   * an externally-managed backend. Default: `true`.
   */
  schemaManaged?: boolean
}

// ─── Lifecycle hooks ──────────────────────────────────────────────────────

export type PluginLifecycleEvent =
  | 'install'
  | 'activate'
  | 'deactivate'
  | 'uninstall'

/**
 * Optional hooks a Plugin can implement. The registry/runner invokes them
 * in the right order during lifecycle transitions. Failing hooks abort the
 * transition (the runner rolls back).
 */
export interface PluginLifecycleHooks {
  install?(ctx: PluginContext): Promise<void> | void
  activate?(ctx: PluginContext): Promise<void> | void
  deactivate?(ctx: PluginContext): Promise<void> | void
  uninstall?(ctx: PluginContext): Promise<void> | void
}

// ─── Plugin (manifest + hooks bundle) ─────────────────────────────────────

/**
 * The runtime plugin object. Apps may extend this interface to declare
 * domain-specific contributions (qdcms: blocks/placements/layouts/...).
 *
 * The fact that this is `extends PluginLifecycleHooks` means a Plugin
 * *can* carry hook methods directly; alternatively the host can attach
 * them dynamically via `registry.setHooks(id, hooks)`.
 */
export interface Plugin extends PluginLifecycleHooks {
  manifest: PluginManifest
}

// ─── Context injected to lifecycle hooks ──────────────────────────────────

/**
 * Provided by the registry/runner to every lifecycle hook. The shape is
 * intentionally narrow — broader contexts (e.g. with a `BackendStorage`
 * or `EntityManager`) are passed by extending this in higher layers.
 */
export interface PluginContext {
  /** The plugin currently running its hook. */
  plugin: Plugin
  /** Shared signal bus. Plugins use it to emit/subscribe to global signals. */
  signals: SignalBus
  /**
   * Generic key-value bag the host can use to inject domain-specific
   * services (storage, logger, locale, etc.) without forcing them into
   * the agnostic core type.
   */
  services: Record<string, unknown>
}

// ─── Lifecycle state (tracked by the registry) ────────────────────────────

export type PluginState =
  | 'registered' // manifest loaded, hooks not yet run
  | 'installed'  // install() succeeded, schema migrated
  | 'active'     // activate() succeeded, plugin is live
  | 'inactive'   // deactivate() succeeded, plugin is paused but installed
  | 'failed'     // a hook threw — needs operator intervention

export interface PluginEntry {
  plugin: Plugin
  state: PluginState
  /**
   * If the entry is in the `failed` state, the error that caused it.
   * Cleared on the next successful transition.
   */
  lastError?: Error
}

// ─── Registry contract ────────────────────────────────────────────────────

/**
 * The plugin registry contract.
 *
 * **qdcore ships a minimal reference implementation** (`InMemoryPluginRegistry`)
 * suitable for tests and small apps. **Hosts SHOULD provide their own
 * implementation** for production. Typical qdcms-backend impl:
 *
 * - Loads "available plugins" from a YAML config file (declared by the project)
 * - Reads a DB table for runtime overrides (which available plugins are
 *   enabled, per-plugin user config) — typically managed via admin UI
 * - Persists state changes (`setState`) to the same DB table
 * - Composes both sources into the in-memory registry shape
 *
 * The contract is the same — only the persistence and discovery strategies
 * differ. Consumer code (MigrationRunner, admin UI, debug bar) should
 * always type against this interface, never against the concrete impl.
 */
export interface PluginRegistry {
  /**
   * Add a plugin. Throws on:
   * - invalid manifest (PluginValidationError)
   * - duplicate id or prefix collision (PluginConflictError)
   */
  register(plugin: Plugin): void

  /** Remove a plugin. Throws if other plugins depend on it. */
  unregister(id: PluginId): void

  has(id: PluginId): boolean
  get(id: PluginId): PluginEntry | undefined
  list(): PluginEntry[]
  manifests(): PluginManifest[]

  /**
   * Update tracked state for a plugin. Called by the runner after each
   * successful or failed lifecycle transition.
   */
  setState(id: PluginId, state: PluginState, lastError?: Error): void

  /**
   * Topological sort: returns plugin ids in install order. Throws on
   * missing dependencies and dependency cycles.
   */
  resolveOrder(): PluginId[]

  /**
   * Cross-plugin extension validation: every extension's target table
   * owner must be a declared dependency of the extending plugin.
   */
  validateExtensions(): void

  /**
   * Resolve which plugin owns a fully-prefixed physical table name.
   * Returns undefined when no registered plugin owns the table.
   */
  findTableOwner(physicalTableName: string): PluginId | undefined
}

// ─── Errors ───────────────────────────────────────────────────────────────

export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginId?: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'PluginError'
  }
}

export class PluginConflictError extends PluginError {
  constructor(message: string, pluginId: string) {
    super(message, pluginId)
    this.name = 'PluginConflictError'
  }
}

export class PluginDependencyError extends PluginError {
  constructor(message: string, pluginId: string) {
    super(message, pluginId)
    this.name = 'PluginDependencyError'
  }
}

export class PluginValidationError extends PluginError {
  constructor(message: string, pluginId?: string) {
    super(message, pluginId)
    this.name = 'PluginValidationError'
  }
}
