/**
 * NotificationModule - Optional notification panel system
 *
 * When loaded, this module:
 * - Replaces the default ToastListener with NotificationListener
 *   (captures toasts to notification store instead of ephemeral PrimeVue toasts)
 * - Registers NotificationBadge for the sidebar footer logo overlay
 * - Registers NotificationPanel zone for the panel component
 *
 * Without this module, classic toast behavior is unchanged (ToastBridgeModule).
 * With this module, toasts are captured. Use `forceToast: true` in signal data
 * to also show a classic PrimeVue toast.
 *
 * @example
 * // In kernel config
 * const kernel = new Kernel({
 *   notifications: { enabled: true, maxNotifications: 100 }
 * })
 */

import { Module } from '../kernel/Module'
import type { KernelContext } from '../kernel/KernelContext'
import { TOAST_ZONE } from '../toast/ToastBridgeModule'
import NotificationListener from './NotificationListener.vue'
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

    // Replace the toast-listener block in the toast zone with our NotificationListener.
    // This intercepts toast signals and captures them to the notification store.
    // The toast zone is defined by ToastBridgeModule - we replace its listener block.
    ctx.zone(TOAST_ZONE) // Ensure the zone exists
    ctx.block(TOAST_ZONE, {
      id: 'toast-listener',
      component: NotificationListener,
      weight: 0,
      operation: 'replace',
      replaces: 'toast-listener',
    })

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
