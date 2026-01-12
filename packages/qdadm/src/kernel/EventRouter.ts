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
 *     // Auth events → datalayer invalidation with actuator (only authSensitive entities react)
 *     'auth:**': [{ signal: 'entity:datalayer-invalidate', transform: () => ({ actuator: 'auth' }) }],
 *
 *     // Custom routing with transform
 *     'order:completed': [
 *       { signal: 'notify', transform: (p) => ({ msg: `Order ${p.id} done` }) },
 *       (payload, ctx) => { ... }  // callback
 *     ]
 *   }
 * })
 * ```
 */

import type { SignalBus } from './SignalBus'
import type { Orchestrator } from '../orchestrator/Orchestrator'

/**
 * Route target with signal and optional transform
 */
export interface SignalTarget {
  signal: string
  transform?: (payload: unknown) => unknown
}

/**
 * Route callback context
 */
export interface RouteContext {
  signals: SignalBus
  orchestrator: Orchestrator | null
}

/**
 * Route callback function
 */
export type RouteCallback = (payload: unknown, context: RouteContext) => void

/**
 * Route target types
 */
export type RouteTarget = string | SignalTarget | RouteCallback

/**
 * Routes configuration
 */
export type RoutesConfig = Record<string, RouteTarget[]>

/**
 * EventRouter options
 */
export interface EventRouterOptions {
  signals: SignalBus
  orchestrator?: Orchestrator | null
  routes?: RoutesConfig
  debug?: boolean
}

/**
 * Detect cycles in route graph using DFS
 */
function detectCycles(routes: RoutesConfig): string[] | null {
  // Build adjacency list (only signal targets, not callbacks)
  const graph = new Map<string, string[]>()

  for (const [source, targets] of Object.entries(routes)) {
    const signalTargets: string[] = []
    for (const target of targets) {
      if (typeof target === 'string') {
        signalTargets.push(target)
      } else if (target && typeof target === 'object' && 'signal' in target) {
        signalTargets.push(target.signal)
      }
      // Functions don't create edges in the graph
    }
    graph.set(source, signalTargets)
  }

  // DFS cycle detection
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): string[] | null {
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
  private _signals: SignalBus
  private _orchestrator: Orchestrator | null
  private _routes: RoutesConfig
  private _debug: boolean
  private _cleanups: Array<() => void> = []

  constructor(options: EventRouterOptions) {
    const { signals, orchestrator = null, routes = {}, debug = false } = options

    if (!signals) {
      throw new Error('[EventRouter] signals is required')
    }

    this._signals = signals
    this._orchestrator = orchestrator
    this._routes = routes
    this._debug = debug

    // Validate and setup
    this._validateRoutes()
    this._setupListeners()
  }

  /**
   * Validate routes configuration and check for cycles
   */
  private _validateRoutes(): void {
    // Check for cycles
    const cycle = detectCycles(this._routes)
    if (cycle) {
      throw new Error(`[EventRouter] Cycle detected: ${cycle.join(' -> ')}`)
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
        const isObject =
          target && typeof target === 'object' && 'signal' in target

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
   */
  private _setupListeners(): void {
    for (const [source, targets] of Object.entries(this._routes)) {
      const cleanup = this._signals.on(source, (event: { data: unknown }) => {
        this._handleRoute(source, event.data, targets)
      })
      this._cleanups.push(cleanup)
    }

    if (this._debug) {
      console.debug(
        `[EventRouter] Registered ${Object.keys(this._routes).length} routes`
      )
    }
  }

  /**
   * Handle a routed signal
   */
  private _handleRoute(
    source: string,
    payload: unknown,
    targets: RouteTarget[]
  ): void {
    if (this._debug) {
      console.debug(`[EventRouter] ${source} -> ${targets.length} targets`)
    }

    const context: RouteContext = {
      signals: this._signals,
      orchestrator: this._orchestrator,
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
        } else if (target && 'signal' in target) {
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
        console.error(
          `[EventRouter] Error handling ${source} -> ${JSON.stringify(target)}:`,
          error
        )
      }
    }
  }

  /**
   * Add a route dynamically
   */
  addRoute(source: string, targets: RouteTarget[]): void {
    if (this._routes[source]) {
      throw new Error(`[EventRouter] Route "${source}" already exists`)
    }

    // Validate new route doesn't create cycle
    const testRoutes = { ...this._routes, [source]: targets }
    const cycle = detectCycles(testRoutes)
    if (cycle) {
      throw new Error(
        `[EventRouter] Adding route would create cycle: ${cycle.join(' -> ')}`
      )
    }

    this._routes[source] = targets

    // Setup listener
    const cleanup = this._signals.on(source, (event: { data: unknown }) => {
      this._handleRoute(source, event.data, targets)
    })
    this._cleanups.push(cleanup)
  }

  /**
   * Get all registered routes
   */
  getRoutes(): RoutesConfig {
    return { ...this._routes }
  }

  /**
   * Dispose the router, cleaning up all listeners
   */
  dispose(): void {
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
 */
export function createEventRouter(options: EventRouterOptions): EventRouter {
  return new EventRouter(options)
}
