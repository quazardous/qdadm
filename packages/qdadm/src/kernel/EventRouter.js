/**
 * EventRouter - Declarative signal routing
 *
 * Routes one signal to multiple targets (signals or callbacks).
 * Configured at Kernel level to keep components simple.
 *
 * Usage:
 * ```js
 * const router = new EventRouter({
 *   signals,      // SignalBus instance
 *   orchestrator, // Orchestrator instance (optional, for callbacks)
 *   routes: {
 *     'auth:impersonate': [
 *       'cache:entity:invalidate:loans',     // string = emit signal
 *       { signal: 'notify', transform: (p) => ({ msg: p.user }) },  // object = transform
 *       (payload, ctx) => { ... }            // function = callback
 *     ]
 *   }
 * })
 * ```
 */

/**
 * Detect cycles in route graph using DFS
 *
 * @param {object} routes - Route configuration
 * @returns {string[]|null} - Cycle path if found, null otherwise
 */
function detectCycles(routes) {
  // Build adjacency list (only signal targets, not callbacks)
  const graph = new Map()

  for (const [source, targets] of Object.entries(routes)) {
    const signalTargets = []
    for (const target of targets) {
      if (typeof target === 'string') {
        signalTargets.push(target)
      } else if (target && typeof target === 'object' && target.signal) {
        signalTargets.push(target.signal)
      }
      // Functions don't create edges in the graph
    }
    graph.set(source, signalTargets)
  }

  // DFS cycle detection
  const visited = new Set()
  const recursionStack = new Set()
  const path = []

  function dfs(node) {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const neighbors = graph.get(node) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor)
        if (cycle) return cycle
      } else if (recursionStack.has(neighbor)) {
        // Found cycle - return path from neighbor to current
        const cycleStart = path.indexOf(neighbor)
        return [...path.slice(cycleStart), neighbor]
      }
    }

    path.pop()
    recursionStack.delete(node)
    return null
  }

  // Check all nodes
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node)
      if (cycle) return cycle
    }
  }

  return null
}

export class EventRouter {
  /**
   * @param {object} options
   * @param {SignalBus} options.signals - SignalBus instance
   * @param {Orchestrator} [options.orchestrator] - Orchestrator (for callback context)
   * @param {object} options.routes - Route configuration
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options = {}) {
    const { signals, orchestrator = null, routes = {}, debug = false } = options

    if (!signals) {
      throw new Error('[EventRouter] signals is required')
    }

    this._signals = signals
    this._orchestrator = orchestrator
    this._routes = routes
    this._debug = debug
    this._cleanups = []

    // Validate and setup
    this._validateRoutes()
    this._setupListeners()
  }

  /**
   * Validate routes configuration and check for cycles
   * @private
   */
  _validateRoutes() {
    // Check for cycles
    const cycle = detectCycles(this._routes)
    if (cycle) {
      throw new Error(
        `[EventRouter] Cycle detected: ${cycle.join(' -> ')}`
      )
    }

    // Validate each route
    for (const [source, targets] of Object.entries(this._routes)) {
      if (!Array.isArray(targets)) {
        throw new Error(
          `[EventRouter] Route "${source}" must be an array of targets`
        )
      }

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        const isString = typeof target === 'string'
        const isFunction = typeof target === 'function'
        const isObject = target && typeof target === 'object' && target.signal

        if (!isString && !isFunction && !isObject) {
          throw new Error(
            `[EventRouter] Invalid target at "${source}"[${i}]: must be string, function, or { signal, transform? }`
          )
        }
      }
    }
  }

  /**
   * Setup signal listeners for all routes
   * @private
   */
  _setupListeners() {
    for (const [source, targets] of Object.entries(this._routes)) {
      const cleanup = this._signals.on(source, (payload) => {
        this._handleRoute(source, payload, targets)
      })
      this._cleanups.push(cleanup)
    }

    if (this._debug) {
      console.debug(`[EventRouter] Registered ${Object.keys(this._routes).length} routes`)
    }
  }

  /**
   * Handle a routed signal
   * @private
   */
  _handleRoute(source, payload, targets) {
    if (this._debug) {
      console.debug(`[EventRouter] ${source} -> ${targets.length} targets`)
    }

    const context = {
      signals: this._signals,
      orchestrator: this._orchestrator
    }

    for (const target of targets) {
      try {
        if (typeof target === 'string') {
          // String: emit signal with same payload
          this._signals.emit(target, payload)
          if (this._debug) {
            console.debug(`[EventRouter]   -> ${target} (forward)`)
          }
        } else if (typeof target === 'function') {
          // Function: call callback
          target(payload, context)
          if (this._debug) {
            console.debug(`[EventRouter]   -> callback()`)
          }
        } else if (target && target.signal) {
          // Object: emit signal with transformed payload
          const transformedPayload = target.transform
            ? target.transform(payload)
            : payload
          this._signals.emit(target.signal, transformedPayload)
          if (this._debug) {
            console.debug(`[EventRouter]   -> ${target.signal} (transform)`)
          }
        }
      } catch (error) {
        console.error(`[EventRouter] Error handling ${source} -> ${JSON.stringify(target)}:`, error)
      }
    }
  }

  /**
   * Add a route dynamically
   *
   * @param {string} source - Source signal
   * @param {Array} targets - Target array
   */
  addRoute(source, targets) {
    if (this._routes[source]) {
      throw new Error(`[EventRouter] Route "${source}" already exists`)
    }

    // Validate new route doesn't create cycle
    const testRoutes = { ...this._routes, [source]: targets }
    const cycle = detectCycles(testRoutes)
    if (cycle) {
      throw new Error(`[EventRouter] Adding route would create cycle: ${cycle.join(' -> ')}`)
    }

    this._routes[source] = targets

    // Setup listener
    const cleanup = this._signals.on(source, (payload) => {
      this._handleRoute(source, payload, targets)
    })
    this._cleanups.push(cleanup)
  }

  /**
   * Get all registered routes
   * @returns {object}
   */
  getRoutes() {
    return { ...this._routes }
  }

  /**
   * Dispose the router, cleaning up all listeners
   */
  dispose() {
    for (const cleanup of this._cleanups) {
      if (typeof cleanup === 'function') {
        cleanup()
      }
    }
    this._cleanups = []
    this._routes = {}
  }
}

/**
 * Factory function for creating EventRouter
 *
 * @param {object} options
 * @returns {EventRouter}
 */
export function createEventRouter(options) {
  return new EventRouter(options)
}
