/**
 * useAuth - Access authentication state (component-only)
 *
 * Provides access to authAdapter set via createQdadm bootstrap.
 * Returns neutral values if auth is disabled.
 *
 * IMPORTANT: Must be called within component setup() function.
 * For route guards or services, use authAdapter directly.
 *
 * Reactivity:
 * - Kernel.invalidateApp() remounts entire app on auth changes
 * - Composable is re-initialized with fresh state
 * - No signal listeners needed
 *
 * Note: Permission checking (canRead/canWrite) is handled by EntityManager,
 * not by useAuth. This keeps auth simple and delegates permission logic
 * to where it belongs (the entity layer).
 *
 * Usage:
 *   const { isAuthenticated, user, logout } = useAuth()
 */

import { inject, computed, ref, getCurrentInstance } from 'vue'

export function useAuth() {
  // Strict context check - must be called in component setup()
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error('[qdadm] useAuth() must be called within component setup()')
  }

  const auth = inject('authAdapter')
  const features = inject('qdadmFeatures')

  // If auth disabled or not provided, return neutral values
  if (!features?.auth || !auth) {
    return {
      login: () => Promise.resolve({ token: null, user: null }),
      logout: () => {},
      getCurrentUser: () => Promise.resolve(null),
      isAuthenticated: computed(() => true), // Always "authenticated"
      user: ref(null),
      authEnabled: false
    }
  }

  // Note: Auth signal listeners removed - Kernel.invalidateApp() remounts entire app
  // on auth changes, so composable is re-initialized with fresh state

  // User state - reads current value from authAdapter
  const user = computed(() => {
    if (typeof auth.getUser === 'function') {
      return auth.getUser()
    }
    return auth.user || null
  })

  return {
    login: auth.login,
    logout: auth.logout,
    getCurrentUser: auth.getCurrentUser,
    isAuthenticated: computed(() => auth.isAuthenticated()),
    user,
    authEnabled: true
  }
}
