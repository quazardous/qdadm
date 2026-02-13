<script setup lang="ts">
/**
 * NotificationBadge - Clickable overlay for the sidebar footer logo
 *
 * Always rendered as a transparent click zone over the logo.
 * When there are alerts, the parent layout applies an opacity blink
 * on the logo wrapper via :has(.notification-badge-zone--alert).
 *
 * Click toggles the notification panel open/close.
 */
import { useNotifications } from './NotificationStore'

const store = useNotifications()
</script>

<template>
  <div
    class="notification-badge-zone"
    :class="{ 'notification-badge-zone--alert': store.hasAlert.value || store.unreadCount.value > 0 }"
    @click.stop.prevent="store.toggle()"
  />
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
</style>
