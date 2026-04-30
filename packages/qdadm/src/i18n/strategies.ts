/**
 * Built-in key strategies — named sets of pattern aliases.
 *
 * - `global`  : default. Routes common concepts (actions, timestamps, errors)
 *               from `entities.*.…` to `core.…`. Maximum DRY.
 * - `module`  : routes from `entities.*.…` to `modules.*.…`. Useful when you
 *               want module-wide overrides without touching every entity.
 *               Requires the kernel/registry to know which module owns each
 *               entity (handled by I18n via module → entities mapping).
 * - `entity`  : empty. Every entity owns its labels. No magic.
 *
 * Strategies are stacked: passing `['global', 'ecommerce']` concatenates
 * patterns from both, in order. Longest-match still wins at resolve time.
 */

import type { AliasPattern, KeyStrategy } from './types'

const globalAliases: AliasPattern[] = [
  // CRUD actions: entities.<entity>.actions.<action> → core.actions.<action>
  { pattern: 'entities.*.actions.*', target: 'core.actions.$2' },
  // Common timestamp/id fields
  { pattern: 'entities.*.fields.id', target: 'core.fields.id' },
  { pattern: 'entities.*.fields.created_at', target: 'core.fields.created_at' },
  { pattern: 'entities.*.fields.updated_at', target: 'core.fields.updated_at' },
  { pattern: 'entities.*.fields.created_by', target: 'core.fields.created_by' },
  { pattern: 'entities.*.fields.updated_by', target: 'core.fields.updated_by' },
  // Validation errors: entities.<entity>.errors.<error> → core.errors.<error>
  { pattern: 'entities.*.errors.*', target: 'core.errors.$2' },
]

export const STRATEGIES: Record<string, KeyStrategy> = {
  global: { name: 'global', patterns: globalAliases },
  module: {
    name: 'module',
    // Note: 'module' aliases are emitted dynamically by I18n when it knows the
    // entity → module mapping. The static pattern set is empty here; runtime
    // wiring fills it. Kept as an entry so the name resolves.
    patterns: [],
  },
  entity: { name: 'entity', patterns: [] },
}

/**
 * Resolve one or more strategy names into a flat list of patterns.
 * Unknown names are silently ignored (caller may warn).
 */
export function resolveStrategy(names: string | string[]): AliasPattern[] {
  const list = Array.isArray(names) ? names : [names]
  const out: AliasPattern[] = []
  for (const n of list) {
    const s = STRATEGIES[n]
    if (s) out.push(...s.patterns)
  }
  return out
}

/**
 * Register a custom strategy. Useful for project-level conventions.
 */
export function defineStrategy(name: string, patterns: AliasPattern[]): void {
  STRATEGIES[name] = { name, patterns: [...patterns] }
}
