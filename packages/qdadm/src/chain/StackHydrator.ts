/**
 * StackHydrator - Async hydration layer for ActiveStack
 *
 * Pure vanilla JS using SignalBus for events.
 * Listens to stack:change and hydrates each level with entity data.
 *
 * Signals emitted:
 * - stack:hydrated - when hydration completes (batched, emits once after all levels) { levels }
 *
 * For Vue reactivity, use useStackHydrator composable.
 *
 * @example
 * const hydrator = new StackHydrator(activeStack, orchestrator, signalBus)
 * signalBus.on('stack:hydrated', (event) => console.log('Hydrated:', event.data.levels))
 */

import type { ActiveStack, StackLevel } from './ActiveStack'
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

export class StackHydrator {
  private _activeStack: ActiveStack
  private _orchestrator: Orchestrator
  private _signalBus: SignalBus | null
  private _levels: HydratedLevel[] = []
  private _pendingEmit: Promise<void> | null = null
  private _unsubscribe: (() => void) | null = null

  constructor(
    activeStack: ActiveStack,
    orchestrator: Orchestrator,
    signalBus: SignalBus | null = null
  ) {
    this._activeStack = activeStack
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
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Stack change handling
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle stack change - rebuild hydrated levels
   * @private
   */
  private _onStackChange(stackLevels: StackLevel[]): void {
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
