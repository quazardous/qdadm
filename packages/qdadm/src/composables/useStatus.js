/**
 * useStatus - Generic status composable
 *
 * Loads and formats status options from any API endpoint.
 * Provides caching, label/severity lookup helpers.
 *
 * Usage:
 * const { options, loadOptions, getLabel, getSeverity } = useStatus({
 *   endpoint: '/reference/queue-statuses',
 *   labelField: 'label',
 *   valueField: 'value',
 *   severityField: 'severity'
 * })
 */

import { ref, inject } from 'vue'

// Global cache for status options (keyed by endpoint)
const statusCache = new Map()

export function useStatus(config = {}) {
  const {
    endpoint,
    labelField = 'label',
    valueField = 'value',
    severityField = 'severity',
    // Optional: static options instead of API fetch
    staticOptions = null,
    // Optional: custom severity mapping function
    severityMapper = null,
    // Optional: default severity if not found
    defaultSeverity = 'secondary'
  } = config

  const api = inject('apiAdapter')
  const options = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Load options from API or use static options
   */
  async function loadOptions(force = false) {
    // Use static options if provided
    if (staticOptions) {
      options.value = staticOptions
      return options.value
    }

    if (!endpoint) {
      console.warn('[useStatus] No endpoint provided')
      return []
    }

    // Check cache first (unless force refresh)
    if (!force && statusCache.has(endpoint)) {
      options.value = statusCache.get(endpoint)
      return options.value
    }

    if (!api) {
      console.warn('[useStatus] apiAdapter not provided')
      return []
    }

    loading.value = true
    error.value = null

    try {
      const response = await api.request('GET', endpoint)
      // Handle both array response and { items: [] } response
      const items = Array.isArray(response) ? response : (response?.items || response?.data || [])
      options.value = items
      statusCache.set(endpoint, items)
      return items
    } catch (e) {
      error.value = e.message
      console.error(`[useStatus] Failed to load options from ${endpoint}:`, e)
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * Get label for a status value
   */
  function getLabel(value) {
    if (value == null) return ''
    const option = options.value.find(opt =>
      (typeof opt === 'string' ? opt : opt[valueField]) === value
    )
    if (!option) return String(value)
    return typeof option === 'string' ? option : option[labelField]
  }

  /**
   * Get severity for a status value (for Tag/Badge color)
   */
  function getSeverity(value) {
    if (value == null) return defaultSeverity

    // Use custom mapper if provided
    if (severityMapper) {
      return severityMapper(value) || defaultSeverity
    }

    const option = options.value.find(opt =>
      (typeof opt === 'string' ? opt : opt[valueField]) === value
    )
    if (!option || typeof option === 'string') return defaultSeverity
    return option[severityField] || defaultSeverity
  }

  /**
   * Get full option object for a value
   */
  function getOption(value) {
    if (value == null) return null
    return options.value.find(opt =>
      (typeof opt === 'string' ? opt : opt[valueField]) === value
    )
  }

  /**
   * Clear cache for this endpoint or all endpoints
   */
  function clearCache(all = false) {
    if (all) {
      statusCache.clear()
    } else if (endpoint) {
      statusCache.delete(endpoint)
    }
  }

  return {
    options,
    loading,
    error,
    loadOptions,
    getLabel,
    getSeverity,
    getOption,
    clearCache
  }
}
