/**
 * Centralized formatting utilities
 *
 * Usage:
 *   import { formatDate, formatDateTime, formatDuration } from '@/dashboard/utils/formatters'
 *
 *   {{ formatDate(item.created_at) }}
 *   {{ formatDateTime(item.updated_at) }}
 */

// =============================================================================
// DATE/TIME FORMATTING
// =============================================================================

/**
 * Format a date string to localized date+time
 * Default format: toLocaleString() (e.g., "20/12/2025, 14:30:00")
 *
 * @param {string|Date} dateStr - ISO date string or Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string or '-' if empty
 */
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'

  if (Object.keys(options).length === 0) {
    return date.toLocaleString()
  }
  return date.toLocaleString(undefined, options)
}

/**
 * Format to full datetime with year (20/12/2025 14:30)
 */
export function formatDateTime(dateStr) {
  return formatDate(dateStr, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format to short datetime without year (20/12 14:30)
 */
export function formatDateTimeShort(dateStr) {
  return formatDate(dateStr, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format to date only (20/12/2025)
 */
export function formatDateOnly(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * Format to time only (14:30:00)
 */
export function formatTimeOnly(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString()
}

/**
 * Format with "Never" as default (for last_used fields)
 */
export function formatDateOrNever(dateStr) {
  if (!dateStr) return 'Never'
  return formatDate(dateStr)
}

// =============================================================================
// DURATION FORMATTING
// =============================================================================

/**
 * Format a duration in milliseconds to human-readable string
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Human-readable duration (e.g., "2h 30m 15s" or "45.2s")
 */
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '-'
  if (ms < 1000) return `${ms}ms`

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    const remainingSeconds = seconds % 60
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }
  // Show decimal seconds for short durations
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Format duration from start/end timestamps
 */
export function formatDurationBetween(startDate, endDate) {
  if (!startDate || !endDate) return '-'
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-'
  return formatDuration(end - start)
}

// =============================================================================
// NUMBER FORMATTING
// =============================================================================

/**
 * Format a number with locale-specific separators
 */
export function formatNumber(value, options = {}) {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString(undefined, options)
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/**
 * Format a percentage
 */
export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(decimals)}%`
}
