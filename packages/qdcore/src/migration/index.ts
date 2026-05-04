/**
 * @quazardous/qdcore/migration — public exports.
 *
 * **Node-only**. See `./types.ts` header for the rationale and design.
 */

export {
  MigrationError,
  MigrationOwnershipError,
  MigrationHashMismatchError,
} from './types'

export type {
  SqlDialect,
  Migration,
  ComposedSchema,
  PluginSchemaState,
  MigrationStore,
  MigrationContext,
  MigrationRunner,
  MigrationResult,
  MigrationStatusEntry,
} from './types'

export { canonicalJSON } from './canonicalize'
export { hashSchema, hashContent, shortHash, type HashSchemaInput } from './hashSchema'
export { composePluginSchema, composeFullSchema } from './composeSchema'
export {
  OwnershipTracker,
  OwnershipConflictError,
  type ColumnOwnership,
  type TableOwnership,
} from './OwnershipTracker'
