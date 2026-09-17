<script setup lang="ts">
/**
 * NotificationBadge - Clickable overlay for the sidebar footer logo
 *
 * Always rendered as a transparent click zone over the logo. It says three
 * things (#2677):
 * - something needs attention: the parent layout blinks the logo via
 *   :has(.notification-badge-zone--alert);
 * - how many entries are unread: a count;
 * - work is in progress: a ring, once tracked work has lasted `activityDelayMs`.
 *
 * Click toggles the notification panel open/close.
 */
import { computed } from 'vue'
import { useNotifications } from './NotificationStore'

const store = useNotifications()

const unread = computed(() => store.unreadCount.value)
const unreadLabel = computed(() => (unread.value > 99 ? '99+' : String(unread.value)))
</script>

<template>
  <div
    class="notification-badge-zone"
    :class="{ 'notification-badge-zone--alert': store.hasAlert.value || unread > 0 }"
    role="button"
    :aria-label="unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'"
    @click.stop.prevent="store.toggle()"
  >
    <span v-if="store.isBusy.value" class="notification-badge-ring" role="progressbar" aria-label="Loading" />
    <span v-if="unread > 0" class="notification-badge-count">{{ unreadLabel }}</span>
  </div>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.notification-badge-zone {
  position: absolute;
  inset: 0;
  cursor: pointer;
  z-index: 1;
}

.notification-badge-count {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--p-primary-color, #3b82f6);
  color: var(--p-primary-contrast-color, #fff);
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.1rem;
  text-align: center;
  pointer-events: none;
}

/* Work in progress: a ring around the logo. */
.notification-badge-ring {
  position: absolute;
  inset: -0.25rem;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--p-primary-color, #3b82f6);
  border-right-color: var(--p-primary-color, #3b82f6);
  animation: notification-badge-spin 0.9s linear infinite;
  pointer-events: none;
}

@keyframes notification-badge-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .notification-badge-ring {
    animation: none;
    border-color: var(--p-primary-color, #3b82f6);
    opacity: 0.5;
  }
}
</style>
