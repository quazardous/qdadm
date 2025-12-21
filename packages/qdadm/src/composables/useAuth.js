/**
 * useAuth - Access authentication state
 *
 * Provides access to authAdapter set via createQdadm bootstrap.
 * Returns neutral values if auth is disabled.
 *
 * Note: Permission checking (canRead/canWrite) is handled by EntityManager,
 * not by useAuth. This keeps auth simple and delegates permission logic
 * to where it belongs (the entity layer).
 *
 * Usage:
 *   const { isAuthenticated, user, logout } = useAuth()
 */

import { inject, computed, ref } from 'vue'

export function useAuth() {
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

  // Reactive user state
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
