<script setup>
/**
 * MainLayout - Demo-specific layout extending AppLayout
 *
 * Adds UserImpersonator to the sidebar for testing permission-based UI.
 * All base layout functionality comes from AppLayout.
 */

import { ref, onMounted, onUnmounted, inject } from 'vue'
import { AppLayout } from 'qdadm/components'
import UserImpersonator from '../components/UserImpersonator.vue'

const orchestrator = inject('qdadmOrchestrator')

// Impersonation state detection for styling
const AUTH_STORAGE_KEY = 'qdadm_demo_auth'
const isImpersonating = ref(false)
const signalCleanups = []

function checkImpersonationState() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}')
    isImpersonating.value = !!auth.originalUser
  } catch {
    isImpersonating.value = false
  }
}

onMounted(() => {
  checkImpersonationState()

  // Listen for impersonation changes
  const signals = orchestrator?.signals
  if (signals) {
    signalCleanups.push(signals.on('auth:impersonate', () => checkImpersonationState()))
    signalCleanups.push(signals.on('auth:impersonate:stop', () => checkImpersonationState()))
  }
})

onUnmounted(() => {
  for (const cleanup of signalCleanups) {
    if (typeof cleanup === 'function') cleanup()
  }
})
</script>

<template>
  <AppLayout :class="{ 'layout--impersonating': isImpersonating }">
    <template #sidebar-after-nav>
      <UserImpersonator />
    </template>
  </AppLayout>
</template>

<style scoped>
/* Demo-specific: Impersonation visual indicator - target SidebarBox classes */
.layout--impersonating :deep(#user-zone .sidebar-box-title) {
  color: var(--p-orange-400, #fb923c);
}

.layout--impersonating :deep(#user-zone .sidebar-box-subtitle) {
  color: var(--p-orange-300, #fdba74);
}

.layout--impersonating :deep(#user-zone .sidebar-box-icon) {
  color: var(--p-orange-400, #fb923c);
}

.layout--impersonating :deep(#user-zone .user-avatar) {
  background: var(--p-orange-600, #ea580c);
  color: var(--p-orange-100, #ffedd5);
}
</style>
