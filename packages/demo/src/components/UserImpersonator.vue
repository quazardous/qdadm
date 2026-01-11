<script setup>
/**
 * UserImpersonator - Demo component using useUserImpersonator
 *
 * Demonstrates the composable with custom user source (localStorage in demo).
 *
 * Usage:
 *   <UserImpersonator />
 */

import { ref, onMounted, onUnmounted, inject, nextTick } from 'vue'
import Select from 'primevue/select'
import { SidebarBox } from 'qdadm/components'
import { useUserImpersonator } from 'qdadm/composables'

const USERS_STORAGE_KEY = 'mockapi_users_data'

// Get users from localStorage (demo-specific)
function getAllUsers() {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Reactive users list from localStorage
const demoUsers = ref(getAllUsers())

// Use the composable with direct users list
const {
  currentUser,
  isImpersonating,
  canImpersonate,
  availableUsers,
  impersonate,
  exitImpersonation
} = useUserImpersonator({
  users: demoUsers,
  userKey: 'id',
  userLabel: 'username'
})

// Selected user for dropdown
const selectedUser = ref(null)

// Refresh users from localStorage on impersonation changes
const orchestrator = inject('qdadmOrchestrator')
const signalCleanups = []

onMounted(() => {
  const signals = orchestrator?.signals
  if (signals) {
    signalCleanups.push(signals.on('auth:impersonate', () => {
      demoUsers.value = getAllUsers()
    }))
    signalCleanups.push(signals.on('auth:impersonate:stop', async () => {
      demoUsers.value = getAllUsers()
      selectedUser.value = null
      await nextTick()
    }))
  }
})

onUnmounted(() => {
  for (const cleanup of signalCleanups) {
    if (typeof cleanup === 'function') cleanup()
  }
})

/**
 * Handle user selection from dropdown
 */
function onUserSelect(event) {
  if (event.value?.id) {
    impersonate(event.value)
  }
}
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
