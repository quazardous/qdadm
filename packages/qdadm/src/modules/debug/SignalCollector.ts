/**
 * SignalCollector - Debug collector for SignalBus events
 *
 * Extends the base Collector to capture all signals emitted through the SignalBus.
 * Uses wildcard subscription to capture all domain:action events.
 *
 * @example
 * const collector = new SignalCollector({ maxEntries: 50 })
 * collector.install(ctx) // ctx.signals is the SignalBus
 *
 * // Later, retrieve captured signals
 * collector.getEntries() // [{ name, data, source, timestamp }, ...]
 */

import { Collector, type CollectorContext, type CollectorEntry } from './Collector'

/**
 * Signal entry type
 */
export interface SignalEntry extends CollectorEntry {
  name: string
  data: unknown
  source: string | null
}

/**
 * Collector for SignalBus events
 *
 * Records all signals with their name, data, and source for debugging.
 * Uses the `**` wildcard pattern to capture all signals including
 * multi-segment names (e.g., entity:data-invalidate, auth:impersonate:start).
 */
export class SignalCollector extends Collector<SignalEntry> {
  /**
   * Collector name for identification
   */
  static override collectorName = 'signals'

  /**
   * Signals to skip recording (internal kernel signals with non-serializable data)
   * @private
   */
  private static _skipSignals = new Set(['kernel:ready', 'kernel:shutdown'])

  private _unsubscribe: (() => void) | null = null

  /**
   * Internal install - subscribe to all signals
   * @protected
   */
  protected override _doInstall(ctx: CollectorContext): void {
    if (!ctx?.signals) {
      console.warn('[SignalCollector] No signals bus found in context')
      return
    }

    // Subscribe to all signals using wildcard pattern
    // QuarKernel supports wildcards with the configured delimiter (:)
    // '**' matches all signals including multi-segment (entity:data-invalidate)
    this._unsubscribe = ctx.signals.on('**', (event) => {
      // Skip internal signals with non-serializable data (kernel, orchestrator)
      if (SignalCollector._skipSignals.has(event.name)) {
        return
      }

      // Sanitize data to avoid cyclic references
      const data = this._sanitizeData(event.data)

      this.record({
        name: event.name,
        data,
        source: (data as Record<string, unknown>)?.source as string ?? null
      })
    })
  }

  /**
   * Sanitize event data to remove non-serializable objects
   *
   * Handles cases where data contains references to Kernel, Orchestrator,
   * or other complex objects that would cause cyclic reference errors.
   *
   * @param data - Raw event data
   * @returns Sanitized data safe for recording
   * @private
   */
  private _sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) return data
    if (typeof data !== 'object') return data

    // Try to create a simple clone, fallback to description if cyclic
    try {
      const obj = data as Record<string, unknown>
      // Quick check for obviously problematic properties
      if (obj.kernel || obj.orchestrator || obj._kernel) {
        // Extract only safe properties
        const safe: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(obj)) {
          if (key !== 'kernel' && key !== 'orchestrator' && key !== '_kernel') {
            if (typeof value !== 'object' || value === null) {
              safe[key] = value
            } else if (Array.isArray(value)) {
              safe[key] = `[Array(${value.length})]`
            } else {
              safe[key] = '[Object]'
            }
          }
        }
        return safe
      }

      // For other objects, try JSON roundtrip to detect cycles
      JSON.stringify(data)
      return data
    } catch {
      // If serialization fails, return a safe representation
      return { _type: 'unserializable', keys: Object.keys(data as object) }
    }
  }

  /**
   * Internal uninstall - cleanup subscription
   * @protected
   */
  protected override _doUninstall(): void {
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
  }

  /**
   * Get entries filtered by signal name pattern
   *
   * @param pattern - Pattern to match signal names
   * @returns Filtered entries
   */
  getByPattern(pattern: string | RegExp): SignalEntry[] {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
    return this.entries.filter((entry) => regex.test(entry.name))
  }

  /**
   * Get entries for a specific signal domain
   *
   * @param domain - Domain prefix (e.g., 'entity', 'auth', 'books')
   * @returns Entries matching the domain
   */
  getByDomain(domain: string): SignalEntry[] {
    return this.entries.filter((entry) => entry.name.startsWith(`${domain}:`))
  }
}
