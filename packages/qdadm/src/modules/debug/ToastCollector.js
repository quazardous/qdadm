/**
 * ToastCollector - Captures toast notifications via signal bus
 *
 * This collector listens to toast signals emitted on the signal bus
 * and records them for display in the debug panel.
 *
 * Toast signals should follow the pattern:
 * - signals.emit('toast:success', { summary: '...', detail: '...' })
 * - signals.emit('toast:error', { summary: '...', detail: '...' })
 * - signals.emit('toast:info', { summary: '...', detail: '...' })
 * - signals.emit('toast:warn', { summary: '...', detail: '...' })
 *
 * Use with ToastBridge module which handles displaying toasts via PrimeVue.
 *
 * @example
 * const collector = new ToastCollector()
 * collector.install(ctx)
 * // Toasts emitted via signals are now automatically recorded
 */

import { Collector } from './Collector.js'

/**
 * Collector for toast notifications
 */
export class ToastCollector extends Collector {
  /**
   * Collector name identifier
   * @type {string}
   */
  static name = 'toasts'

  /**
   * Internal install - subscribe to toast signals
   * @param {object} ctx - Context object
   * @protected
   */
  _doInstall(ctx) {
    // Listen for toast signals on the signal bus
    if (ctx?.signals) {
      this._unsubscribe = ctx.signals.on('toast:*', (event) => {
        this.record({
          severity: event.name.split(':')[1], // toast:success -> success
          summary: event.data?.summary,
          detail: event.data?.detail,
          life: event.data?.life,
          emitter: event.data?.emitter || 'unknown'
        })
      })
    } else {
      console.warn('[ToastCollector] No signals bus in context - toast recording disabled')
    }
  }

  /**
   * Internal uninstall - cleanup
   * @protected
   */
  _doUninstall() {
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
  }

  /**
   * Get entries by severity
   * @param {string} severity - Severity level (success, info, warn, error)
   * @returns {Array<object>} Filtered entries
   */
  getBySeverity(severity) {
    return this.entries.filter((entry) => entry.severity === severity)
  }

  /**
   * Get error toasts count for badge
   * @returns {number}
   */
  getErrorCount() {
    return this.entries.filter((e) => e.severity === 'error').length
  }
}
