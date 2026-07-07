/**
 * Shared client-side list pipeline (#1192, KPI-5)
 *
 * The sort / search / paginate blocks below were byte-identical across
 * MemoryStorage, LocalStorage, MockApiStorage, SdkStorage and
 * EntityManager.query — one implementation now serves them all.
 *
 * Filtering intentionally takes a `stringMatch` mode because the adapters
 * historically diverged (Memory/Sdk: substring `includes`, Local: exact
 * case-insensitive) and this refactor is behavior-preserving. MockApiStorage
 * keeps delegating operator filters to QueryExecutor; converging every
 * adapter onto QueryExecutor would change plain-string semantics and is
 * out of scope here.
 */

export type SortOrder = 'asc' | 'desc'

/**
 * Null placement when sorting (#1222 — configurable, it depends on the
 * API and the field semantics):
 * - 'last'  (default): nulls at the end, both directions — the historical
 *   adapter behavior, keeps empty rows out of the way.
 * - 'first': nulls at the top, both directions.
 * - 'low':   null behaves as the lowest value — first in asc, last in
 *   desc. Right for "last seen" dates ("Never" sorts beyond the oldest
 *   period); equals PrimeVue nullSortOrder: -1.
 * - 'high':  null behaves as the highest value — last in asc, first in desc.
 */
export type NullSortMode = 'first' | 'last' | 'low' | 'high'

export interface SortItemsOptions {
  nulls?: NullSortMode
}

export function nullSortRank(mode: NullSortMode, sortOrder: SortOrder): number {
  // Return the comparator result for "a is null, b is not"
  switch (mode) {
    case 'first':
      return -1
    case 'low':
      return sortOrder === 'asc' ? -1 : 1
    case 'high':
      return sortOrder === 'asc' ? 1 : -1
    case 'last':
    default:
      return 1
  }
}

/** Sort by a field — the canonical comparator (null placement configurable). */
export function sortItems<T>(
  items: T[],
  sortBy?: string | null,
  sortOrder: SortOrder = 'asc',
  options: SortItemsOptions = {}
): T[] {
  if (!sortBy) return items
  const { nulls = 'last' } = options
  return items.sort((a, b) => {
    const aVal = a[sortBy as keyof T]
    const bVal = b[sortBy as keyof T]
    const aNull = aVal === undefined || aVal === null
    const bNull = bVal === undefined || bVal === null
    if (aNull && bNull) return 0
    if (aNull) return nullSortRank(nulls, sortOrder)
    if (bNull) return -nullSortRank(nulls, sortOrder)
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
    return 0
  })
}

export interface FilterItemsOptions {
  /**
   * How string filter values match string item values:
   * - 'includes': case-insensitive substring (MemoryStorage/SdkStorage legacy)
   * - 'exact': case-insensitive equality (LocalStorage legacy)
   */
  stringMatch?: 'includes' | 'exact'
}

/** Apply simple field filters; empty/null/undefined filter values are skipped. */
export function filterItems<T>(
  items: T[],
  filters: Record<string, unknown> = {},
  options: FilterItemsOptions = {}
): T[] {
  const { stringMatch = 'includes' } = options
  let result = items
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue
    result = result.filter((item) => {
      const itemValue = item[key as keyof T]
      if (typeof value === 'string' && typeof itemValue === 'string') {
        return stringMatch === 'exact'
          ? itemValue.toLowerCase() === value.toLowerCase()
          : itemValue.toLowerCase().includes(value.toLowerCase())
      }
      return itemValue === value
    })
  }
  return result
}

/** Substring match on every string field (the adapters' full-text search). */
export function searchItems<T>(items: T[], search?: string | null): T[] {
  if (!search || typeof search !== 'string' || !search.trim()) return items
  const query = search.toLowerCase().trim()
  return items.filter((item) => {
    for (const value of Object.values(item as Record<string, unknown>)) {
      if (typeof value === 'string' && value.toLowerCase().includes(query)) {
        return true
      }
    }
    return false
  })
}

/** Slice a page out of the item list. */
export function paginate<T>(items: T[], page = 1, pageSize = 20): T[] {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

/** Default id generator for in-memory adapters (was triplicated, with a deprecated substr). */
export function defaultGenerateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
