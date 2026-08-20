/**
 * Query Module - MongoDB-like filtering for arrays
 *
 * Provides client-side filtering with the same query syntax used for API calls.
 *
 * @experimental Applies to the EXECUTOR CLASSES below, used directly. The query
 * object syntax they interpret (`{ field: { $in: [...] } }`) is stable — it is
 * what list filters and EntityManager.query() speak. See
 * docs/API_STABILITY.md.
 *
 * @module query
 */

export { QueryExecutor, getNestedValue } from './QueryExecutor'
export type { QueryCondition, QueryOperators, QueryObject, QueryResult } from './QueryExecutor'

export { FilterQuery } from './FilterQuery'
export type {
  FilterQuerySource,
  FilterOption,
  ValueResolver,
  FilterQueryOptions,
} from './FilterQuery'
