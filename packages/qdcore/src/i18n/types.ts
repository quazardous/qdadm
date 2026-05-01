/**
 * i18n - Type definitions
 *
 * See docs/todo-i18n.md for the design.
 *
 * Core thesis: the entity/field schema IS the i18n key source. Keys are
 * derived from module/entity/field names by convention, not hand-written.
 * Providers only supply overrides.
 */

/**
 * A nested-object bundle of translations for a single locale.
 *
 * Shape mirrors the convention key paths:
 *   entities.{entity}.label
 *   entities.{entity}.fields.{field}
 *   nav.routes.{route}
 *   core.actions.{save|cancel|...}
 *
 * Leaf values are strings. A leaf starting with '@' is an alias to another key.
 * An object can mix children with a `_label` shorthand for its own value
 * (useful when a node also needs sub-keys).
 */
export type MessagesBundle = {
  entities?: Record<string, EntityMessages>
  nav?: NavMessages
  core?: CoreMessages
  modules?: Record<string, MessagesNode>
  aliases?: AliasPattern[]
  [namespace: string]: unknown
}

export type MessagesNode =
  | string
  | { _label?: string; [key: string]: unknown }

export interface EntityMessages {
  label?: string
  labelPlural?: string
  fields?: Record<string, MessagesNode>
  groups?: Record<string, string>
  actions?: Record<string, string>
  errors?: Record<string, string>
  [extra: string]: unknown
}

export interface NavMessages {
  sections?: Record<string, string>
  routes?: Record<string, string>
  [extra: string]: unknown
}

export interface CoreMessages {
  actions?: Record<string, string>
  fields?: Record<string, string>
  messages?: Record<string, string>
  errors?: Record<string, string>
  [extra: string]: unknown
}

/**
 * A pattern alias: rewrites a lookup key to another key when matched.
 * `pattern` supports `*` wildcards (one segment each).
 * `target` may reference captures via `$1`, `$2`, … (1-indexed left to right).
 *
 * Example:
 *   { pattern: 'entities.*.actions.*', target: 'core.actions.$2' }
 */
export interface AliasPattern {
  pattern: string
  target: string
}

/**
 * Minimal contract for any translation backend.
 *
 * `load()` is the only required method. `availableLocales`, `save`, `watch`
 * are optional and reported via capability flags.
 */
export interface TranslationProvider {
  readonly name: string
  load(locale: string): Promise<MessagesBundle> | MessagesBundle
  availableLocales?(): string[] | Promise<string[]>
  save?(locale: string, bundle: MessagesBundle): Promise<void>
  watch?(locale: string, cb: (bundle: MessagesBundle) => void): () => void
}

/**
 * Parameters passed to the resolver for `{placeholder}` interpolation.
 */
export type TranslateParams = Record<string, string | number | boolean | null | undefined>

/**
 * Trace of a resolution attempt. Returned by `kernel.i18n.resolve(key)`.
 * Useful for debugging "why isn't this label translating?".
 */
export interface ResolveTrace {
  key: string
  locale: string
  steps: ResolveStep[]
  result: string
  hit: boolean
}

export type ResolveStep =
  | { kind: 'lookup'; locale: string; key: string; found: boolean }
  | { kind: 'alias-value'; from: string; to: string }
  | { kind: 'alias-pattern'; pattern: string; from: string; to: string }
  | { kind: 'cycle-broken'; at: string }
  | { kind: 'snake-case-fallback'; field: string; result: string }
  | { kind: 'miss'; key: string }

/**
 * Built-in key strategies. A strategy is just a named set of alias patterns.
 *
 * - `global`  : common concepts route to core.* (default, max DRY)
 * - `module`  : route to modules.{module}.* for module-wide overrides
 * - `entity`  : no aliases — every entity owns its labels
 */
export type KeyStrategyName = 'global' | 'module' | 'entity'

export interface KeyStrategy {
  name: string
  patterns: AliasPattern[]
}

/**
 * Generic i18n options shared by any orchestrator built on top of these
 * primitives. Concrete orchestrators (e.g. qdadm's `I18n`) extend this with
 * app-specific options (default core bundle, etc.).
 */
export interface BaseI18nOptions {
  defaultLocale?: string
  fallbackLocale?: string
  keyStrategy?: KeyStrategyName | string | string[]
  providers?: TranslationProvider[]
  /** App-level message bundles, applied per locale. */
  messages?: Record<string, MessagesBundle>
  /** App-level extra alias patterns, appended to the active strategy. */
  aliases?: AliasPattern[]
}
