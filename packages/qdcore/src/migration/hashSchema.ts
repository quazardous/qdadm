/**
 * Schema hashing — the core of migration identity and tampering detection.
 *
 * Two hashes are computed:
 *
 *   schemaHash    — sha256(plugin_id + plugin_version + canonical(schema_template) + dialect)
 *                   Stable as long as the YAML template and the dialect target are the same.
 *                   Used to find the committed `.up.sql` file for a given plugin version.
 *
 *   effectiveHash — sha256(plugin_id + plugin_version + canonical(rendered_schema) + dialect)
 *                   Includes user-config-driven template substitutions (e.g. `${table_name}`).
 *                   Equals `schemaHash` when the user uses default config.
 *                   Diverges when the user customises a schema-affecting setting,
 *                   triggering an at-install local diff generation.
 *
 * See docs/qdcms-glossary.md → "Migration & hashing" for the rationale.
 */

import { createHash } from 'node:crypto'
import { canonicalJSON } from './canonicalize'
import type { ComposedSchema, SqlDialect } from './types'

export interface HashSchemaInput {
  pluginId: string
  pluginVersion: string
  schema: ComposedSchema
  dialect: SqlDialect
}

/**
 * Compute the schema hash. Pure function — same input always yields the
 * same output (canonical JSON guarantees ordering insensitivity at the
 * object level; arrays preserve their order, which IS significant).
 */
export function hashSchema(input: HashSchemaInput): string {
  const payload = canonicalJSON({
    plugin: input.pluginId,
    version: input.pluginVersion,
    dialect: input.dialect,
    schema: input.schema,
  })
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/**
 * Sha256 of arbitrary content — used for tampering detection on raw SQL
 * files. The runner re-hashes a generated `.up.sql` and compares against
 * the hash stored in `.state.json` to flag manual edits.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Short prefix used in filenames (8 hex chars = 32 bits, low collision
 * risk over the lifetime of one plugin's migrations). Full hash stays in
 * `.state.json` for unambiguous matching.
 */
export function shortHash(hash: string): string {
  return hash.slice(0, 8)
}
