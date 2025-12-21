/**
 * Data transformation utilities for forms
 *
 * Provides consistent conversions between API data formats and form structures.
 */

/**
 * Convert object {key: value} to array [{key, value}] for KeyValueEditor
 */
export function toKeyValueArray(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([key, value]) => ({ key, value }))
}

/**
 * Convert array [{key, value}] to object {key: value} for API
 */
export function toKeyValueObject(arr) {
  if (!Array.isArray(arr)) return {}
  return Object.fromEntries(
    arr.filter(item => item.key && item.key.trim())
       .map(item => [item.key.trim(), item.value])
  )
}

/**
 * Convert language objects [{code, fluency}] to array of codes ['en', 'fr']
 */
export function toLanguageCodes(languages) {
  if (!Array.isArray(languages)) return []
  return languages.map(l => typeof l === 'string' ? l : l.code).filter(Boolean)
}

/**
 * Convert array of codes to language objects [{code, fluency}]
 */
export function toLanguageObjects(codes, defaultFluency = 1) {
  if (!Array.isArray(codes)) return []
  return codes.filter(Boolean).map(code => ({
    code: typeof code === 'string' ? code : code.code,
    fluency: typeof code === 'object' ? code.fluency : defaultFluency
  }))
}

/**
 * Convert ISO date string to Date object
 */
export function toDateObject(dateStr) {
  if (!dateStr) return null
  if (dateStr instanceof Date) return dateStr
  return new Date(dateStr)
}

/**
 * Convert Date to ISO date string (YYYY-MM-DD)
 */
export function toIsoDate(date) {
  if (!date) return null
  if (typeof date === 'string') return date.split('T')[0]
  return date.toISOString().split('T')[0]
}

/**
 * Convert Date to ISO datetime string
 */
export function toIsoDateTime(date) {
  if (!date) return null
  if (typeof date === 'string') return date
  return date.toISOString()
}

/**
 * Deep clone an object (for snapshots)
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj)
  if (Array.isArray(obj)) return obj.map(deepClone)
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, deepClone(v)])
  )
}

/**
 * Get sparse update object (only changed fields)
 */
export function getSparseUpdate(original, modified, excludeFields = []) {
  const patch = {}
  for (const key in modified) {
    if (excludeFields.includes(key)) continue
    const origVal = JSON.stringify(original[key])
    const modVal = JSON.stringify(modified[key])
    if (origVal !== modVal) {
      patch[key] = modified[key]
    }
  }
  return patch
}

/**
 * Check if two values are deeply equal
 */
export function isEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}
