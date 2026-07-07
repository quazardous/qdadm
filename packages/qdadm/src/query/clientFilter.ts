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

/** Sort by a field, nulls/undefined last — the canonical adapter comparator. */
export function sortItems<T>(items: T[], sortBy?: string | null, sortOrder: SortOrder = 'asc'): T[] {
  if (!sortBy) return items
  return items.sort((a, b) => {
    const aVal = a[sortBy as keyof T]
    const bVal = b[sortBy as keyof T]
    if (aVal === undefined || aVal === null) return 1
    if (bVal === undefined || bVal === null) return -1
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
