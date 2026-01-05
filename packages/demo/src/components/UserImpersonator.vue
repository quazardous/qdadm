<script setup>
/**
 * UserImpersonator - Demo component for user impersonation
 *
 * Allows admins to impersonate other users to test permission-based UI.
 * Unlike RoleSwitcher (which changes roles abstractly), this impersonates
 * actual users from the demo database.
 *
 * Permission check:
 *   - Requires 'auth:impersonate' permission (granted to ROLE_ADMIN)
 *   - Uses isGranted() from SecurityChecker
 *
 * Impersonation state:
 *   - Stores originalUser + impersonatedAs in localStorage
 *   - authAdapter.getUser() returns impersonatedAs when active
 *   - Banner shows when impersonating
 *
 * Usage:
 *   <UserImpersonator />
 */

import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'

const USERS_STORAGE_KEY = 'mockapi_users_data'

const router = useRouter()
const orchestrator = inject('qdadmOrchestrator')
const authAdapter = inject('authAdapter')
const signalCleanups = []

// State
const users = ref([])
const currentUser = ref(null)
const originalUser = ref(null)
const selectedUser = ref(null)
const filteredUsers = ref([])

/**
 * Check if current user can impersonate others
 */
const canImpersonate = computed(() => {
  const entityAuth = orchestrator?.entityAuthAdapter
  if (!entityAuth?.isGranted) return false
  return entityAuth.isGranted('auth:impersonate')
})

/**
 * Currently impersonating another user
 */
const isImpersonating = computed(() => {
  return originalUser.value !== null
})

/**
 * Users available for impersonation
 * Excludes: original admin AND currently impersonated user (can't impersonate yourself)
 */
const availableUsers = computed(() => {
  const excludeIds = new Set()
  // Always exclude the original admin
  if (originalUser.value?.id) excludeIds.add(originalUser.value.id)
  // Also exclude the currently impersonated user
  if (currentUser.value?.id) excludeIds.add(currentUser.value.id)
  return users.value.filter(u => !excludeIds.has(u.id)).map(u => ({
    id: u.id,
    username: u.username
  }))
})

/**
 * Get all users from MockApiStorage
 */
function getAllUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Load current state from authAdapter
 */
function loadState() {
  currentUser.value = authAdapter?.getUser?.() || null
  originalUser.value = authAdapter?.getOriginalUser?.() || null
  users.value = getAllUsers()

  if (isImpersonating.value) {
    selectedUser.value = currentUser.value
  }
}

/**
 * Filter users for autocomplete
 * @param {Object} event - AutoComplete search event
 */
function searchUsers(event) {
  const query = event.query.toLowerCase()
  filteredUsers.value = availableUsers.value.filter(u =>
    u.username.toLowerCase().includes(query)
  )
}

/**
 * Handle user selection from autocomplete
 * @param {Object} event - Selection event
 */
function onUserSelect(event) {
  if (event.value?.id) {
    impersonateUser(event.value.id)
  }
}

/**
 * Start impersonating a user
 *
 * Signal-driven: just emit the signal, authAdapter reacts via connectSignals().
 *
 * @param {string} userId - ID of user to impersonate
 */
async function impersonateUser(userId) {
  // Fetch fresh user data from storage (not stale users.value)
  const freshUsers = getAllUsers()
  const targetUser = freshUsers.find(u => u.id === userId)
  if (!targetUser) return

  // Get current user for signal payload
  const original = authAdapter?.getUser?.()

  // Build target user object
  const impersonatedUser = {
    id: targetUser.id,
    username: targetUser.username,
    role: targetUser.role
  }

  // Emit auth:impersonate signal - authAdapter reacts via connectSignals()
  // Signal handlers (including this component's) refresh state automatically
  await orchestrator?.signals?.emit('auth:impersonate', {
    target: impersonatedUser,
    original
  })

  // Navigate to home to apply new permissions
  router.push({ name: 'home' })
}

/**
 * Exit impersonation and restore original user
 *
 * Signal-driven: just emit the signal, authAdapter reacts via connectSignals().
 */
async function exitImpersonation() {
  // Get original user for signal payload
  const original = authAdapter?.getOriginalUser?.()

  // Emit auth:impersonate:stop signal - authAdapter reacts via connectSignals()
  // Signal handlers (including this component's) refresh state automatically
  await orchestrator?.signals?.emit('auth:impersonate:stop', {
    original
  })

  // Navigate to home to apply original permissions
  router.push({ name: 'home' })
}

onMounted(() => {
  loadState()

  // Subscribe to impersonation signals to refresh state
  const signals = orchestrator?.signals
  if (signals) {
    signalCleanups.push(signals.on('auth:impersonate', () => {
      loadState()
    }))
    signalCleanups.push(signals.on('auth:impersonate:stop', () => {
      loadState()
      selectedUser.value = null
    }))
  }
})

onUnmounted(() => {
  // Cleanup signal subscriptions
  for (const cleanup of signalCleanups) {
    if (typeof cleanup === 'function') cleanup()
  }
})
</script>

<template>
  <div v-if="canImpersonate || isImpersonating" class="user-impersonator">
    <!-- Impersonation Warning Banner -->
    <div v-if="isImpersonating" class="impersonator-banner">
      <i class="pi pi-user-edit"></i>
      <span>Impersonating: <strong>{{ currentUser?.username }}</strong></span>
      <Button
        icon="pi pi-times"
        class="p-button-sm p-button-text p-button-danger"
        @click="exitImpersonation"
        v-tooltip.top="'Exit impersonation'"
      />
    </div>

    <!-- Impersonation Controls (only when can impersonate) -->
    <div v-if="canImpersonate && !isImpersonating" class="impersonator-controls">
      <div class="impersonator-header">
        <span class="impersonator-label">Impersonate User:</span>
      </div>
      <AutoComplete
        v-model="selectedUser"
        :suggestions="filteredUsers"
        optionLabel="username"
        placeholder="Type username..."
        class="impersonator-input"
        :dropdown="true"
        @complete="searchUsers"
        @item-select="onUserSelect"
      />
      <div class="impersonator-hint">
        <i class="pi pi-info-circle"></i>
        <span>Type or select to impersonate</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-impersonator {
  margin: 0.5rem;
}

.impersonator-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--p-orange-100, #fed7aa);
  border: 1px solid var(--p-orange-300, #fdba74);
  border-radius: 0.5rem;
  color: var(--p-orange-800, #9a3412);
  font-size: 0.875rem;
}

.impersonator-banner i {
  font-size: 1rem;
}

.impersonator-banner strong {
  font-weight: 600;
}

.impersonator-banner .p-button {
  margin-left: auto;
}

.impersonator-controls {
  padding: 0.75rem;
  background: var(--p-surface-700, #334155);
  border-radius: 0.5rem;
}

.impersonator-header {
  margin-bottom: 0.5rem;
}

.impersonator-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-surface-300, #cbd5e1);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.impersonator-input {
  width: 100%;
}

.impersonator-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  font-size: 0.6875rem;
  color: var(--p-surface-400, #94a3b8);
}

.impersonator-hint i {
  font-size: 0.75rem;
}
</style>
