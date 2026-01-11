/**
 * useInfoBanner - Programmatic banner management
 *
 * Manages persistent info banners that appear at the top of page content.
 * Unlike toasts, banners stay visible until explicitly dismissed.
 *
 * @example
 * // In a component
 * const { showBanner, hideBanner, clearBanners } = useInfoBanner()
 *
 * // Show a warning banner
 * showBanner({
 *   id: 'unsaved',
 *   severity: 'warn',
 *   message: 'You have unsaved changes',
 *   closable: true
 * })
 *
 * // Hide a specific banner
 * hideBanner('unsaved')
 *
 * // Clear all banners
 * clearBanners()
 *
 * @example
 * // With custom icon
 * showBanner({
 *   id: 'offline',
 *   severity: 'error',
 *   icon: 'pi-wifi',
 *   message: 'You are offline. Changes will be saved when connection is restored.'
 * })
 *
 * @example
 * // In layout - get banners to render
 * const { banners } = useInfoBanner()
 *
 * <InfoBanner
 *   v-for="banner in banners"
 *   :key="banner.id"
 *   :severity="banner.severity"
 *   :icon="banner.icon"
 *   :closable="banner.closable"
 *   @close="hideBanner(banner.id)"
 * >
 *   {{ banner.message }}
 * </InfoBanner>
 */
import { inject, provide, reactive, computed, readonly } from 'vue'

const BANNER_KEY = Symbol('qdadm-banners')

/**
 * Create the banner store (call once in app root)
 */
export function createBannerStore() {
  const state = reactive({
    banners: []
  })

  /**
   * Show a banner
   * @param {Object} options - Banner options
   * @param {string} options.id - Unique identifier (replaces existing with same id)
   * @param {string} options.severity - info, success, warn, error
   * @param {string} options.message - Banner message (can include HTML)
   * @param {string|boolean} [options.icon] - Custom icon or false to hide
   * @param {boolean} [options.closable=true] - Allow user to dismiss
   * @param {number} [options.priority=0] - Higher priority banners appear first
   */
  function showBanner(options) {
    const banner = {
      id: options.id || `banner-${Date.now()}`,
      severity: options.severity || 'info',
      message: options.message || '',
      icon: options.icon,
      closable: options.closable !== false,
      priority: options.priority || 0,
      createdAt: Date.now()
    }

    // Remove existing banner with same id
    const existingIndex = state.banners.findIndex(b => b.id === banner.id)
    if (existingIndex !== -1) {
      state.banners.splice(existingIndex, 1)
    }

    // Insert by priority (higher first)
    const insertIndex = state.banners.findIndex(b => b.priority < banner.priority)
    if (insertIndex === -1) {
      state.banners.push(banner)
    } else {
      state.banners.splice(insertIndex, 0, banner)
    }

    return banner.id
  }

  /**
   * Hide a specific banner
   * @param {string} id - Banner id to remove
   */
  function hideBanner(id) {
    const index = state.banners.findIndex(b => b.id === id)
    if (index !== -1) {
      state.banners.splice(index, 1)
    }
  }

  /**
   * Clear all banners
   */
  function clearBanners() {
    state.banners.length = 0
  }

  /**
   * Check if a banner exists
   * @param {string} id - Banner id
   * @returns {boolean}
   */
  function hasBanner(id) {
    return state.banners.some(b => b.id === id)
  }

  const banners = computed(() => state.banners)

  return {
    banners,
    showBanner,
    hideBanner,
    clearBanners,
    hasBanner
  }
}

/**
 * Provide the banner store to descendant components
 * Call this in your app root or layout component
 */
export function provideBannerStore() {
  const store = createBannerStore()
  provide(BANNER_KEY, store)
  return store
}

/**
 * Use the banner system in a component
 * @returns {Object} Banner API
 */
export function useInfoBanner() {
  const store = inject(BANNER_KEY)

  if (!store) {
    console.warn('[qdadm] useInfoBanner: banner store not provided. Call provideBannerStore() in app root.')
    // Return a no-op store to prevent crashes
    return {
      banners: computed(() => []),
      showBanner: () => {},
      hideBanner: () => {},
      clearBanners: () => {},
      hasBanner: () => false
    }
  }

  return store
}
