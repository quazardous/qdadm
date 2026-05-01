/**
 * Collector - Base class for debug collectors.
 *
 * Collectors gather data from various sources (signals, network, events) and
 * store them in a ring buffer for display in the debug panel. Subclasses
 * implement specific collection strategies by overriding `_doInstall()` and
 * `_doUninstall()`.
 *
 * Framework-agnostic: no Vue, no router, no admin/CMS specifics. Consumers
 * pass any extras through `CollectorContext`'s open index signature.
 *
 * @example
 * class MySignalCollector extends Collector {
 *   static override collectorName = 'my-signals'
 *
 *   protected override _doInstall(ctx: CollectorContext) {
 *     const signals = ctx.signals as SignalBus | undefined
 *     this._unbind = signals?.on('*', (event) => {
 *       this.record({ type: event.name, data: event.data })
 *     })
 *   }
 *
 *   protected override _doUninstall() {
 *     this._unbind?.()
 *   }
 * }
 */

import type { SignalBus } from '@quazardous/qdcore'

/**
 * Context provided to collectors during install.
 *
 * `signals` is well-known (typed as `SignalBus`); everything else is
 * consumer-defined (qdadm passes `orchestrator`, `router`, `kernel`; qdcms
 * might pass `cms`, `composer`, etc.). Read extras via
 * `ctx.someKey as TypeYouExpect`.
 */
export interface CollectorContext {
  signals?: SignalBus | null
  [key: string]: unknown
}

export interface CollectorEntry {
  timestamp: number
  _isNew?: boolean
  [key: string]: unknown
}

export interface CollectorOptions {
  maxEntries?: number
  enabled?: boolean
  [key: string]: unknown
}

export type NotifyCallback = () => void

export interface DebugBridgeInterface {
  notify: () => void
}

/**
 * Action handler signature.
 * Args is a single JSON-friendly object (so it survives HTTP/MCP transport).
 */
export type CollectorAction = (args?: Record<string, unknown>) => unknown | Promise<unknown>

/**
 * Manifest describing one named action exposed by a collector.
 */
export interface CollectorActionManifest {
  name: string
  summary: string
  args?: Record<string, unknown>
  mutates?: boolean
}

/**
 * Manifest describing a collector — what it stores, what it can do.
 */
export interface CollectorManifest {
  name: string
  records: boolean
  summary: string
  entryShape?: Record<string, string>
  stateShape?: Record<string, string>
  actions: CollectorActionManifest[]
}

/**
 * JSON-serializable snapshot — for agent/MCP consumption.
 */
export interface CollectorSnapshot {
  name: string
  entries: unknown[]
  count: number
  unseen: number
  state?: Record<string, unknown>
  [key: string]: unknown
}

export class Collector<TEntry extends CollectorEntry = CollectorEntry> {
  /** Override in subclass. Using `collectorName` to avoid conflict with Function.name. */
  static collectorName = 'base'
  /** Override to false for collectors that only show current state (no ring buffer growth). */
  static records = true

  options: CollectorOptions
  maxEntries: number
  entries: TEntry[]
  protected _enabled: boolean
  protected _installed: boolean
  protected _ctx: CollectorContext | null
  protected _seenCount: number
  _bridge: DebugBridgeInterface | null
  protected _notifyCallbacks: NotifyCallback[]

  constructor(options: CollectorOptions = {}) {
    this.options = options
    this.maxEntries = options.maxEntries ?? 100
    this.entries = []
    this._enabled = options.enabled ?? true
    this._installed = false
    this._ctx = null
    this._seenCount = 0
    this._bridge = null
    this._notifyCallbacks = []
  }

  get records(): boolean {
    return (this.constructor as typeof Collector).records
  }

  get enabled(): boolean {
    return this._enabled
  }

  set enabled(value: boolean) {
    if (this._enabled === value) return
    this._enabled = value
    if (this._ctx) {
      if (value) this.install(this._ctx)
      else this.uninstall()
    }
  }

