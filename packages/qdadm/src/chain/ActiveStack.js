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

/**
 * @typedef {Object} StackLevel
 * @property {string} entity - Entity name (e.g., 'bots', 'commands')
 * @property {string} param - Route param name (e.g., 'uuid', 'id')
 * @property {string|null} foreignKey - Foreign key field for parent relation (null for root)
 * @property {string|null} id - Entity ID from route params
 */

export class ActiveStack {
  /**
   * @param {import('../kernel/SignalBus.js').SignalBus} [signalBus] - Optional signal bus for events
   */
  constructor(signalBus = null) {
    /** @type {StackLevel[]} */
    this._levels = []

    /** @type {import('../kernel/SignalBus.js').SignalBus|null} */
    this._signalBus = signalBus
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Mutators
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Replace entire stack (called on route change)
   * Only emits if levels actually changed (prevents duplicate emissions)
   * @param {StackLevel[]} levels
   *
   * BUG: Still getting duplicate signals (4 instead of 2) on navigation.
   * Equality check should prevent this but something is triggering multiple calls
   * with different levels. Need to investigate router.afterEach timing.
   */
  set(levels) {
    // Quick equality check - same length and same entity+id pairs
    if (this._levelsEqual(levels)) {
      return
    }
    this._levels = levels
    this._emit('stack:change', { levels: this._levels })
  }

  /**
   * Check if new levels match current levels
   * @param {StackLevel[]} newLevels
   * @returns {boolean}
   * @private
   */
  _levelsEqual(newLevels) {
    if (this._levels.length !== newLevels.length) return false
    for (let i = 0; i < this._levels.length; i++) {
      const curr = this._levels[i]
      const next = newLevels[i]
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
  clear() {
    if (this._levels.length === 0) return
    this._levels = []
    this._emit('stack:change', { levels: this._levels })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Accessors
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * All stack levels
   * @returns {StackLevel[]}
   */
  getLevels() {
    return this._levels
  }

  /**
   * Get level by index
   * @param {number} index
   * @returns {StackLevel|null}
   */
  getLevel(index) {
    return this._levels[index] ?? null
  }

  /**
   * Get level by entity name
   * @param {string} entity
   * @returns {StackLevel|null}
   */
  getLevelByEntity(entity) {
    return this._levels.find(l => l.entity === entity) ?? null
  }

  /**
   * Current (deepest) level
   * @returns {StackLevel|null}
   */
  getCurrent() {
    return this._levels.at(-1) ?? null
  }

  /**
   * Parent level (one above current)
   * @returns {StackLevel|null}
   */
  getParent() {
    return this._levels.at(-2) ?? null
  }

  /**
   * Root level (first/topmost)
   * @returns {StackLevel|null}
   */
  getRoot() {
    return this._levels[0] ?? null
  }

  /**
   * Stack depth
   * @returns {number}
   */
  getDepth() {
    return this._levels.length
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Internal
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Emit event via SignalBus
   * @param {string} signal
   * @param {*} payload
   * @private
   */
  _emit(signal, payload) {
    if (this._signalBus) {
      this._signalBus.emit(signal, payload)
    }
  }
}

export default ActiveStack
