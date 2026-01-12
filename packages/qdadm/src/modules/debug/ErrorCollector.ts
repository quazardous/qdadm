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

import { Collector, type CollectorContext, type CollectorEntry } from './Collector'

/**
 * Error entry type
 */
export interface ErrorEntry extends CollectorEntry {
  message?: string
  filename?: string
  lineno?: number
  colno?: number
  error?: string
  reason?: string
}

/**
 * Collector for JavaScript errors and unhandled promise rejections
 */
export class ErrorCollector extends Collector<ErrorEntry> {
  /**
   * Collector name identifier
   */
  static override collectorName = 'errors'

  private _handler: ((event: ErrorEvent) => void) | null = null
  private _rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null

  /**
   * Internal install - subscribe to error and unhandledrejection events
   * @protected
   */
  protected override _doInstall(_ctx: CollectorContext): void {
    this._handler = (event: ErrorEvent) => {
      this.record({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      })
    }
    this._rejectionHandler = (event: PromiseRejectionEvent) => {
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
  protected override _doUninstall(): void {
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