  toggle(): boolean {
    this.enabled = !this._enabled
    return this._enabled
  }

  get name(): string {
    return (this.constructor as typeof Collector).collectorName
  }

  record(entry: Omit<TEntry, 'timestamp' | '_isNew'>): void {
    const fullEntry = { ...entry, timestamp: Date.now(), _isNew: true } as TEntry
    this.entries.push(fullEntry)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
      if (this._seenCount > 0) this._seenCount--
    }
    this.notifyChange()
  }

  notifyChange(): void {
    this._bridge?.notify()
    for (const cb of this._notifyCallbacks) {
      try {
        cb()
      } catch (e) {
        console.warn('[Collector] Notify callback error:', e)
      }
    }
  }

  onNotify(callback: NotifyCallback): () => void {
    this._notifyCallbacks.push(callback)
    return () => {
      const idx = this._notifyCallbacks.indexOf(callback)
      if (idx >= 0) this._notifyCallbacks.splice(idx, 1)
    }
  }

  getUnseenCount(): number {
    return Math.max(0, this.entries.length - this._seenCount)
  }

  getTotalCount(): number {
    return this.entries.length
  }

  getBadge(countAll = false): number {
    return countAll ? this.getTotalCount() : this.getUnseenCount()
  }

  markAsSeen(): void {
    this._seenCount = this.entries.length
    for (const entry of this.entries) {
      delete entry._isNew
    }
  }

  clear(): void {
    this.entries = []
    this._seenCount = 0
  }

  getEntries(): TEntry[] {
    return [...this.entries]
  }

  getLatest(count: number): TEntry[] {
    return this.entries.slice(-count)
  }

  install(ctx: CollectorContext): void {
    this._ctx = ctx
    this._installed = true
    if (this._enabled) this._doInstall(ctx)
  }

  uninstall(): void {
    this._doUninstall()
    this._installed = false
  }

  protected _doInstall(_ctx: CollectorContext): void {
    // Override in subclass
  }

  protected _doUninstall(): void {
    // Override in subclass
  }

  describe(): CollectorManifest {
    return {
      name: this.name,
      records: this.records,
      summary: this.records
        ? `Records ${this.name} events (max ${this.maxEntries}).`
        : `Exposes current ${this.name} state.`,
      actions: [
        ...this._builtinActionManifests(),
        ...Array.from(this._actions.values()).map((a) => a.manifest),
      ],
    }
  }

  snapshot(): CollectorSnapshot {
    return {
      name: this.name,
      entries: this.entries.map((e) => ({ ...e })),
      count: this.entries.length,
      unseen: this.getUnseenCount(),
    }
  }

  protected _actions: Map<string, { manifest: CollectorActionManifest; handler: CollectorAction }> =
    new Map()

  registerAction(manifest: CollectorActionManifest, handler: CollectorAction): void {
    this._actions.set(manifest.name, { manifest, handler })
  }

  async call(actionName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (actionName === 'clear') {
      this.clear()
      this.notifyChange()
      return { ok: true }
    }
    if (actionName === 'markSeen') {
      this.markAsSeen()
      this.notifyChange()
      return { ok: true }
    }
    if (actionName === 'getEntries') {
      const limit = typeof args.limit === 'number' ? args.limit : undefined
      return limit ? this.getLatest(limit) : this.getEntries()
    }
    const reg = this._actions.get(actionName)
    if (!reg) {
      throw new Error(
        `[${this.name}] unknown action "${actionName}". Available: ${[
          'clear',
          'markSeen',
          'getEntries',
          ...this._actions.keys(),
        ].join(', ')}`
      )
    }
    return await reg.handler(args)
  }

  protected _builtinActionManifests(): CollectorActionManifest[] {
    return [
      { name: 'clear', summary: 'Clear all recorded entries.', mutates: true },
      { name: 'markSeen', summary: 'Mark all current entries as seen.', mutates: true },
      {
        name: 'getEntries',
        summary: 'Return entries (optionally limited to the latest N).',
        args: { limit: 'number?' },
      },
    ]
  }
}
