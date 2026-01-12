/**
 * Data transformation utilities for forms
 *
 * Provides consistent conversions between API data formats and form structures.
 */

/**
 * Key-value pair structure for KeyValueEditor
 */
export interface KeyValuePair {
  key: string
  value: unknown
}

/**
 * Language object structure
 */
export interface LanguageObject {
  code: string
  fluency: number
}

/**
 * Convert object {key: value} to array [{key, value}] for KeyValueEditor
 */
export function toKeyValueArray(obj: Record<string, unknown> | null | undefined): KeyValuePair[] {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([key, value]) => ({ key, value }))
}

/**
 * Convert array [{key, value}] to object {key: value} for API
 */
export function toKeyValueObject(arr: KeyValuePair[] | null | undefined): Record<string, unknown> {
  if (!Array.isArray(arr)) return {}
  return Object.fromEntries(
    arr.filter((item) => item.key && item.key.trim()).map((item) => [item.key.trim(), item.value])
  )
}

/**
 * Convert language objects [{code, fluency}] to array of codes ['en', 'fr']
 */
export function toLanguageCodes(
  languages: Array<string | LanguageObject> | null | undefined
): string[] {
  if (!Array.isArray(languages)) return []
  return languages
    .map((l) => (typeof l === 'string' ? l : l.code))
    .filter((code): code is string => Boolean(code))
}

/**
 * Convert array of codes to language objects [{code, fluency}]
 */
export function toLanguageObjects(
  codes: Array<string | LanguageObject> | null | undefined,
  defaultFluency = 1
): LanguageObject[] {
  if (!Array.isArray(codes)) return []
  return codes.filter(Boolean).map((code) => ({
    code: typeof code === 'string' ? code : code.code,
    fluency: typeof code === 'object' && code !== null ? code.fluency : defaultFluency,
  }))
}

/**
 * Convert ISO date string to Date object
 */
export function toDateObject(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null
  if (dateStr instanceof Date) return dateStr
  return new Date(dateStr)
}

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 */
export function toIsoDate(date: string | Date | null | undefined): string | null {
  if (!date) return null
  if (typeof date === 'string') return date.split('T')[0] ?? date
  return date.toISOString().split('T')[0] ?? null
}

/**
 * Convert Date to ISO datetime string
 */
export function toIsoDateTime(date: string | Date | null | undefined): string | null {
  if (!date) return null
  if (typeof date === 'string') return date
  return date.toISOString()
}

/**
 * Deep clone an object (for snapshots)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj) as unknown as T
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepClone(v)])
  ) as unknown as T
}

/**
 * Get sparse update object (only changed fields)
 */
export function getSparseUpdate<T extends Record<string, unknown>>(
  original: T,
  modified: T,
  excludeFields: string[] = []
): Partial<T> {
  const patch: Partial<T> = {}
  for (const key in modified) {
    if (excludeFields.includes(key)) continue
    const origVal = JSON.stringify(original[key])
    const modVal = JSON.stringify(modified[key])
    if (origVal !== modVal) {
      patch[key as keyof T] = modified[key]
    }
  }
  return patch
}

/**
 * Check if two values are deeply equal
 */
export function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
