/**
 * Notifications Module - Optional notification panel system
 *
 * Provides toast capture, notification history, custom status items,
 * and a panel UI anchored to the sidebar.
 *
 * Usage:
 * ```ts
 * import { NotificationModule, useNotifications } from 'qdadm'
 *
 * // Enable via kernel config
 * const kernel = new Kernel({
 *   notifications: { enabled: true }
 * })
 *
 * // Use in components
 * const { notifications, unreadCount, registerStatus } = useNotifications()
 * ```
 */

export {
  NotificationModule,
  NOTIFICATION_ZONE,
  NOTIFICATION_BADGE_ZONE,
  NOTIFICATION_STATUS_ZONE,
} from './NotificationModule'

export {
  useNotifications,
  createNotificationStore,
  provideNotificationStore,
  NOTIFICATION_KEY,
  type Notification,
  type NotificationSeverity,
  type StatusItem,
  type NotificationStore,
  type NotificationStoreConfig,
} from './NotificationStore'

export { default as NotificationListener } from './NotificationListener.vue'
export { default as NotificationPanel } from './NotificationPanel.vue'
export { default as NotificationBadge } from './NotificationBadge.vue'
