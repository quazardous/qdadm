/**
 * useUserImpersonator - User impersonation composable
 *
 * Provides state and actions for user impersonation.
 * Useful for admin dashboards to test permission-based UI as different users.
 *
 * Permission check:
 *   - Requires 'auth:impersonate' permission (check via entityAuthAdapter.isGranted())
 *   - Falls back to true if no entityAuthAdapter
 *
 * Signals emitted:
 *   - auth:impersonate({ target, original }) - when impersonation starts
 *   - auth:impersonate:stop({ original }) - when impersonation ends
 *
 * Usage:
 *   // With users entity
 *   const { isImpersonating, users, impersonate, exit } = useUserImpersonator({ entity: 'users' })
 *
 *   // With direct users list
 *   const { isImpersonating, impersonate, exit } = useUserImpersonator({ users: myUsersList })
 *
 *   // Custom user mapping
 *   const { ... } = useUserImpersonator({
 *     entity: 'users',
 *     userKey: 'uuid',        // default: 'id'
 *     userLabel: 'email',     // default: 'username'
 *   })
 */

import { ref, computed, onMounted, inject, getCurrentInstance, isRef, unref } from 'vue'

/**
 * @typedef {Object} UseUserImpersonatorOptions
 * @property {string} [entity] - Entity name to fetch users from (e.g., 'users')
 * @property {Array|import('vue').Ref<Array>} [users] - Direct users list (reactive or static)
 * @property {string} [userKey='id'] - Field to use as user ID
 * @property {string} [userLabel='username'] - Field to use as user display label
 * @property {string} [permission='auth:impersonate'] - Permission to check for impersonation
 */

/**
 * User impersonation composable
 *
 * @param {UseUserImpersonatorOptions} options
 * @returns {Object} Impersonation state and actions
 */
export function useUserImpersonator(options = {}) {
  // Strict context check - must be called in component setup()
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error('[qdadm] useUserImpersonator() must be called within component setup()')
  }

  const {
    entity,
    users: providedUsers,
    userKey = 'id',
    userLabel = 'username',
    permission = 'auth:impersonate'
  } = options

  const orchestrator = inject('qdadmOrchestrator', null)
  const authAdapter = inject('authAdapter', null)
  const signals = orchestrator?.signals || null
  const entityAuth = orchestrator?.entityAuthAdapter || null

  // State
  const users = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Note: authTick removed - Kernel.invalidateApp() remounts entire app
  // on auth changes, so composable is re-initialized with fresh state

  /**
   * Current user (may be impersonated)
   */
  const currentUser = computed(() => {
    return authAdapter?.getUser?.() || null
  })

  /**
   * Original user (before impersonation)
   */
  const originalUser = computed(() => {
    return authAdapter?.getOriginalUser?.() || null
  })

  /**
   * Currently impersonating another user
   */
  const isImpersonating = computed(() => {
    return originalUser.value !== null
  })

  /**
   * Check if current user can impersonate others
   */
  const canImpersonate = computed(() => {
    if (!entityAuth?.isGranted) return true // Default allow if no auth
    return entityAuth.isGranted(permission)
  })

  /**
   * Users available for impersonation
   * Excludes: original admin AND currently impersonated user
   * Returns full user objects (not just id/label) so role is preserved
   */
  const availableUsers = computed(() => {
    const excludeIds = new Set()
    if (originalUser.value?.[userKey]) excludeIds.add(originalUser.value[userKey])
    if (currentUser.value?.[userKey]) excludeIds.add(currentUser.value[userKey])

    return users.value.filter(u => !excludeIds.has(u[userKey]))
  })

  /**
   * Load users from entity or provided list
   */
  async function loadUsers() {
    // If users provided directly, use them
    if (providedUsers) {
      users.value = unref(providedUsers)
      return
    }

    // Load from entity
    if (entity && orchestrator) {
      try {
        loading.value = true
        error.value = null
        const manager = orchestrator.get(entity)
        if (manager) {
          const result = await manager.findAll()
          users.value = result?.data || result || []
        }
      } catch (e) {
        error.value = e.message
        console.warn(`[qdadm] useUserImpersonator: Failed to load users from ${entity}:`, e)
      } finally {
        loading.value = false
      }
    }
  }

  /**
   * Start impersonating a user
   *
   * @param {Object|string} userOrId - User object or user ID to impersonate
   */
  async function impersonate(userOrId) {
    if (!canImpersonate.value) {
      console.warn('[qdadm] useUserImpersonator: No permission to impersonate')
      return
    }

    // Resolve user object
    let targetUser
    if (typeof userOrId === 'object') {
      targetUser = userOrId
    } else {
      // Find user by ID
      targetUser = users.value.find(u => u[userKey] === userOrId)
    }

    if (!targetUser) {
      console.warn('[qdadm] useUserImpersonator: User not found')
      return
    }

    // Get current user for signal payload
    const original = authAdapter?.getUser?.()

    // Build target user object with essential fields
    const impersonatedUser = {
      [userKey]: targetUser[userKey],
      [userLabel]: targetUser[userLabel],
      role: targetUser.role // Include role if present
    }

    // Emit auth:impersonate signal - authAdapter reacts via connectSignals()
    await signals?.emit('auth:impersonate', {
      target: impersonatedUser,
      original
    })
  }

  /**
   * Exit impersonation and restore original user
   */
  async function exitImpersonation() {
    if (!isImpersonating.value) return

    // Get original user for signal payload
    const original = authAdapter?.getOriginalUser?.()

    // Emit auth:impersonate:stop signal - authAdapter reacts via connectSignals()
    await signals?.emit('auth:impersonate:stop', {
      original
    })
  }

  // Load users on mount
  // Note: Auth signal listeners removed - Kernel.invalidateApp() remounts entire app
  // on auth changes, so composable is re-initialized with fresh state
  onMounted(() => {
    loadUsers()
  })

  return {
    // State
    users,
    loading,
    error,
    currentUser,
    originalUser,
    isImpersonating,
    canImpersonate,
    availableUsers,

    // Actions
    impersonate,
    exitImpersonation,
    exit: exitImpersonation, // Alias
    loadUsers,

    // Config (for template binding)
    userKey,
    userLabel
  }
}
