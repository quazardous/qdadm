/**
 * StackHydrator - Async hydration layer for ActiveStack
 *
 * Pure vanilla JS using SignalBus for events.
 * Listens to stack:change and hydrates each level with entity data.
 *
 * Signals emitted:
 * - stack:hydrated - when hydration completes (batched, emits once after all levels) { levels }
 *
 * A record of the stack that changes (`entity:data-invalidate` for its entity
 * and id, or for the whole entity) is read again (#4960), so `useChildPage`'s
 * `parentData` and the breadcrumb follow it without a navigation.
 *
 * For Vue reactivity, use useStackHydrator composable.
 *
 * @example
 * const hydrator = new StackHydrator(activeStack, orchestrator, signalBus)
 * signalBus.on('stack:hydrated', (event) => console.log('Hydrated:', event.data.levels))
 */

import type { Hydrator } from '@quazardous/qdcore'
import type { ActiveStack, EntityStackLevel, StackLevel } from './ActiveStack'
import type { Orchestrator } from '../orchestrator/Orchestrator'
import type { SignalBus } from '../kernel/SignalBus'
import type { EntityRecord } from '../types'

/**
 * Hydrated level with async state
 */
export interface HydratedLevel {
  /** Entity name */
  entity: string
  /** Route param name */
  param: string
  /** Foreign key field */
  foreignKey: string | null
  /** Entity ID */
  id: string | null
  /** Resolves when hydrated */
  promise: Promise<void> | null
  /** True while fetching */
  loading: boolean
  /** True when data is loaded */
  hydrated: boolean
  /** Error if fetch failed */
  error: Error | null
  /** Entity data */
  data: EntityRecord | null
  /** Resolved label */
  label: string | null
}

/**
 * Hydrated levels payload
 */
export interface HydratedPayload {
  levels: HydratedLevel[]
}

export class StackHydrator implements Hydrator<EntityStackLevel, HydratedLevel> {
  private _orchestrator: Orchestrator
  private _signalBus: SignalBus | null
  private _levels: HydratedLevel[] = []
  private _pendingEmit: Promise<void> | null = null
  private _unsubscribe: (() => void) | null = null
  private _unsubscribeInvalidate: (() => void) | null = null
  /** Re-reads waiting out their coalescing window, by level */
  private _timers = new Map<HydratedLevel, ReturnType<typeof setTimeout>>()
  /** Levels changed while a read of them was in flight: read once more after it */
  private _dirty = new WeakSet<HydratedLevel>()
  private _rereading = new WeakSet<HydratedLevel>()

