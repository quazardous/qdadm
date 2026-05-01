/**
 * EventRouter - Declarative signal routing.
 *
 * Routes one signal to multiple targets (signals or callbacks).
 * Framework-agnostic: only needs a SignalBus.
 *
 * @example
 * ```ts
 * const router = new EventRouter({
 *   signals,
 *   routes: {
 *     // Auth events → datalayer invalidation with actuator
 *     'auth:**': [{ signal: 'entity:datalayer-invalidate', transform: () => ({ actuator: 'auth' }) }],
 *
 *     // Custom routing with transform + callback
 *     'order:completed': [
 *       { signal: 'notify', transform: (p) => ({ msg: `Order ${p.id} done` }) },
 *       (payload, ctx) => { ... }
 *     ]
 *   }
 * })
 * ```
 */

import type { SignalBus } from '../signal/SignalBus'

export interface SignalTarget {
  signal: string
  transform?: (payload: unknown) => unknown
}

/**
 * Context passed to route callbacks.
 *
 * Index signature allows consumers to pass arbitrary extras through
 * `EventRouterOptions.context` (e.g. an orchestrator, an HTTP client…)
 * and read them inside callbacks via `ctx.someKey`.
 */
export interface RouteContext {
  signals: SignalBus
  [extra: string]: unknown
}

export type RouteCallback = (payload: unknown, context: RouteContext) => void

export type RouteTarget = string | SignalTarget | RouteCallback

export type RoutesConfig = Record<string, RouteTarget[]>

export interface EventRouterOptions {
  signals: SignalBus
  routes?: RoutesConfig
  /** Additional fields merged into RouteContext for callbacks. */
  context?: Record<string, unknown>
  debug?: boolean
}

function detectCycles(routes: RoutesConfig): string[] | null {
  const graph = new Map<string, string[]>()

  for (const [source, targets] of Object.entries(routes)) {
    const signalTargets: string[] = []
    for (const target of targets) {
      if (typeof target === 'string') {
        signalTargets.push(target)
      } else if (target && typeof target === 'object' && 'signal' in target) {
        signalTargets.push(target.signal)
      }
    }
    graph.set(source, signalTargets)
  }

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
        const cycleStart = path.indexOf(neighbor)
        return [...path.slice(cycleStart), neighbor]
      }
    }

    path.pop()
    recursionStack.delete(node)
    return null
  }

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
  private _routes: RoutesConfig
  private _extraContext: Record<string, unknown>
  private _debug: boolean
  private _cleanups: Array<() => void> = []

  constructor(options: EventRouterOptions) {
    const { signals, routes = {}, context = {}, debug = false } = options

    if (!signals) {
      throw new Error('[EventRouter] signals is required')
    }

    this._signals = signals
    this._routes = routes
    this._extraContext = context
    this._debug = debug

    this._validateRoutes()
    this._setupListeners()
  }

  private _validateRoutes(): void {
    const cycle = detectCycles(this._routes)
    if (cycle) {
      throw new Error(`[EventRouter] Cycle detected: ${cycle.join(' -> ')}`)
    }

    for (const [source, targets] of Object.entries(this._routes)) {
      if (!Array.isArray(targets)) {
        throw new Error(`[EventRouter] Route "${source}" must be an array of targets`)
      }

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        const isString = typeof target === 'string'
        const isFunction = typeof target === 'function'
        const isObject = target && typeof target === 'object' && 'signal' in target

        if (!isString && !isFunction && !isObject) {
          throw new Error(
            `[EventRouter] Invalid target at "${source}"[${i}]: must be string, function, or { signal, transform? }`
          )
        }
      }
    }
  }

  private _setupListeners(): void {
    for (const [source, targets] of Object.entries(this._routes)) {
      const cleanup = this._signals.on(source, (event: { data: unknown }) => {
        this._handleRoute(source, event.data, targets)
      })
      this._cleanups.push(cleanup)
    }

    if (this._debug) {
      console.debug(`[EventRouter] Registered ${Object.keys(this._routes).length} routes`)
    }
  }

  private _handleRoute(source: string, payload: unknown, targets: RouteTarget[]): void {
    if (this._debug) {
      console.debug(`[EventRouter] ${source} -> ${targets.length} targets`)
    }

    const context: RouteContext = {
      signals: this._signals,
      ...this._extraContext,
    }

    for (const target of targets) {
      try {
        if (typeof target === 'string') {
          this._signals.emit(target, payload)
          if (this._debug) console.debug(`[EventRouter]   -> ${target} (forward)`)
        } else if (typeof target === 'function') {
          target(payload, context)
          if (this._debug) console.debug(`[EventRouter]   -> callback()`)
        } else if (target && 'signal' in target) {
          const transformedPayload = target.transform ? target.transform(payload) : payload
          this._signals.emit(target.signal, transformedPayload)
          if (this._debug) console.debug(`[EventRouter]   -> ${target.signal} (transform)`)
        }
      } catch (error) {
        console.error(`[EventRouter] Error handling ${source} -> ${JSON.stringify(target)}:`, error)
      }
    }
  }

  addRoute(source: string, targets: RouteTarget[]): void {
    if (this._routes[source]) {
      throw new Error(`[EventRouter] Route "${source}" already exists`)
    }

    const testRoutes = { ...this._routes, [source]: targets }
    const cycle = detectCycles(testRoutes)
    if (cycle) {
      throw new Error(`[EventRouter] Adding route would create cycle: ${cycle.join(' -> ')}`)
    }

    this._routes[source] = targets

    const cleanup = this._signals.on(source, (event: { data: unknown }) => {
      this._handleRoute(source, event.data, targets)
    })
    this._cleanups.push(cleanup)
  }

  getRoutes(): RoutesConfig {
    return { ...this._routes }
  }

  dispose(): void {
    for (const cleanup of this._cleanups) {
      if (typeof cleanup === 'function') cleanup()
    }
    this._cleanups = []
    this._routes = {}
  }
}

export function createEventRouter(options: EventRouterOptions): EventRouter {
  return new EventRouter(options)
}
