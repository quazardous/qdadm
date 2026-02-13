<script setup lang="ts">
/**
 * DefaultUserInfo - Default user info component for sidebar
 *
 * Displays user avatar, name, role, and logout button.
 * Extracted from AppLayout for zone-based architecture.
 *
 * This component is used when auth is enabled.
 */
import { computed, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../../composables/useAuth'
import Button from 'primevue/button'

interface UserData {
  username?: string
  name?: string
  email?: string
  role?: string
  [key: string]: unknown
}

const router = useRouter()
const { user, logout, authEnabled } = useAuth()

// Cast user to expected shape (useAuth returns unknown)
const userData = computed<UserData | null>(() => user.value as UserData | null)

const userInitials: ComputedRef<string> = computed(() => {
  const username = userData.value?.username
  if (!username) return '?'
  return username.substring(0, 2).toUpperCase()
})

const userDisplayName: ComputedRef<string> = computed(() => {
  return userData.value?.username || userData.value?.name || 'User'
})

const userSubtitle: ComputedRef<string> = computed(() => {
  return userData.value?.email || userData.value?.role || ''
})

function handleLogout(): void {
  logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div v-if="authEnabled" class="default-user-info">
    <div class="user-avatar">{{ userInitials }}</div>
    <div class="user-details">
      <div class="user-name">{{ userDisplayName }}</div>
      <div class="user-role">{{ userSubtitle }}</div>
    </div>
    <Button
      icon="pi pi-sign-out"
      severity="secondary"
      text
      rounded
      @click="handleLogout"
      v-tooltip.top="'Logout'"
    />
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.default-user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--p-surface-700, #334155);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--p-primary-600, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-surface-0, white);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--p-surface-0, white);
}

.user-role {
  font-size: 0.75rem;
  color: var(--p-surface-400, #94a3b8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
