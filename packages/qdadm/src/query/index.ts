/**
 * Query Module - MongoDB-like filtering for arrays
 *
 * Provides client-side filtering with the same query syntax used for API calls.
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
