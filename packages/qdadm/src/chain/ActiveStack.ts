/**
 * ActiveStack - Sync navigation context from route
 *
 * Pure vanilla JS container using SignalBus for events.
 * Rebuilt from route.meta on navigation.
 *
 * Stack only contains levels WITH IDs (entities with context).
 * - /bots/bot-xyz/commands → stack = [bots(id:bot-xyz)]
 * - /bots/bot-xyz/commands/cmd-123 → stack = [bots(id:bot-xyz), commands(id:cmd-123)]
 *
 * Signals emitted:
 * - stack:change - when stack levels change
 *
 * For Vue reactivity, use useActiveStack composable.
 *
 * @example
 * const stack = new ActiveStack(signalBus)
 * signalBus.on('stack:change', ({ levels }) => console.log('Stack:', levels))
 * stack.set([{ entity: 'bots', param: 'uuid', id: 'bot-123' }])
 */

import type { SignalBus } from '../kernel/SignalBus'

/**
 * Stack level definition
 */
export interface StackLevel {
  /** Entity name (e.g., 'bots', 'commands') */
  entity: string
  /** Route param name (e.g., 'uuid', 'id') */
  param: string
  /** Foreign key field for parent relation (null for root) */
  foreignKey: string | null
  /** Entity ID from route params */
  id: string | null
}

/**
 * Stack change event payload
 */
export interface StackChangePayload {
  levels: StackLevel[]
}

export class ActiveStack {
  private _levels: StackLevel[] = []
  private _signalBus: SignalBus | null

  /**
   * @param signalBus - Optional signal bus for events
   */
  constructor(signalBus: SignalBus | null = null) {
    this._signalBus = signalBus
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Mutators
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Replace entire stack (called on route change)
   * Only emits if levels actually changed (prevents duplicate emissions)
   *
   * BUG: Still getting duplicate signals (4 instead of 2) on navigation.
   * Equality check should prevent this but something is triggering multiple calls
   * with different levels. Need to investigate router.afterEach timing.
   */
  set(levels: StackLevel[]): void {
    // Quick equality check - same length and same entity+id pairs
    if (this._levelsEqual(levels)) {
      return
    }
    this._levels = levels
    this._emit('stack:change', { levels: this._levels })
  }

  /**
   * Check if new levels match current levels
   * @private
   */
  private _levelsEqual(newLevels: StackLevel[]): boolean {
    if (this._levels.length !== newLevels.length) return false
    for (let i = 0; i < this._levels.length; i++) {
      const curr = this._levels[i]
      const next = newLevels[i]
      // Both are guaranteed to exist because we checked lengths match
      if (!curr || !next) continue
      if (curr.entity !== next.entity || curr.id !== next.id) {
        return false
      }
    }
    return true
  }

  /**
   * Clear the stack
   * Only emits if not already empty
   */
  clear(): void {
    if (this._levels.length === 0) return
    this._levels = []
    this._emit('stack:change', { levels: this._levels })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Accessors
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * All stack levels
   */
  getLevels(): StackLevel[] {
    return this._levels
  }

  /**
   * Get level by index
   */
  getLevel(index: number): StackLevel | null {
    return this._levels[index] ?? null
  }

  /**
   * Get level by entity name
   */
  getLevelByEntity(entity: string): StackLevel | null {
    return this._levels.find(l => l.entity === entity) ?? null
  }

  /**
   * Current (deepest) level
   */
  getCurrent(): StackLevel | null {
    return this._levels.at(-1) ?? null
  }

  /**
   * Parent level (one above current)
   */
  getParent(): StackLevel | null {
    return this._levels.at(-2) ?? null
  }

  /**
   * Root level (first/topmost)
   */
  getRoot(): StackLevel | null {
    return this._levels[0] ?? null
  }

  /**
   * Stack depth
   */
  getDepth(): number {
    return this._levels.length
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Internal
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Emit event via SignalBus
   * @private
   */
  private _emit(signal: string, payload: StackChangePayload): void {
    if (this._signalBus) {
      this._signalBus.emit(signal, payload)
    }
  }
}

export default ActiveStack
