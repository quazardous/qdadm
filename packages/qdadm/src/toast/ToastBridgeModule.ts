/**
 * ToastBridgeModule - Bridges signal bus to PrimeVue Toast
 *
 * This module integrates toast functionality via the signal bus:
 * - Registers ToastListener component to handle toast:* signals
 * - Provides useSignalToast() composable for emitting toasts
 *
 * Usage in modules:
 *   import { useSignalToast } from 'qdadm'
 *   const toast = useSignalToast()
 *   toast.success('Saved!', 'Your changes have been saved')
 *   toast.error('Error', 'Something went wrong')
 *
 * @example
 * import { createKernel, ToastBridgeModule } from 'qdadm'
 *
 * const kernel = createKernel()
 * kernel.use(new ToastBridgeModule())
 * await kernel.boot()
 */

import { Module } from '../kernel/Module'
import type { KernelContext } from '../kernel/KernelContext'
import ToastListener from './ToastListener.vue'

/**
 * Zone name for toast listener component
 * Prefixed with _ to hide from ZonesCollector (internal zone)
 */
export const TOAST_ZONE = '_app:toasts'

/**
 * ToastBridgeModule - Handles toast notifications via signals
 */
export class ToastBridgeModule extends Module {
  /**
   * Module identifier
   */
  static override moduleName = 'toast-bridge'

  /**
   * No dependencies
   */
  static override requires: string[] = []

  /**
   * High priority - should load early
   */
  static override priority = 10

  /**
   * Connect module to kernel
   * @param ctx - Kernel context
   */
  async connect(ctx: KernelContext): Promise<void> {
    // Define the toast zone
    ctx.zone(TOAST_ZONE)

    // Register ToastListener component in the zone
    ctx.block(TOAST_ZONE, {
      id: 'toast-listener',
      component: ToastListener,
      weight: 0,
    })
  }
}

export default ToastBridgeModule
