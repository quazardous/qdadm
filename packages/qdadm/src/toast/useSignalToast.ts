/**
 * useSignalToast - Composable for emitting toast notifications via signals
 *
 * This composable provides a simple API for showing toasts that go through
 * the signal bus. Works with ToastBridgeModule which handles displaying
 * the toasts via PrimeVue.
 *
 * @example
 * import { useSignalToast } from '@quazardous/qdadm'
 *
 * // With explicit emitter name
 * const toast = useSignalToast('MyComponent')
 * toast.success('Saved!', 'Your changes have been saved')
 *
 * // Without emitter (defaults to 'unknown')
 * const toast = useSignalToast()
 * toast.error('Error', 'Something went wrong')
 */

import { inject, getCurrentInstance } from 'vue'
import type { SignalBus } from '../kernel/SignalBus'
import type { NotificationKeep, NotificationTarget } from '../notifications/NotificationStore'

/**
 * Toast severity types
 */
export type ToastSeverity = 'success' | 'info' | 'warn' | 'error'

/**
 * Toast options for the add method
 */
export interface ToastOptions {
  severity?: ToastSeverity
  summary: string
  detail?: string
  life?: number
  /** @deprecated Toasts always pop up now (#2677); kept for compatibility, it does nothing. */
  forceToast?: boolean
  /** How long the notification history keeps it (#2677); default by severity. */
  keep?: NotificationKeep
  /** Where its history entry leads: a vue-router location. */
  to?: NotificationTarget
}

/**
 * Toast method options
 */
export interface ToastMethodOptions {
  /** @deprecated Toasts always pop up now (#2677); kept for compatibility, it does nothing. */
  forceToast?: boolean
  /** How long the notification history keeps it (#2677); default by severity. */
  keep?: NotificationKeep
  /** Where its history entry leads: a vue-router location. */
  to?: NotificationTarget
}

/**
 * Toast API returned by useSignalToast
 */
export interface SignalToastAPI {
  success: (summary: string, detail?: string, life?: number, options?: ToastMethodOptions) => void
  error: (summary: string, detail?: string, life?: number, options?: ToastMethodOptions) => void
  info: (summary: string, detail?: string, life?: number, options?: ToastMethodOptions) => void
  warn: (summary: string, detail?: string, life?: number, options?: ToastMethodOptions) => void
  add: (options: ToastOptions) => void
}

/**
 * Composable for emitting toast notifications via signal bus
 * @param emitter - Identifier for the toast source (component/module name)
 * @returns Toast API
 */
export function useSignalToast(emitter?: string): SignalToastAPI {
  const injectedSignals = inject<SignalBus | undefined>('qdadmSignals')

  // Try to auto-detect emitter from current component if not provided
  const instance = getCurrentInstance()
  const componentType = instance?.type as { name?: string; __name?: string } | undefined
  const resolvedEmitter = emitter || componentType?.name || componentType?.__name || 'unknown'

  if (!injectedSignals) {
    console.warn('[useSignalToast] No signals bus injected - toasts will not work')
    // Return no-op functions
    return {
      success: () => {},
      error: () => {},
      info: () => {},
      warn: () => {},
      add: () => {},
    }
  }

  // Capture signals after null check for closure
  const signals = injectedSignals

  /**
   * Show a toast notification
   * @param severity - Toast severity (success, info, warn, error)
   * @param summary - Toast title
   * @param detail - Toast detail message
   * @param life - Duration in ms (0 for sticky)
   * @param options - keep and to, for the notification history (#2677)
   */
  function addToast(severity: ToastSeverity, summary: string, detail?: string, life: number = 3000, options?: ToastMethodOptions): void {
    signals.emit(`toast:${severity}`, {
      summary,
      detail,
      life,
      emitter: resolvedEmitter,
      ...(options?.forceToast !== undefined ? { forceToast: options.forceToast } : {}),
      ...(options?.keep !== undefined ? { keep: options.keep } : {}),
      ...(options?.to !== undefined ? { to: options.to } : {}),
    })
  }

  return {
    /**
     * Show success toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms
     * @param options - Additional options
     */
    success(summary: string, detail?: string, life: number = 3000, options?: ToastMethodOptions): void {
      addToast('success', summary, detail, life, options)
    },

    /**
     * Show error toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms (longer for errors)
     * @param options - Additional options
     */
    error(summary: string, detail?: string, life: number = 5000, options?: ToastMethodOptions): void {
      addToast('error', summary, detail, life, options)
    },

    /**
     * Show info toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms
     * @param options - Additional options
     */
    info(summary: string, detail?: string, life: number = 3000, options?: ToastMethodOptions): void {
      addToast('info', summary, detail, life, options)
    },

    /**
     * Show warning toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms
     * @param options - Additional options
     */
    warn(summary: string, detail?: string, life: number = 4000, options?: ToastMethodOptions): void {
      addToast('warn', summary, detail, life, options)
    },

    /**
     * Generic add method (compatible with PrimeVue toast.add)
     * @param options - Toast options
     */
    add(options: ToastOptions): void {
      addToast(options.severity || 'info', options.summary, options.detail, options.life, options)
    },
  }
}

export default useSignalToast
