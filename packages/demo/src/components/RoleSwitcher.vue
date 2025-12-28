<script setup>
/**
 * RoleSwitcher - Demo component for permission visualization
 *
 * Allows switching between admin and user roles to demonstrate
 * how the UI adapts based on AuthAdapter permissions:
 *
 * - Admin: Full CRUD on all entities, sees all buttons
 * - User: Limited access (can't delete books, can't manage users)
 *
 * The switcher modifies the user role in localStorage and emits
 * an event to trigger UI refresh. Place this component in the
 * sidebar footer or header to demonstrate permission changes.
 *
 * Usage:
 *   <RoleSwitcher @role-changed="handleRefresh" />
 */

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Dropdown from 'primevue/dropdown'
import Tag from 'primevue/tag'

const AUTH_STORAGE_KEY = 'qdadm_demo_auth'

const router = useRouter()

const roles = [
  { label: 'Admin', value: 'admin', severity: 'danger' },
  { label: 'User', value: 'user', severity: 'info' }
]

const currentRole = ref(null)

/**
 * Get stored auth data from localStorage
 */
function getStoredAuth() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Update stored auth data in localStorage
 */
function setStoredAuth(data) {
  if (data) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
  }
}

/**
 * Load current role from localStorage
 */
function loadCurrentRole() {
  const auth = getStoredAuth()
  currentRole.value = auth?.user?.role || 'user'
}

/**
 * Switch role and persist to localStorage
 * @param {string} newRole - 'admin' or 'user'
 */
function switchRole(newRole) {
  const auth = getStoredAuth()
  if (!auth?.user) return

  // Update role in stored auth
  auth.user.role = newRole
  setStoredAuth(auth)

  currentRole.value = newRole

  // Force page refresh to show permission changes
  // This is the simplest way to ensure all computed permissions are recalculated
  router.go(0)
}

const currentRoleLabel = computed(() => {
  return roles.find(r => r.value === currentRole.value)?.label || 'Unknown'
})

const currentRoleSeverity = computed(() => {
  return roles.find(r => r.value === currentRole.value)?.severity || 'secondary'
})

onMounted(() => {
  loadCurrentRole()
})
</script>

<template>
  <div class="role-switcher">
    <div class="role-switcher-header">
      <span class="role-switcher-label">Demo Role:</span>
      <Tag :value="currentRoleLabel" :severity="currentRoleSeverity" />
    </div>
    <Dropdown
      v-model="currentRole"
      :options="roles"
      optionLabel="label"
      optionValue="value"
      class="role-switcher-dropdown"
      @change="switchRole($event.value)"
    >
      <template #option="{ option }">
        <div class="role-option">
          <Tag :value="option.label" :severity="option.severity" />
          <span v-if="option.value === 'admin'" class="role-hint">Full access</span>
          <span v-else class="role-hint">Limited access</span>
        </div>
      </template>
    </Dropdown>
    <div class="role-switcher-hint">
      <i class="pi pi-info-circle"></i>
      <span>Switch role to see UI adapt</span>
    </div>
  </div>
</template>

<style scoped>
.role-switcher {
  padding: 0.75rem;
  background: var(--p-surface-700, #334155);
  border-radius: 0.5rem;
  margin: 0.5rem;
}

.role-switcher-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.role-switcher-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-surface-300, #cbd5e1);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.role-switcher-dropdown {
  width: 100%;
}

.role-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.role-hint {
  font-size: 0.75rem;
  color: var(--p-surface-500, #64748b);
}

.role-switcher-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  font-size: 0.6875rem;
  color: var(--p-surface-400, #94a3b8);
}

.role-switcher-hint i {
  font-size: 0.75rem;
}
</style>
