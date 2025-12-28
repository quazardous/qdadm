/**
 * HookRegistry - Drupal-inspired hook system for qdadm
 *
 * Provides a hook-based extension API built on QuarKernel's signal bus.
 * Two hook types:
 * - Lifecycle hooks: fire-and-forget, no return value expected (via invoke())
 * - Alter hooks: chained transforms, each handler receives previous output (via alter())
 *
 * Hook naming convention: colon-delimited (e.g., 'entity:presave', 'list:alter')
 *
 * Handler signature: (event, listenerContext) => void | Promise<void>
 * - event.data contains the context/data passed to invoke()/alter()
 * - event.name is the hook name
 * - listenerContext provides utilities (id, cancel, emit, etc.)
 *
 * @example
 * // Register lifecycle hook (fire-and-forget)
 * // Handlers receive QuarKernel event - context is in event.data
 * hooks.register('entity:presave', async (event) => {
 *   event.data.entity.updated_at = Date.now()
 * }, { priority: 10 })
 *
 * // Register alter hook (transform chain)
 * hooks.register('list:alter', (config) => {
 *   config.columns.push({ field: 'custom' })
 *   return config
 * })
 *
 * // Invoke lifecycle hook
 * await hooks.invoke('entity:presave', { entity, manager })
 *
 * // Invoke alter hook
 * const alteredConfig = await hooks.alter('list:alter', baseConfig)
 */

import { createKernel } from '@quazardous/quarkernel'

/**
 * Default priority for hooks (middle of range)
 */
const DEFAULT_PRIORITY = 50

/**
 * Priority constants for common use cases
 */
export const HOOK_PRIORITY = {
  FIRST: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  LAST: 0,
}

/**
 * HookRegistry class - wraps QuarKernel for Drupal-inspired hook API
 */
export class HookRegistry {
  /**
   * Create a HookRegistry instance
   *
   * @param {object} options - Configuration options
   * @param {object} [options.kernel] - Existing QuarKernel instance to wrap
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options = {}) {
    this._kernel = options.kernel ?? createKernel({
      delimiter: ':',
      wildcard: true,
      errorBoundary: true,
      debug: options.debug ?? false,
    })

    // Track registered hooks for introspection
    this._hooks = new Map()
  }

  /**
   * Register a hook handler
   *
   * @param {string} name - Hook name (colon-delimited, e.g., 'entity:presave')
   * @param {Function} handler - Handler function
   * @param {object} [options] - Registration options
   * @param {number} [options.priority=50] - Priority (higher runs first)
   * @param {string} [options.id] - Unique handler ID for debugging
   * @param {string|string[]} [options.after] - Run after these handler IDs
   * @param {boolean} [options.once=false] - Remove after first invocation
   * @returns {Function} Unbind function to remove this handler
   */
  register(name, handler, options = {}) {
    const {
      priority = DEFAULT_PRIORITY,
      id,
      after,
      once = false,
    } = options

    // Build QuarKernel options
    const kernelOptions = {
      priority,
      once,
    }

    if (id) {
      kernelOptions.id = id
    }

    if (after) {
      kernelOptions.after = after
    }

    // Register with QuarKernel
    const unbind = this._kernel.on(name, handler, kernelOptions)

    // Track for introspection
    if (!this._hooks.has(name)) {
      this._hooks.set(name, [])
    }

    const hookEntry = {
      handler,
      priority,
      id,
      after,
      once,
      unbind,
    }

    this._hooks.get(name).push(hookEntry)

    // Return enhanced unbind that also cleans up tracking
    return () => {
      unbind()
      const hooks = this._hooks.get(name)
      if (hooks) {
        const idx = hooks.indexOf(hookEntry)
        if (idx !== -1) {
          hooks.splice(idx, 1)
        }
        if (hooks.length === 0) {
          this._hooks.delete(name)
        }
      }
    }
  }

  /**
   * Invoke a lifecycle hook (fire-and-forget)
   *
   * All registered handlers are called with the context in priority/dependency order.
   * Handlers are executed sequentially (serial) to ensure predictable mutation order.
   * Handlers may be async; all are awaited before returning.
   * No return value is expected from handlers.
   *
   * @param {string} name - Hook name
   * @param {*} context - Context object passed to all handlers (can be mutated)
   * @param {object} [options] - Invocation options
   * @param {boolean} [options.throwOnError=false] - Rethrow collected errors after all handlers run
   * @returns {Promise<void>}
   * @throws {AggregateError} If throwOnError is true and any handlers threw errors
   */
  async invoke(name, context = {}, options = {}) {
    const { throwOnError = false } = options

    // Clear any previous execution errors
    this._kernel.clearExecutionErrors()

    // Use emitSerial for guaranteed sequential execution (predictable mutation order)
    // QuarKernel's errorBoundary: true continues on errors, collecting them
    await this._kernel.emitSerial(name, context)

    // If requested, rethrow collected errors after all handlers have run
    if (throwOnError) {
      const errors = this._kernel.getExecutionErrors()
      if (errors.length > 0) {
        const errorMessages = errors.map(e => `[${e.listenerId}] ${e.error.message}`)
        throw new AggregateError(
          errors.map(e => e.error),
          `Hook "${name}" handlers failed:\n  ${errorMessages.join('\n  ')}`
        )
      }
    }
  }

