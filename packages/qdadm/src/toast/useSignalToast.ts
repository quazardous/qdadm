/**
 * useSignalToast - Composable for emitting toast notifications via signals
 *
 * This composable provides a simple API for showing toasts that go through
 * the signal bus. Works with ToastBridgeModule which handles displaying
 * the toasts via PrimeVue.
 *
 * @example
 * import { useSignalToast } from 'qdadm'
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
}

/**
 * Toast API returned by useSignalToast
 */
export interface SignalToastAPI {
  success: (summary: string, detail?: string, life?: number) => void
  error: (summary: string, detail?: string, life?: number) => void
  info: (summary: string, detail?: string, life?: number) => void
  warn: (summary: string, detail?: string, life?: number) => void
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
   */
  function addToast(severity: ToastSeverity, summary: string, detail?: string, life: number = 3000): void {
    signals.emit(`toast:${severity}`, { summary, detail, life, emitter: resolvedEmitter })
  }

  return {
    /**
     * Show success toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms
     */
    success(summary: string, detail?: string, life: number = 3000): void {
      addToast('success', summary, detail, life)
    },

    /**
     * Show error toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms (longer for errors)
     */
    error(summary: string, detail?: string, life: number = 5000): void {
      addToast('error', summary, detail, life)
    },

    /**
     * Show info toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms
     */
    info(summary: string, detail?: string, life: number = 3000): void {
      addToast('info', summary, detail, life)
    },

    /**
     * Show warning toast
     * @param summary - Toast title
     * @param detail - Toast detail message
     * @param life - Duration in ms
     */
    warn(summary: string, detail?: string, life: number = 4000): void {
      addToast('warn', summary, detail, life)
    },

    /**
     * Generic add method (compatible with PrimeVue toast.add)
     * @param options - Toast options
     */
    add(options: ToastOptions): void {
      addToast(options.severity || 'info', options.summary, options.detail, options.life)
    },
  }
}

export default useSignalToast
