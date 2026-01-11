/**
 * StackHydrator - Async hydration layer for ActiveStack
 *
 * Pure vanilla JS using SignalBus for events.
 * Listens to stack:change and hydrates each level with entity data.
 *
 * Signals emitted:
 * - stack:hydration:change - when a level's hydration completes { levels }
 *
 * For Vue reactivity, use useStackHydrator composable.
 *
 * @example
 * const hydrator = new StackHydrator(activeStack, orchestrator, signalBus)
 * signalBus.on('stack:hydration:change', (event) => console.log('Hydrated:', event.data.levels))
 */

/**
 * @typedef {Object} HydratedLevel
 * @property {string} entity - Entity name
 * @property {string} param - Route param name
 * @property {string|null} foreignKey - Foreign key field
 * @property {string|null} id - Entity ID
 * @property {Promise<void>} promise - Resolves when hydrated
 * @property {boolean} loading - True while fetching
 * @property {boolean} hydrated - True when data is loaded
 * @property {Error|null} error - Error if fetch failed
 * @property {Record<string, any>|null} data - Entity data
 * @property {string|null} label - Resolved label
 */

export class StackHydrator {
  /**
   * @param {import('./ActiveStack.js').ActiveStack} activeStack
   * @param {import('../orchestrator/Orchestrator.js').Orchestrator} orchestrator
   * @param {import('../kernel/SignalBus.js').SignalBus} [signalBus]
   */
  constructor(activeStack, orchestrator, signalBus = null) {
    this._activeStack = activeStack
    this._orchestrator = orchestrator
    this._signalBus = signalBus

    /** @type {HydratedLevel[]} */
    this._levels = []

    // Listen to stack changes via SignalBus
    // QuarKernel passes (event, ctx) where event.data contains the payload
    if (signalBus) {
      this._unsubscribe = signalBus.on('stack:change', (event) => {
        const levels = event.data?.levels
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
  destroy() {
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
   * @param {import('./ActiveStack.js').StackLevel[]} stackLevels
   * @private
   */
  _onStackChange(stackLevels) {
    // Create new hydrated levels (each starts its own async hydration)
    this._levels = stackLevels.map((level, index) =>
      this._createHydratedLevel(level, index)
    )
    // Don't emit here - each level will emit when hydration completes
  }

  /**
   * Create a hydrated level with its own promise
   * @param {import('./ActiveStack.js').StackLevel} stackLevel
   * @param {number} index
   * @returns {HydratedLevel}
   * @private
   */
  _createHydratedLevel(stackLevel, index) {
    const level = {
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
   * @param {HydratedLevel} level
   * @returns {Promise<void>}
   * @private
   */
  async _hydrate(level) {
    // All levels in stack have IDs (that's the new contract)
    // But check anyway for safety
    if (!level.id) {
      const manager = this._orchestrator?.get(level.entity)
      level.label = manager?.labelPlural ?? level.entity
      level.hydrated = true
      this._emitChange()
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
        this._emitChange()
        return
      }

      // Fetch entity data
      level.data = await manager.get(level.id)
      level.label = manager.getEntityLabel?.(level.data) ?? level.id
      level.hydrated = true
    } catch (err) {
      level.error = err
      level.label = level.id // Fallback to ID
      level.hydrated = true // Mark as hydrated even on error
    } finally {
      level.loading = false
      this._emitChange()
    }
  }

  /**
   * Emit hydration change signal
   * @private
   */
  _emitChange() {
    this._emit('stack:hydration:change', { levels: this._levels })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Accessors
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * All hydrated levels
   * @returns {HydratedLevel[]}
   */
  getLevels() {
    return this._levels
  }

  /**
   * Get hydrated level by index
   * @param {number} index
   * @returns {HydratedLevel|null}
   */
  getLevel(index) {
    return this._levels[index] ?? null
  }

  /**
   * Get hydrated level by entity name
   * @param {string} entity
   * @returns {HydratedLevel|null}
   */
  getLevelByEntity(entity) {
    return this._levels.find(l => l.entity === entity) ?? null
  }

  /**
   * Current hydrated level
   * @returns {HydratedLevel|null}
   */
  getCurrent() {
    return this._levels.at(-1) ?? null
  }

  /**
   * Parent hydrated level
   * @returns {HydratedLevel|null}
   */
  getParent() {
    return this._levels.at(-2) ?? null
  }

  /**
   * Root hydrated level
   * @returns {HydratedLevel|null}
   */
  getRoot() {
    return this._levels[0] ?? null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Manual update (for pages that load their own data)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Manually set data for current level (skips fetch)
   * Used by pages that already loaded the entity
   * @param {Record<string, any>} data
   */
  setCurrentData(data) {
    const level = this.getCurrent()
    if (!level) return

    const manager = this._orchestrator?.get(level.entity)
    level.data = data
    level.label = manager?.getEntityLabel?.(data) ?? level.id
    level.hydrated = true
    level.loading = false
    this._emit('stack:hydrated', { level })
    this._emit('stack:hydration:change', { levels: this._levels })
  }

  /**
   * Manually set data for a level by entity name
   * @param {string} entity
   * @param {Record<string, any>} data
   */
  setEntityData(entity, data) {
    const level = this.getLevelByEntity(entity)
    if (!level) return

    const manager = this._orchestrator?.get(entity)
    level.data = data
    level.label = manager?.getEntityLabel?.(data) ?? level.id
    level.hydrated = true
    level.loading = false
    this._emit('stack:hydrated', { level })
    this._emit('stack:hydration:change', { levels: this._levels })
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

export default StackHydrator
