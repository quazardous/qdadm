/**
 * NotificationModule - Optional notification panel system
 *
 * When loaded, this module:
 * - Registers NotificationBadge for the sidebar footer logo overlay
 * - Registers NotificationPanel zone for the panel component
 *
 * Toasts keep showing as pop-ups; the kernel's ToastListener also records each
 * one in the store, for as long as its keep level says (#2677). This module used
 * to swap the listener inside the `_app:toasts` zone, which nothing renders — so
 * no toast was ever recorded. See docs/notifications.md.
 *
 * @example
 * // In kernel config
 * const kernel = new Kernel({
 *   notifications: { enabled: true, maxNotifications: 100 }
 * })
 */

import { Module } from '../kernel/Module'
import type { KernelContext } from '../kernel/KernelContext'
import NotificationBadge from './NotificationBadge.vue'
import NotificationPanel from './NotificationPanel.vue'

/**
 * Zone names for notification components
 */
export const NOTIFICATION_ZONE = '_app:notifications'
export const NOTIFICATION_BADGE_ZONE = '_app:notification-badge'
export const NOTIFICATION_STATUS_ZONE = '_app:notification-status'

export class NotificationModule extends Module {
  static override moduleName = 'notifications'
  static override requires: string[] = []
  static override priority = 5 // Before toast-bridge (10) to intercept first

  static override styles = () => import('./styles.scss')

  async connect(ctx: KernelContext): Promise<void> {
    // Define notification zones
    ctx.zone(NOTIFICATION_ZONE)
    ctx.zone(NOTIFICATION_BADGE_ZONE)
    ctx.zone(NOTIFICATION_STATUS_ZONE)

    // Register badge component for sidebar footer overlay
    ctx.block(NOTIFICATION_BADGE_ZONE, {
      id: 'notification-badge',
      component: NotificationBadge,
      weight: 0,
    })

    // Register panel component
    ctx.block(NOTIFICATION_ZONE, {
      id: 'notification-panel',
      component: NotificationPanel,
      weight: 0,
    })
  }
}

export default NotificationModule