  /**
   * Invoke an alter hook (chained transforms)
   *
   * Each handler receives the current data and returns the transformed data.
   * Handlers are chained: each receives the output of the previous handler (reduce pattern).
   * Respects priority ordering (higher priority runs first) and `after` dependencies.
   *
   * @param {string} name - Hook name
   * @param {*} data - Initial data to transform
   * @param {object} [options] - Alter options
   * @param {boolean} [options.immutable=false] - Clone data between handlers for immutability
   * @returns {Promise<*>} Transformed data after all handlers
   *
   * @example
   * // Register handlers
   * hooks.register('list:alter', (config) => {
   *   config.columns.push({ field: 'custom' })
   *   return config  // MUST return
   * }, { priority: HOOK_PRIORITY.NORMAL })
   *
   * // Invoke alter hook
   * const config = await hooks.alter('list:alter', baseConfig)
   *
   * // With immutability (each handler gets a fresh clone)
   * const config = await hooks.alter('list:alter', baseConfig, { immutable: true })
   */
  async alter(name, data, options = {}) {
    const { immutable = false } = options

    // No handlers? Return data unchanged
    if (!this.hasHook(name)) {
      return data
    }

    // Get our tracked handlers (they have priority and dependency info)
    const handlers = this._hooks.get(name) || []

    // Sort by dependencies and priority using the same algorithm as QuarKernel
    const sortedHandlers = this._sortByDependencies(handlers)

    // Chain through handlers: each receives previous output (reduce pattern)
    let result = data
    for (const entry of sortedHandlers) {
      // Clone data if immutability is enabled
      const input = immutable ? this._cloneData(result) : result
      const handlerResult = await entry.handler(input)

      // If handler returns something, use it; otherwise keep current
      if (handlerResult !== undefined) {
        result = handlerResult
      }
    }

    return result
  }

  /**
   * Clone data for immutability support
   *
   * @private
   * @param {*} val - Value to clone
   * @returns {*} Cloned value
   */
  _cloneData(val) {
    if (val === null || val === undefined) {
      return val
    }
    if (typeof val !== 'object') {
      return val
    }
    // Use structuredClone for deep copy (available in Node 17+)
    return structuredClone(val)
  }

  /**
   * Sort handlers by dependencies and priority
   * Uses topological sort for dependency resolution (after option)
   *
   * @private
   * @param {Array} handlers - Array of handler entries
   * @returns {Array} Sorted handlers
   */
  _sortByDependencies(handlers) {
    // If no dependencies, just return sorted by priority
    const hasDependencies = handlers.some(h => h.after && (
      typeof h.after === 'string' ||
      (Array.isArray(h.after) && h.after.length > 0)
    ))

    if (!hasDependencies) {
      return [...handlers].sort((a, b) => b.priority - a.priority)
    }

    // Normalize after to arrays
    const entriesWithDeps = handlers.map(h => ({
      ...h,
      afterArray: h.after
        ? (Array.isArray(h.after) ? h.after : [h.after])
        : [],
    }))

    // Build ID set for validation
    const handlerIds = new Set(entriesWithDeps.filter(e => e.id).map(e => e.id))

    // Filter dependencies to only those that exist in this hook
    for (const entry of entriesWithDeps) {
      entry.afterArray = entry.afterArray.filter(dep => handlerIds.has(dep))
    }

    // Assign dependency levels
    const levelMap = new Map()
    const assignLevel = (entry, visited = new Set()) => {
      if (levelMap.has(entry)) {
        return levelMap.get(entry)
      }
      if (visited.has(entry)) {
        // Circular dependency - treat as level 0
        return 0
      }
      visited.add(entry)

      if (entry.afterArray.length === 0) {
        levelMap.set(entry, 0)
        return 0
      }

      // Find max level of dependencies
      let maxDepLevel = 0
      for (const depId of entry.afterArray) {
        const depEntry = entriesWithDeps.find(e => e.id === depId)
        if (depEntry) {
          const depLevel = assignLevel(depEntry, new Set(visited))
          maxDepLevel = Math.max(maxDepLevel, depLevel)
        }
      }

      const level = maxDepLevel + 1
      levelMap.set(entry, level)
      return level
    }

    // Assign levels to all entries
    entriesWithDeps.forEach(e => assignLevel(e))

    // Sort by level, then by priority within level
    return [...entriesWithDeps].sort((a, b) => {
      const levelA = levelMap.get(a) ?? 0
      const levelB = levelMap.get(b) ?? 0
      if (levelA !== levelB) {
        return levelA - levelB // Lower level first (dependencies run first)
      }
      return b.priority - a.priority // Higher priority first within same level
    })
  }

  /**
   * Get all registered hook names
   *
   * @returns {string[]} Array of hook names
   */
  getRegisteredHooks() {
    return Array.from(this._hooks.keys())
  }

  /**
   * Get handler count for a hook
   *
   * @param {string} [name] - Hook name (optional, total if omitted)
   * @returns {number} Handler count
   */
  getHandlerCount(name) {
    if (name) {
      return this._hooks.get(name)?.length ?? 0
    }

    let total = 0
    for (const handlers of this._hooks.values()) {
      total += handlers.length
    }
    return total
  }

  /**
   * Check if a hook has any registered handlers
   *
   * @param {string} name - Hook name
   * @returns {boolean}
   */
  hasHook(name) {
    return this._hooks.has(name) && this._hooks.get(name).length > 0
  }

  /**
   * Clean up all registered hooks
   *
   * Removes all handlers and clears internal state.
   */
  dispose() {
    // Unbind all handlers
    for (const handlers of this._hooks.values()) {
      for (const entry of handlers) {
        entry.unbind()
      }
    }

    // Clear tracking
    this._hooks.clear()
  }

  /**
   * Enable/disable debug mode
   *
   * @param {boolean} enabled - Enable debug logging
   */
  debug(enabled) {
    this._kernel.debug(enabled)
  }
}

/**
 * Factory function to create a HookRegistry instance
 *
 * @param {object} [options] - HookRegistry options
 * @returns {HookRegistry}
 */
export function createHookRegistry(options = {}) {
  return new HookRegistry(options)
}
