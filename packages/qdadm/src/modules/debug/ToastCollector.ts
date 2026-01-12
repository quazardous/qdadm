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

import { Collector, type CollectorContext, type CollectorEntry } from './Collector'

/**
 * Toast entry type
 */
export interface ToastEntry extends CollectorEntry {
  severity: string
  summary?: string
  detail?: string
  life?: number
  emitter: string
}

/**
 * Collector for toast notifications
 */
export class ToastCollector extends Collector<ToastEntry> {
  /**
   * Collector name identifier
   */
  static override collectorName = 'toasts'

  private _unsubscribe: (() => void) | null = null

  /**
   * Internal install - subscribe to toast signals
   * @protected
   */
  protected override _doInstall(ctx: CollectorContext): void {
    // Listen for toast signals on the signal bus
    if (ctx?.signals) {
      this._unsubscribe = ctx.signals.on('toast:*', (event) => {
        const data = event.data as { summary?: string; detail?: string; life?: number; emitter?: string } | undefined
        this.record({
          severity: event.name.split(':')[1] ?? 'info', // toast:success -> success
          summary: data?.summary,
          detail: data?.detail,
          life: data?.life,
          emitter: data?.emitter ?? 'unknown'
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
  protected override _doUninstall(): void {
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
  }

  /**
   * Get entries by severity
   * @param severity - Severity level (success, info, warn, error)
   * @returns Filtered entries
   */
  getBySeverity(severity: string): ToastEntry[] {
    return this.entries.filter((entry) => entry.severity === severity)
  }

  /**
   * Get error toasts count for badge
   */
  getErrorCount(): number {
    return this.entries.filter((e) => e.severity === 'error').length
  }
}
