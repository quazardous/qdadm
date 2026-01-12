/**
 * DebugBridge - Central aggregator for debug collectors
 *
 * Manages multiple collectors and provides a unified interface
 * for the debug panel UI. Uses Vue reactivity for state management.
 *
 * @example
 * import { createDebugBridge, SignalCollector } from '@qdadm/core/debug'
 *
 * const debug = createDebugBridge()
 * debug.addCollector(new SignalCollector())
 * debug.install(ctx)
 */

import { ref, shallowReactive, type Ref, type ShallowReactive } from 'vue'
import type { Collector, CollectorContext } from './Collector'

/**
 * Debug bridge options
 */
export interface DebugBridgeOptions {
  enabled?: boolean
}

/**
 * Central aggregator for debug collectors
 */
export class DebugBridge {
  options: DebugBridgeOptions
  enabled: Ref<boolean>
  collectors: ShallowReactive<Map<string, Collector>>
  tick: Ref<number>
  private _installed: boolean = false
  private _ctx: CollectorContext | null = null

  /**
   * Create a new DebugBridge
   * @param options - Bridge options
   */
  constructor(options: DebugBridgeOptions = {}) {
    this.options = options
    this.enabled = ref(options.enabled ?? false)
    // Use shallowReactive to avoid deep reactivity on collector instances
    this.collectors = shallowReactive(new Map())
    // Reactive tick for UI updates - collectors increment this when they have new data
    this.tick = ref(0)
  }

  /**
   * Notify that a collector has new data
   * Called by collectors when they record new entries or state changes
   */
  notify(): void {
    // Defensive check - ensure tick is still a ref
    if (this.tick && typeof this.tick === 'object' && 'value' in this.tick) {
      this.tick.value++
    }
  }

  /**
   * Add a collector to the bridge
   * @param collector - Collector instance to add
   * @returns this for chaining
   */
  addCollector(collector: Collector): this {
    const name = (collector.constructor as typeof Collector).collectorName || collector.name
    // Set bridge reference for reactive notifications
    collector._bridge = this
    this.collectors.set(name, collector)
    if (this._installed && this.enabled.value && this._ctx) {
      collector.install(this._ctx)
    }
    return this
  }

  /**
   * Get a collector by name
   * @param name - Collector name
   * @returns The collector or undefined
   */
  getCollector(name: string): Collector | undefined {
    return this.collectors.get(name)
  }

  /**
   * Get all collectors
   * @returns All collectors
   */
  getAllCollectors(): Map<string, Collector> {
    return this.collectors
  }

  /**
   * Install all collectors
   * @param ctx - Context object with signals, router, etc.
   * @returns this for chaining
   */
  install(ctx: CollectorContext): this {
    this._ctx = ctx
    this._installed = true
    if (this.enabled.value) {
      for (const collector of this.collectors.values()) {
        collector.install(ctx)
      }
    }
    // Initial notify after all collectors are installed
    // Use nextTick to ensure Vue reactivity is ready
    setTimeout(() => this.notify(), 0)
    return this
  }

  /**
   * Uninstall all collectors and cleanup
   */
  uninstall(): void {
    for (const collector of this.collectors.values()) {
      collector.uninstall()
    }
    this.collectors.clear()
    this._installed = false
    this._ctx = null
  }

  /**
   * Toggle enabled state
   * When enabled, installs all collectors; when disabled, uninstalls them
   * @returns New enabled state
   */
  toggle(): boolean {
    this.enabled.value = !this.enabled.value
    if (this._installed && this._ctx) {
      if (this.enabled.value) {
        for (const collector of this.collectors.values()) {
          collector.install(this._ctx)
        }
      } else {
        for (const collector of this.collectors.values()) {
          collector.uninstall()
        }
      }
    }
    return this.enabled.value
  }

  /**
   * Clear all collectors' entries
   */
  clearAll(): void {
    for (const collector of this.collectors.values()) {
      collector.clear()
    }
  }

  /**
   * Get total badge count across all collectors
   * @param countAll - If true, count all entries; otherwise unseen only
   * @returns Total entry count
   */
  getTotalBadge(countAll = false): number {
    let total = 0
    for (const collector of this.collectors.values()) {
      total += collector.getBadge(countAll)
    }
    return total
  }
}

/**
 * Factory function to create a DebugBridge
 * @param options - Bridge options
 * @returns New DebugBridge instance
 */
export function createDebugBridge(options: DebugBridgeOptions = {}): DebugBridge {
  return new DebugBridge(options)
}
