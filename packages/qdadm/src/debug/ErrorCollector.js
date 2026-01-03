/**
 * ErrorCollector - Captures JavaScript errors and unhandled promise rejections
 *
 * This collector listens to global window error events and unhandled promise
 * rejections, recording them for display in the debug panel.
 *
 * @example
 * const collector = new ErrorCollector()
 * collector.install(ctx)
 * // Errors are now automatically recorded
 * // Later...
 * collector.uninstall()
 */

import { Collector } from './Collector.js'

/**
 * Collector for JavaScript errors and unhandled promise rejections
 */
export class ErrorCollector extends Collector {
  /**
   * Collector name identifier
   * @type {string}
   */
  static name = 'errors'

  /**
   * Internal install - subscribe to error and unhandledrejection events
   * @param {object} ctx - Context object (not used for error collection)
   * @protected
   */
  _doInstall(ctx) {
    this._handler = (event) => {
      this.record({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      })
    }
    this._rejectionHandler = (event) => {
      this.record({
        message: 'Unhandled Promise Rejection',
        reason: String(event.reason)
      })
    }
    window.addEventListener('error', this._handler)
    window.addEventListener('unhandledrejection', this._rejectionHandler)
  }

  /**
   * Internal uninstall - remove event listeners
   * @protected
   */
  _doUninstall() {
    if (this._handler) {
      window.removeEventListener('error', this._handler)
      this._handler = null
    }
    if (this._rejectionHandler) {
      window.removeEventListener('unhandledrejection', this._rejectionHandler)
      this._rejectionHandler = null
    }
  }
}
