<script setup lang="ts">
/**
 * NotificationPanel - Notification panel anchored to the sidebar
 *
 * Position:
 * - Desktop: Fixed, left edge aligned to sidebar right edge, bottom of screen
 * - Collapsed sidebar: Follows collapsed width
 * - Mobile: Full width overlay at bottom of screen
 *
 * Features:
 * - Inline action bar (mark read, clear, close) at top right
 * - Status items section (custom module items)
 * - Notification list (most recent first)
 * - Empty state
 */
import { RouterLink } from 'vue-router'
import { useNotifications } from './NotificationStore'
import type { NotificationSeverity } from './NotificationStore'

const store = useNotifications()

const severityIcons: Record<NotificationSeverity, string> = {
  success: 'pi pi-check-circle',
  info: 'pi pi-info-circle',
  warn: 'pi pi-exclamation-triangle',
  error: 'pi pi-times-circle',
}

const statusIcons: Record<string, string> = {
  nominal: 'pi pi-check',
  warn: 'pi pi-exclamation-triangle',
  error: 'pi pi-times-circle',
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return date.toLocaleDateString()
}
</script>

<template>
  <Transition name="notification-panel">
    <div
      v-if="store.isOpen.value"
      class="notification-panel"
    >
      <!-- Inline toolbar -->
      <div class="notification-toolbar">
        <button
          v-if="store.unreadCount.value > 0"
          class="notification-toolbar-btn"
          title="Mark all read"
          @click="store.markAllRead()"
        >
          <i class="pi pi-check-circle" />
        </button>
        <button
          v-if="store.notifications.value.length > 0"
          class="notification-toolbar-btn"
          title="Clear all"
          @click="store.clearNotifications()"
        >
          <i class="pi pi-trash" />
        </button>
        <button
          class="notification-toolbar-btn notification-toolbar-close"
          title="Close"
          @click="store.close()"
        >
          <i class="pi pi-times" />
        </button>
      </div>

      <!-- Status items -->
      <div
        v-if="store.statusItems.value.length > 0"
        class="notification-panel-status"
      >
        <component
          v-for="item in store.statusItems.value"
          :key="item.id"
          :is="item.to ? RouterLink : 'div'"
          :to="item.to || undefined"
          class="notification-status-item"
          :class="[
            `notification-status-item--${item.severity}`,
            { 'notification-status-item--link': !!item.to }
          ]"
          @click="item.to ? store.close() : undefined"
        >
          <i :class="item.icon || statusIcons[item.severity]" />
          <span class="notification-status-label">{{ item.label }}</span>
          <i v-if="item.to" class="pi pi-chevron-right notification-status-arrow" />
          <span v-else-if="item.count != null" class="notification-status-count">{{ item.count }}</span>
        </component>
      </div>

      <!-- Notification list -->
      <div class="notification-panel-list">
        <div
          v-for="notif in store.notifications.value"
          :key="notif.id"
          class="notification-item"
          :class="{
            'notification-item--unread': !notif.read,
            [`notification-item--${notif.severity}`]: true,
          }"
          @click="store.markRead(notif.id)"
        >
          <div class="notification-item-icon">
            <i :class="severityIcons[notif.severity]" />
          </div>
          <div class="notification-item-content">
            <div class="notification-item-summary">{{ notif.summary }}</div>
            <div v-if="notif.detail" class="notification-item-detail">{{ notif.detail }}</div>
            <div class="notification-item-meta">
              <span class="notification-item-time">{{ formatTime(notif.timestamp) }}</span>
              <span v-if="notif.emitter" class="notification-item-emitter">{{ notif.emitter }}</span>
            </div>
          </div>
          <button
            class="notification-item-dismiss"
            title="Dismiss"
            @click.stop="store.removeNotification(notif.id)"
          >
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Empty state -->
        <div
          v-if="store.notifications.value.length === 0 && store.statusItems.value.length === 0"
          class="notification-panel-empty"
        >
          <i class="pi pi-bell" />
          <span>No notifications</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/*
 * Only keep styles here that REQUIRE scoping (:deep, dynamic binding, component-specific overrides).
 * Generic/reusable styles belong in src/styles/ partials (see _forms.scss, _cards.scss, etc.).
 */
