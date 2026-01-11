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

import { ref, computed, onMounted, onUnmounted, inject, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Select from 'primevue/select'
import { SidebarBox } from 'qdadm/components'

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

/**
 * Check if current user can impersonate others
 * Depends on currentUser to force re-evaluation when auth state changes
 */
const canImpersonate = computed(() => {
  // Force re-evaluation when user changes (entityAuth.isGranted is not reactive)
  const _ = currentUser.value
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
 * Handle user selection from dropdown
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
    signalCleanups.push(signals.on('auth:impersonate:stop', async () => {
      loadState()
      selectedUser.value = null
      // Wait for next tick to ensure Vue has processed the state changes
      await nextTick()
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
    <!-- Active impersonation -->
    <SidebarBox
      v-if="isImpersonating"
      icon="pi-user-edit"
      title="Impersonating"
      :subtitle="currentUser?.username"
      variant="impersonator"
      @click="exitImpersonation"
    >
      <i class="pi pi-times exit-icon"></i>
    </SidebarBox>

    <!-- Impersonation controls -->
    <SidebarBox v-if="canImpersonate && !isImpersonating" key="impersonate-controls">
      <template #full>
        <span class="sidebar-box-full-label">Impersonate</span>
        <Select
          v-model="selectedUser"
          :options="availableUsers"
          optionLabel="username"
          placeholder="Select user..."
          class="sidebar-box-full-input"
          appendTo="self"
          @change="onUserSelect"
        />
      </template>
    </SidebarBox>
  </div>
</template>

<style scoped>
.user-impersonator {
  margin: 0;
}

.exit-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--p-orange-400, #fb923c);
  font-size: 0.875rem;
  opacity: 0.7;
  transition: opacity var(--fad-transition-fast, 0.1s);
}

.exit-icon:hover {
  opacity: 1;
}

/* Hide exit icon when sidebar is collapsed */
:deep(.sidebar--collapsed) .exit-icon {
  display: none;
}
</style>
