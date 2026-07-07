/**
 * useListPage helpers — stateless utilities used by the list page composable.
 *
 * Kept module-local so they're trivially importable from the orchestrator
 * file (`useListPage.ts`) and from any future split modules without dragging
 * the full `useListPage` runtime context along.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pagination cookie persistence
// ─────────────────────────────────────────────────────────────────────────────

const COOKIE_NAME = 'qdadm_pageSize'
const COOKIE_EXPIRY_DAYS = 365

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match?.[2] ?? null
}

export function setCookie(name: string, value: string | number, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

/**
 * Read the saved page size from cookie. Returns the default when absent or
 * not in the canonical {@link PAGE_SIZE_OPTIONS} list.
 */
export function getSavedPageSize(defaultSize: number): number {
  const saved = getCookie(COOKIE_NAME)
  if (saved) {
    const parsed = parseInt(saved, 10)
    if (PAGE_SIZE_OPTIONS.includes(parsed)) return parsed
  }
  return defaultSize
}

export function persistPageSize(size: number): void {
  setCookie(COOKIE_NAME, size, COOKIE_EXPIRY_DAYS)
}

// ─────────────────────────────────────────────────────────────────────────────
// Default label formatter (snake_case → Title Case)
// ─────────────────────────────────────────────────────────────────────────────

export function snakeToTitle(str: string): string {
  if (!str) return 'Unknown'
  return String(str)
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination options
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical page size options offered to the user. */
export const PAGE_SIZE_OPTIONS = [10, 50, 100]

// ─────────────────────────────────────────────────────────────────────────────
// Filter session storage
// ─────────────────────────────────────────────────────────────────────────────

const FILTER_SESSION_PREFIX = 'qdadm_filters_'

export function getSessionFilters(key: string): Record<string, unknown> | null {
  try {
    const stored = sessionStorage.getItem(FILTER_SESSION_PREFIX + key)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function setSessionFilters(key: string, filters: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(FILTER_SESSION_PREFIX + key, JSON.stringify(filters))
  } catch {
    // Ignore storage errors (quota exceeded, disabled by user, …).
  }
}

export function clearSessionFilters(key: string): void {
  try {
    sessionStorage.removeItem(FILTER_SESSION_PREFIX + key)
  } catch {
    // Ignore storage errors.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort session storage (#1218) — same mechanism as filters, keyed by entity
// ─────────────────────────────────────────────────────────────────────────────

const SORT_SESSION_PREFIX = 'qdadm_sort_'

export interface SessionSort {
  field: string | null
  order: 1 | -1
}

export function getSessionSort(key: string): SessionSort | null {
  try {
    const stored = sessionStorage.getItem(SORT_SESSION_PREFIX + key)
    if (!stored) return null
    const parsed = JSON.parse(stored) as SessionSort
    if (parsed && (parsed.order === 1 || parsed.order === -1)) return parsed
    return null
  } catch {
    return null
  }
}

export function setSessionSort(key: string, sort: SessionSort): void {
  try {
    sessionStorage.setItem(SORT_SESSION_PREFIX + key, JSON.stringify(sort))
  } catch {
    // Ignore storage errors (quota exceeded, disabled by user, …).
  }
}

export function clearSessionSort(key: string): void {
  try {
    sessionStorage.removeItem(SORT_SESSION_PREFIX + key)
  } catch {
    // Ignore storage errors.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart filter discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Threshold below which the list switches to client-side filtering when
 * `filterMode: 'auto'` is in effect.
 */
export const SMART_FILTER_THRESHOLD = 50