.notification-panel {
  position: fixed;
  left: calc(var(--fad-sidebar-width, 15rem) + 0.375rem);
  bottom: 0.5rem;
  width: 22rem;
  min-height: 6.6rem;
  max-height: 50vh;
  background: var(--p-surface-0, #ffffff);
  border: 1px solid var(--p-surface-200, #e2e8f0);
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 200;
  overflow: hidden;
}

/* Collapsed sidebar */
:root:has(.sidebar--collapsed) .notification-panel {
  left: calc(var(--fad-sidebar-width-collapsed, 2.5rem) + 0.375rem);
}

/* Inline toolbar - floats top-right inside the panel */
.notification-toolbar {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0.25rem;
  z-index: 1;
}

.notification-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  border: none;
  background: none;
  border-radius: 2px;
  color: var(--p-surface-400, #94a3b8);
  cursor: pointer;
  font-size: 0.6875rem;
  transition: color 0.1s, background 0.1s;
}

.notification-toolbar-btn:hover {
  background: var(--p-surface-100, #f1f5f9);
  color: var(--p-surface-600, #475569);
}

.notification-toolbar-close:hover {
  color: var(--p-surface-700, #334155);
}

/* Status items */
.notification-panel-status {
  padding: 0.5rem 0.625rem;
  padding-right: 2.5rem;
  border-bottom: 1px solid var(--p-surface-100, #f1f5f9);
  flex-shrink: 0;
}

.notification-status-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.1875rem 0;
  font-size: 0.75rem;
  color: var(--p-surface-600, #475569);
}

.notification-status-item i {
  font-size: 0.6875rem;
}

.notification-status-item--nominal i {
  color: var(--p-green-500, #22c55e);
}

.notification-status-item--warn i {
  color: var(--p-orange-500, #f97316);
}

.notification-status-item--error i {
  color: var(--p-red-500, #ef4444);
}

.notification-status-label {
  flex: 1;
}

.notification-status-count {
  font-weight: 600;
  font-size: 0.6875rem;
}

.notification-status-item--link {
  text-decoration: none;
  cursor: pointer;
  border-radius: 2px;
  padding: 0.1875rem 0.375rem;
  margin: 0 -0.375rem;
  transition: background 0.1s;
}

.notification-status-item--link:hover {
  background: var(--p-surface-50, #f8fafc);
}

.notification-status-arrow {
  font-size: 0.5625rem;
  opacity: 0;
  transition: opacity 0.1s;
  color: var(--p-surface-400, #94a3b8);
}

.notification-status-item--link:hover .notification-status-arrow {
  opacity: 1;
}

/* Notification list */
.notification-panel-list {
  flex: 1;
  overflow-y: auto;
  max-height: calc(50vh - 3rem);
}

/* Individual notification */
.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid var(--p-surface-50, #f8fafc);
  cursor: pointer;
  transition: background 0.1s;
}

.notification-item:first-child {
  padding-right: 2.5rem;
}

.notification-item:hover {
  background: var(--p-surface-50, #f8fafc);
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item--unread {
  background: var(--p-blue-50, #eff6ff);
}

.notification-item--unread:hover {
  background: var(--p-blue-100, #dbeafe);
}

.notification-item-icon {
  flex-shrink: 0;
  width: 1.125rem;
  height: 1.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.0625rem;
}

.notification-item-icon i {
  font-size: 0.75rem;
}

.notification-item--success .notification-item-icon i {
  color: var(--p-green-500, #22c55e);
}

.notification-item--info .notification-item-icon i {
  color: var(--p-blue-500, #3b82f6);
}

.notification-item--warn .notification-item-icon i {
  color: var(--p-orange-500, #f97316);
}

.notification-item--error .notification-item-icon i {
  color: var(--p-red-500, #ef4444);
}

.notification-item-content {
  flex: 1;
  min-width: 0;
}

.notification-item-summary {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--p-surface-700, #334155);
  line-height: 1.3;
}

.notification-item-detail {
  font-size: 0.6875rem;
  color: var(--p-surface-500, #64748b);
  margin-top: 0.0625rem;
  line-height: 1.3;
}

.notification-item-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.125rem;
  font-size: 0.625rem;
  color: var(--p-surface-400, #94a3b8);
}

.notification-item-emitter::before {
  content: '\00b7';
  margin-right: 0.375rem;
}

.notification-item-dismiss {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  border: none;
  background: none;
  border-radius: 2px;
  color: var(--p-surface-400, #94a3b8);
  cursor: pointer;
  font-size: 0.5625rem;
  opacity: 0;
  transition: opacity 0.1s;
}

.notification-item:hover .notification-item-dismiss {
  opacity: 1;
}

.notification-item-dismiss:hover {
  background: var(--p-surface-200, #e2e8f0);
  color: var(--p-surface-600, #475569);
}

/* Empty state */
.notification-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  color: var(--p-surface-300, #cbd5e1);
  gap: 0.375rem;
}

.notification-panel-empty i {
  font-size: 1.25rem;
}

.notification-panel-empty span {
  font-size: 0.75rem;
}

/* Transition */
.notification-panel-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.notification-panel-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.notification-panel-enter-from,
.notification-panel-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

/* Mobile: full width bottom overlay */
@media (max-width: 767px) {
  .notification-panel {
    left: 0 !important;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: 60vh;
    border-radius: 2px 2px 0 0;
    border-bottom: none;
  }
}

/* Dark mode */
.dark-mode .notification-panel {
  background: var(--p-surface-800, #1e293b);
  border-color: var(--p-surface-700, #334155);
}

.dark-mode .notification-toolbar-btn:hover {
  background: var(--p-surface-700, #334155);
  color: var(--p-surface-300, #cbd5e1);
}

.dark-mode .notification-item--unread {
  background: rgba(59, 130, 246, 0.1);
}

.dark-mode .notification-item:hover {
  background: var(--p-surface-700, #334155);
}

.dark-mode .notification-item--unread:hover {
  background: rgba(59, 130, 246, 0.15);
}
</style>
