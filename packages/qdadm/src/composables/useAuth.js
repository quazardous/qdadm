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
 * - Listens to auth:login, auth:logout, auth:impersonate signals
 * - User computed re-evaluates when these signals fire
 * - No polling or manual refresh needed
 *
 * Note: Permission checking (canRead/canWrite) is handled by EntityManager,
 * not by useAuth. This keeps auth simple and delegates permission logic
 * to where it belongs (the entity layer).
 *
 * Usage:
 *   const { isAuthenticated, user, logout } = useAuth()
 */

import { inject, computed, ref, onUnmounted, getCurrentInstance } from 'vue'

export function useAuth() {
  // Strict context check - must be called in component setup()
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error('[qdadm] useAuth() must be called within component setup()')
  }

  const auth = inject('authAdapter')
  const features = inject('qdadmFeatures')
  const signals = inject('qdadmSignals', null)

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

  // Reactive trigger - incremented on auth signals to force computed re-evaluation
  const authTick = ref(0)

  // Subscribe to auth signals for reactivity
  const cleanups = []
  if (signals) {
    cleanups.push(signals.on('auth:login', () => { authTick.value++ }))
    cleanups.push(signals.on('auth:logout', () => { authTick.value++ }))
    cleanups.push(signals.on('auth:impersonate', () => { authTick.value++ }))
  }

  // Cleanup signal subscriptions on unmount
  onUnmounted(() => {
    cleanups.forEach(cleanup => cleanup())
  })

  // Reactive user state - re-evaluates when authTick changes
  const user = computed(() => {
    // Touch authTick to create reactive dependency
    // eslint-disable-next-line no-unused-expressions
    authTick.value
    if (typeof auth.getUser === 'function') {
      return auth.getUser()
    }
    return auth.user || null
  })

  return {
    login: auth.login,
    logout: auth.logout,
    getCurrentUser: auth.getCurrentUser,
    isAuthenticated: computed(() => {
      // Touch authTick for reactivity
      // eslint-disable-next-line no-unused-expressions
      authTick.value
      return auth.isAuthenticated()
    }),
    user,
    authEnabled: true
  }
}
