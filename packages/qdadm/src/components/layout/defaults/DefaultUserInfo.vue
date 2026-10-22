<script setup lang="ts">
/**
 * DefaultUserInfo - Default user info component for sidebar
 *
 * Displays user avatar, name, role, and logout button.
 * Extracted from AppLayout for zone-based architecture.
 *
 * This component is used when auth is enabled.
 */
import { useRouter, RouterLink } from 'vue-router'
import { useAuth } from '../../../composables/useAuth'
import { useUserBox } from '../../../composables/useUserBox'
import { useI18n } from '../../../i18n/useI18n'
import QdButton from '../../base/QdButton.vue'

const router = useRouter()
const { logout, authEnabled } = useAuth()
const { displayName: userDisplayName, subtitle: userSubtitle, initials: userInitials, avatarUrl, avatarFailed, userLink } = useUserBox()
const { tOr } = useI18n()

function handleLogout(): void {
  logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div v-if="authEnabled" class="default-user-info">
    <!-- With app.userRoute (#4157): avatar and name open the profile -->
    <component
      :is="!userLink ? 'div' : userLink.is === 'a' ? 'a' : RouterLink"
      v-bind="userLink ? { ...userLink.attrs, title: tOr('core.actions.profile', 'My profile') } : {}"
      class="user-identity"
      :class="{ 'user-identity--link': userLink }"
    >
      <img v-if="avatarUrl" class="user-avatar user-avatar--image" :src="avatarUrl" alt="" referrerpolicy="no-referrer" @error="avatarFailed" />
      <div v-else class="user-avatar">{{ userInitials }}</div>
      <div class="user-details">
        <div class="user-name">{{ userDisplayName }}</div>
        <div class="user-role">{{ userSubtitle }}</div>
      </div>
    </component>
    <QdButton
      icon="pi pi-sign-out"
      severity="secondary"
      text
      rounded
      :aria-label="tOr('core.actions.logout', 'Logout')"
      @click="handleLogout"
      v-tooltip.top="tOr('core.actions.logout', 'Logout')"
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

.user-identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.user-identity--link {
  border-radius: 6px;
}

.user-identity--link:hover .user-name {
  text-decoration: underline;
}

.user-avatar {
  flex-shrink: 0;
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

.user-avatar--image {
  object-fit: cover;
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
