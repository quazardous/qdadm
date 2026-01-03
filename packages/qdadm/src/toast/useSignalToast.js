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

/**
 * Composable for emitting toast notifications via signal bus
 * @param {string} [emitter] - Identifier for the toast source (component/module name)
 * @returns {object} Toast API
 */
export function useSignalToast(emitter) {
  const signals = inject('qdadmSignals')

  // Try to auto-detect emitter from current component if not provided
  const instance = getCurrentInstance()
  const resolvedEmitter =
    emitter || instance?.type?.name || instance?.type?.__name || 'unknown'

  if (!signals) {
    console.warn('[useSignalToast] No signals bus injected - toasts will not work')
    // Return no-op functions
    return {
      success: () => {},
      error: () => {},
      info: () => {},
      warn: () => {},
      add: () => {}
    }
  }

  /**
   * Show a toast notification
   * @param {string} severity - Toast severity (success, info, warn, error)
   * @param {string} summary - Toast title
   * @param {string} [detail] - Toast detail message
   * @param {number} [life=3000] - Duration in ms (0 for sticky)
   */
  function add(severity, summary, detail, life = 3000) {
    signals.emit(`toast:${severity}`, { summary, detail, life, emitter: resolvedEmitter })
  }

  return {
    /**
     * Show success toast
     * @param {string} summary - Toast title
     * @param {string} [detail] - Toast detail message
     * @param {number} [life=3000] - Duration in ms
     */
    success(summary, detail, life = 3000) {
      add('success', summary, detail, life)
    },

    /**
     * Show error toast
     * @param {string} summary - Toast title
     * @param {string} [detail] - Toast detail message
     * @param {number} [life=5000] - Duration in ms (longer for errors)
     */
    error(summary, detail, life = 5000) {
      add('error', summary, detail, life)
    },

    /**
     * Show info toast
     * @param {string} summary - Toast title
     * @param {string} [detail] - Toast detail message
     * @param {number} [life=3000] - Duration in ms
     */
    info(summary, detail, life = 3000) {
      add('info', summary, detail, life)
    },

    /**
     * Show warning toast
     * @param {string} summary - Toast title
     * @param {string} [detail] - Toast detail message
     * @param {number} [life=4000] - Duration in ms
     */
    warn(summary, detail, life = 4000) {
      add('warn', summary, detail, life)
    },

    /**
     * Generic add method (compatible with PrimeVue toast.add)
     * @param {object} options - Toast options
     * @param {string} options.severity - Toast severity
     * @param {string} options.summary - Toast title
     * @param {string} [options.detail] - Toast detail
     * @param {number} [options.life] - Duration in ms
     */
    add(options) {
      add(options.severity || 'info', options.summary, options.detail, options.life)
    }
  }
}

export default useSignalToast
