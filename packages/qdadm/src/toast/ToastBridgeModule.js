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

import { Module } from '../kernel/Module.js'
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
   * @type {string}
   */
  static name = 'toast-bridge'

  /**
   * No dependencies
   * @type {string[]}
   */
  static requires = []

  /**
   * High priority - should load early
   * @type {number}
   */
  static priority = 10

  /**
   * Connect module to kernel
   * @param {import('../kernel/KernelContext.js').KernelContext} ctx
   */
  async connect(ctx) {
    // Define the toast zone
    ctx.zone(TOAST_ZONE)

    // Register ToastListener component in the zone
    ctx.block(TOAST_ZONE, {
      id: 'toast-listener',
      component: ToastListener,
      weight: 0
    })
  }
}

export default ToastBridgeModule
