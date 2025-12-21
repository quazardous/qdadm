/**
 * useTabSync - Composable for tab navigation with URL hash sync
 *
 * Provides:
 * - activeTab computed from URL hash
 * - onTabChange handler to update URL
 * - Support for conditional tabs (edit mode only)
 * - Lazy loading trigger on tab activation
 *
 * Usage:
 *   const { activeTab, onTabChange } = useTabSync({
 *     validTabs: ['general', 'style', 'behavior', 'newsrooms'],
 *     defaultTab: 'general',
 *     restrictedTabs: { newsrooms: () => isEdit.value },
 *     onTabActivate: { newsrooms: () => loadNewsroomData() }
 *   })
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * @param {Object} options
 * @param {string[]} options.validTabs - List of valid tab values
 * @param {string} [options.defaultTab='general'] - Default tab when hash is invalid
 * @param {Object.<string, Function>} [options.restrictedTabs={}] - Tab name -> condition function
 * @param {Object.<string, Function>} [options.onTabActivate={}] - Tab name -> callback on first activation
 */
export function useTabSync(options = {}) {
  const {
    validTabs = ['general'],
    defaultTab = 'general',
    restrictedTabs = {},
    onTabActivate = {}
  } = options

  const route = useRoute()
  const router = useRouter()

  // Track which tabs have been activated (for lazy loading)
  const activatedTabs = new Set([defaultTab])

  /**
   * Active tab derived from URL hash
   */
  const activeTab = computed(() => {
    const hash = route.hash?.replace('#', '')

    if (hash && validTabs.includes(hash)) {
      // Check if tab is restricted
      const restriction = restrictedTabs[hash]
      if (restriction && !restriction()) {
        return defaultTab
      }
      return hash
    }

    return defaultTab
  })

  /**
   * Handle tab change - update URL hash and trigger callbacks
   * @param {string} newTab
   */
  function onTabChange(newTab) {
    // Update URL hash
    router.replace({ ...route, hash: `#${newTab}` })

    // Trigger lazy load callback if first activation
    if (!activatedTabs.has(newTab)) {
      activatedTabs.add(newTab)
      const callback = onTabActivate[newTab]
      if (callback) {
        callback()
      }
    }
  }

  /**
   * Check if a tab should be visible
   * @param {string} tabName
   * @returns {boolean}
   */
  function isTabVisible(tabName) {
    const restriction = restrictedTabs[tabName]
    if (restriction) {
      return restriction()
    }
    return true
  }

  /**
   * Navigate to a specific tab programmatically
   * @param {string} tabName
   */
  function goToTab(tabName) {
    if (validTabs.includes(tabName) && isTabVisible(tabName)) {
      onTabChange(tabName)
    }
  }

  return {
    activeTab,
    onTabChange,
    isTabVisible,
    goToTab
  }
}

export default useTabSync
