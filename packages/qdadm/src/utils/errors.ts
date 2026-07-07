/**
 * Error formatting helpers (#1193).
 */

/** Fetch-error shape accepted by the page components. */
export interface FetchErrorLike {
  message?: string
  detail?: string
}

/**
 * Normalize a fetch error (string or axios-ish object) to a display
 * message — was duplicated byte-identically in ShowPage and FormPage.
 */
export function formatFetchError(
  error: string | FetchErrorLike | null | undefined,
  fallback = 'Failed to load entity'
): string | null {
  if (!error) return null
  if (typeof error === 'string') return error
  return error.message || error.detail || fallback
}
