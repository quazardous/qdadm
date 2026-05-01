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
  private _installed: boolean = false
  private _ctx: CollectorContext | null = null

  constructor(options: DebugBridgeOptions = {}) {
    this.options = options
    this.enabled = ref(options.enabled ?? false)
    this.collectors = shallowReactive(new Map())
    this.tick = ref(0)
  }

  notify(): void {
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
  }

  dump(): BridgeSnapshot {
    const collectors: Record<string, CollectorSnapshot> = {}
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