  constructor(
    _activeStack: ActiveStack,
    orchestrator: Orchestrator,
    signalBus: SignalBus | null = null
  ) {
    this._orchestrator = orchestrator
    this._signalBus = signalBus

    // Listen to stack changes via SignalBus
    // QuarKernel passes (event, ctx) where event.data contains the payload
    if (signalBus) {
      this._unsubscribe = signalBus.on('stack:change', (event) => {
        const levels = (event.data as { levels?: StackLevel[] })?.levels
        if (levels) {
          this._onStackChange(levels)
        }
      })
      this._unsubscribeInvalidate = signalBus.on('entity:data-invalidate', (event) => {
        const { entity, id } = (event.data || {}) as { entity?: string; id?: string | number }
        if (entity) this._onInvalidate(entity, id)
      })
    }
    // Note: No initial check needed - stack is always empty at construction time
    // The Kernel's router.afterEach will trigger stack:change after navigation
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
    this._unsubscribeInvalidate?.()
    this._unsubscribeInvalidate = null
    for (const timer of this._timers.values()) clearTimeout(timer)
    this._timers.clear()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Stack change handling
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle stack change - rebuild hydrated levels
   * @private
   */
  private _onStackChange(stackLevels: StackLevel[]): void {
    // Re-reads pending for the levels being replaced are moot
    for (const timer of this._timers.values()) clearTimeout(timer)
    this._timers.clear()
    // Create new hydrated levels (each starts its own async hydration)
    this._levels = stackLevels.map((level, index) =>
      this._createHydratedLevel(level, index)
    )
    // Don't emit here - each level will emit when hydration completes
  }

  /**
   * Create a hydrated level with its own promise
   * @private
   */
  private _createHydratedLevel(stackLevel: StackLevel, _index: number): HydratedLevel {
    const level: HydratedLevel = {
      // Sync config (copied from stack)
      entity: stackLevel.entity,
      param: stackLevel.param,
      foreignKey: stackLevel.foreignKey,
      id: stackLevel.id,

      // Async state
      promise: null,
      loading: false,
      hydrated: false,
      error: null,
      data: null,
      label: null,
    }

    // Start hydration and store promise
    level.promise = this._hydrate(level)

    return level
  }

  /**
   * Hydrate a single level
   * @private
   */
  private async _hydrate(level: HydratedLevel): Promise<void> {
    // All levels in stack have IDs (that's the new contract)
    // But check anyway for safety
    if (!level.id) {
      const manager = this._orchestrator?.get(level.entity)
      level.label = manager?.labelPlural ?? level.entity
      level.hydrated = true
      this._scheduleEmit()
      return
    }

    level.loading = true
    // Don't emit on loading start - reduces signal noise

    try {
      const manager = this._orchestrator?.get(level.entity)
      if (!manager) {
        level.label = level.id
        level.hydrated = true
        level.loading = false
        this._scheduleEmit()
        return
      }

      // Fetch entity data
      level.data = await manager.get(level.id)
      level.label = manager.getEntityLabel?.(level.data) ?? level.id
      level.hydrated = true
    } catch (err) {
      level.error = err instanceof Error ? err : new Error(String(err))
      level.label = level.id // Fallback to ID
      level.hydrated = true // Mark as hydrated even on error
    } finally {
      level.loading = false
      this._scheduleEmit()
      if (this._dirty.has(level)) {
        this._dirty.delete(level)
        void this._reread(level)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Invalidation: a record of the stack changed (#4960)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Every source counts — a local write to the parent from a dialog changes
   * what the stack shows too. Coalesced over the entity's `live.coalesceMs`.
   * @private
   */
  private _onInvalidate(entity: string, id: string | number | undefined): void {
    for (const level of this._levels) {
      if (level.entity !== entity || !level.id) continue
      if (id !== undefined && id !== null && String(id) !== String(level.id)) continue
      if (this._timers.has(level)) continue
      const manager = this._orchestrator?.get(entity) as { live?: { coalesceMs?: number } } | null | undefined
      const ms = manager?.live?.coalesceMs ?? 300
      this._timers.set(level, setTimeout(() => {
        this._timers.delete(level)
        void this._reread(level)
      }, ms))
    }
  }

  /**
   * Read a level's record again. Never two reads of it at once: one that
   * arrives meanwhile runs once the current one ends. A failure keeps the data
   * shown: the page does not fall back to loading for a refresh.
   * @private
   */
  private async _reread(level: HydratedLevel): Promise<void> {
    if (!this._levels.includes(level) || !level.id) return
    if (level.loading || this._rereading.has(level)) {
      this._dirty.add(level)
      return
    }
    const manager = this._orchestrator?.get(level.entity)
    if (!manager) return
    this._rereading.add(level)
    try {
      const data = await manager.get(level.id, undefined, { listCache: false })
      // The stack moved on meanwhile: nothing to update
      if (!this._levels.includes(level)) return
      level.data = data
      level.label = manager.getEntityLabel?.(data) ?? level.id
      level.error = null
      this._scheduleEmit()
    } catch (err) {
      console.warn(`[qdadm] StackHydrator: reading ${level.entity} #${level.id} again failed —`, err instanceof Error ? err.message : err)
    } finally {
      this._rereading.delete(level)
      if (this._dirty.has(level)) {
        this._dirty.delete(level)
        void this._reread(level)
      }
    }
  }

  /**
   * Schedule batched hydration signal (groups multiple level hydrations)
   * Uses microtask to batch emissions within same tick
   * @private
   */
  private _scheduleEmit(): void {
    if (this._pendingEmit) return // Already scheduled

    this._pendingEmit = Promise.resolve().then(() => {
      this._pendingEmit = null
      this._emit('stack:hydrated', { levels: this._levels })
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Accessors
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * All hydrated levels
   */
  getLevels(): HydratedLevel[] {
    return this._levels
  }

  /**
   * Get hydrated level by index
   */
  getLevel(index: number): HydratedLevel | null {
    return this._levels[index] ?? null
  }

  /**
   * Get hydrated level by entity name
   */
  getLevelByEntity(entity: string): HydratedLevel | null {
    return this._levels.find(l => l.entity === entity) ?? null
  }

  /**
   * Current hydrated level
   */
  getCurrent(): HydratedLevel | null {
    return this._levels.at(-1) ?? null
  }

  /**
   * Parent hydrated level
   */
  getParent(): HydratedLevel | null {
    return this._levels.at(-2) ?? null
  }

  /**
   * Root hydrated level
   */
  getRoot(): HydratedLevel | null {
    return this._levels[0] ?? null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Manual update (for pages that load their own data)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Manually set data for current level (skips fetch)
   * Used by pages that already loaded the entity
   */
  setCurrentData(data: EntityRecord): void {
    const level = this.getCurrent()
    if (!level) return

    const manager = this._orchestrator?.get(level.entity)
    level.data = data
    level.label = manager?.getEntityLabel?.(data) ?? level.id
    level.hydrated = true
    level.loading = false
    this._scheduleEmit()
  }

  /**
   * Manually set data for a level by entity name
   */
  setEntityData(entity: string, data: EntityRecord): void {
    const level = this.getLevelByEntity(entity)
    if (!level) return

    const manager = this._orchestrator?.get(entity)
    level.data = data
    level.label = manager?.getEntityLabel?.(data) ?? level.id
    level.hydrated = true
    level.loading = false
    this._scheduleEmit()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Internal
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Emit event via SignalBus
   * @private
   */
  private _emit(signal: string, payload: HydratedPayload): void {
    if (this._signalBus) {
      this._signalBus.emit(signal, payload)
    }
  }
}

export default StackHydrator
