/**
 * DebugBridge - Central aggregator for debug collectors.
 *
 * Manages multiple collectors and provides a unified interface for the debug
 * panel UI. Uses Vue reactivity for state management.
 *
 * Framework-agnostic except for Vue (`ref` / `shallowReactive`) — the bar UI
 * needs reactive bindings. If you need a Vue-free bridge, fork this class.
 *
 * @example
 * import { createDebugBridge } from '@quazardous/qddebug'
 * import { SignalCollector } from '@quazardous/qddebug/collectors'
 *
 * const debug = createDebugBridge()
 * debug.addCollector(new SignalCollector())
 * debug.install({ signals })
 */

import { ref, shallowReactive, type Ref, type ShallowReactive } from 'vue'
import type {
  Collector,
  CollectorContext,
  CollectorManifest,
  CollectorSnapshot,
} from './Collector'

export interface BridgeManifest {
  version: '1'
  enabled: boolean
  tick: number
  collectors: Record<string, CollectorManifest>
}

export interface BridgeSnapshot {
  version: '1'
  enabled: boolean
  tick: number
  takenAt: number
  collectors: Record<string, CollectorSnapshot>
}

export interface DebugBridgeOptions {
  enabled?: boolean
}

export class DebugBridge {
  options: DebugBridgeOptions
  enabled: Ref<boolean>
  collectors: ShallowReactive<Map<string, Collector>>
  tick: Ref<number>
  /** True while describe()/dump() walks the collectors — see notify(). */
  private _reading: boolean
  /** A tick is already queued for the next frame — see notify(). */
  private _notifyScheduled: boolean
  private _installed: boolean = false
  private _ctx: CollectorContext | null = null

  constructor(options: DebugBridgeOptions = {}) {
    this.options = options
    this.enabled = ref(options.enabled ?? false)
    this.collectors = shallowReactive(new Map())
    this.tick = ref(0)
    this._reading = false
    this._notifyScheduled = false
  }

  /**
   * Bump the reactive tick that tells observers something changed.
   *
   * Inert while a snapshot is being produced (#1896): observing must not
   * perturb. A collector that emits during `dump()` — resolving a missing i18n
   * key, say — would otherwise feed the very tick the snapshot pusher watches,
   * and the observer becomes an actor in the system it claims to describe.
   */
  notify(): void {
    if (this._reading) return
    if (!this.tick || typeof this.tick !== 'object' || !('value' in this.tick)) return

    // Coalesce to at most one tick per frame (#1896 lot B).
    //
    // The structural half of the fix: A closes the cycle we found, B makes the
    // whole CLASS survivable. A future collector that notifies in a loop then
    // costs one tick per frame instead of thousands per second — a measurable
    // slowdown rather than a dead page.
    if (this._notifyScheduled) return
    this._notifyScheduled = true

    const flush = (): void => {
      this._notifyScheduled = false
      this.tick.value++
    }

    // rAF where there is a document; a timer in tests and Node.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(flush)
    } else {
      setTimeout(flush, 0)
    }
  }

  /**
   * Bump the tick immediately, bypassing the frame coalescing.
   *
   * For tests and for callers that must observe the effect synchronously.
   */
  notifySync(): void {
    if (this._reading) return
    if (this.tick && typeof this.tick === 'object' && 'value' in this.tick) {
      this.tick.value++
    }
  }

  addCollector(collector: Collector): this {
    const name = (collector.constructor as typeof Collector).collectorName || collector.name
    collector._bridge = this
    this.collectors.set(name, collector)
    if (this._installed && this.enabled.value && this._ctx) {
      collector.install(this._ctx)
    }
    return this
  }

  getCollector(name: string): Collector | undefined {
    return this.collectors.get(name)
  }

  getAllCollectors(): Map<string, Collector> {
    return this.collectors
  }

  install(ctx: CollectorContext): this {
    this._ctx = ctx
    this._installed = true
    if (this.enabled.value) {
      for (const collector of this.collectors.values()) {
        collector.install(ctx)
      }
    }
    setTimeout(() => this.notify(), 0)
    return this
  }

  uninstall(): void {
    for (const collector of this.collectors.values()) {
      collector.uninstall()
    }
    this.collectors.clear()
    this._installed = false
    this._ctx = null
  }

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

  clearAll(): void {
    for (const collector of this.collectors.values()) {
      collector.clear()
    }
  }

  getTotalBadge(countAll = false): number {
    let total = 0
    for (const collector of this.collectors.values()) {
      total += collector.getBadge(countAll)
    }
    return total
  }

  describe(): BridgeManifest {
    const collectors: Record<string, CollectorManifest> = {}
    // Same read-only contract as dump(): describing must not notify.
    this._reading = true
    try {
    for (const [name, collector] of this.collectors) {
      try {
        collectors[name] = collector.describe()
      } catch (e) {
        collectors[name] = {
          name,
          records: collector.records,
          summary: `[error producing manifest: ${(e as Error).message}]`,
          actions: [],
        }
      }
    }
    return {
      version: '1',
      enabled: this.enabled.value,
      tick: this.tick.value,
      collectors,
    }
    } finally {
      this._reading = false
    }
  }

  dump(): BridgeSnapshot {
    const collectors: Record<string, CollectorSnapshot> = {}
    // Re-entrance guard: a snapshot is a READ. Anything a collector emits
    // while we walk them is a side effect of observing, and must not come
    // back as a change notification (#1896).
    this._reading = true
    try {
    for (const [name, collector] of this.collectors) {
      try {
        collectors[name] = collector.snapshot()
      } catch (e) {
        collectors[name] = {
          name,
          entries: [],
          count: 0,
          unseen: 0,
          error: (e as Error).message,
        }
      }
    }
    return {
      version: '1',
      enabled: this.enabled.value,
      tick: this.tick.value,
      takenAt: Date.now(),
      collectors,
    }
    } finally {
      this._reading = false
    }
  }

  async call(
    collectorName: string,
    actionName: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const collector = this.collectors.get(collectorName)
    if (!collector) {
      throw new Error(
        `[DebugBridge] unknown collector "${collectorName}". Available: ${Array.from(
          this.collectors.keys()
        ).join(', ')}`
      )
    }
    return await collector.call(actionName, args)
  }
}

export function createDebugBridge(options: DebugBridgeOptions = {}): DebugBridge {
  return new DebugBridge(options)
}
