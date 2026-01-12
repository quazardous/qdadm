/**
 * ModuleLoader - Duck typing module loader with dependency resolution
 *
 * Detects and normalizes multiple module formats:
 * 1. Module instance - use directly
 * 2. Module class - instantiate with new
 * 3. Plain object with connect() - wrap in adapter
 * 4. Plain function - wrap as legacy init({ registry, zones })
 *
 * Provides topological sorting based on requires + priority.
 */

import { Module } from './Module'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context passed to module connect() method
 */
export interface ModuleContext {
  routes: (basePath: string, routes: unknown[], opts?: unknown) => void
  navItem: (item: unknown) => void
  routeFamily: (base: string, prefixes: string[]) => void
  zones: unknown
  [key: string]: unknown
}

/**
 * Module-like interface that all adapters implement
 */
export interface ModuleLike {
  name: string
  requires: string[]
  priority: number
  enabled(ctx: ModuleContext): boolean
  connect(ctx: ModuleContext): Promise<void>
  disconnect?(): Promise<void>
  loadStyles?(): Promise<void>
}

/**
 * Plain object module definition
 */
export interface ObjectModuleDefinition {
  name?: string
  requires?: string[]
  priority?: number
  enabled?: boolean | ((ctx: ModuleContext) => boolean)
  connect?: (ctx: ModuleContext) => void | Promise<void>
  disconnect?: () => void | Promise<void>
}

/**
 * Module class constructor with static properties
 */
export interface ModuleClassConstructor {
  new (): ModuleLike
  name: string
  requires?: string[]
  priority?: number
  enabled?: (ctx: ModuleContext) => boolean
  prototype: {
    connect?: (ctx: ModuleContext) => void | Promise<void>
    enabled?: (ctx: ModuleContext) => boolean
    disconnect?: () => void | Promise<void>
  }
}

/**
 * Legacy init function signature
 */
export interface LegacyInitApi {
  registry: {
    addRoutes: (basePath: string, routes: unknown[], opts?: unknown) => void
    addNavItem: (item: unknown) => void
    addRouteFamily: (base: string, prefixes: string[]) => void
  }
  zones: unknown
  ctx: ModuleContext
}

export type LegacyInitFunction = (api: LegacyInitApi) => void | Promise<void>

/**
 * Any valid module definition
 */
export type ModuleDefinition =
  | Module
  | ModuleLike
  | ModuleClassConstructor
  | ObjectModuleDefinition
  | LegacyInitFunction

// ─────────────────────────────────────────────────────────────────────────────
// Custom Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error thrown when a required module is not registered
 */
export class ModuleNotFoundError extends Error {
  moduleName: string
  requiredBy: string

  constructor(moduleName: string, requiredBy: string) {
    super(`Module '${moduleName}' not found (required by '${requiredBy}')`)
    this.name = 'ModuleNotFoundError'
    this.moduleName = moduleName
    this.requiredBy = requiredBy
  }
}

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends Error {
  cycle: string[]

  constructor(cycle: string[]) {
    const cyclePath = cycle.join(' → ')
    super(`Circular dependency detected: ${cyclePath}`)
    this.name = 'CircularDependencyError'
    this.cycle = cycle
  }
}

/**
 * Error thrown when module connect() fails
 */
export class ModuleLoadError extends Error {
  moduleName: string
  override cause: Error

  constructor(moduleName: string, cause: Error) {
    super(`Failed to load module '${moduleName}': ${cause.message}`)
    this.name = 'ModuleLoadError'
    this.moduleName = moduleName
    this.cause = cause
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Adapter for plain objects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a plain object with connect() into a Module-like interface
 */
class ObjectModuleAdapter implements ModuleLike {
  private _def: ObjectModuleDefinition
  private _ctx: ModuleContext | null = null

  constructor(def: ObjectModuleDefinition) {
    this._def = def
  }

  get name(): string {
    return this._def.name || 'anonymous'
  }

  get requires(): string[] {
    return this._def.requires || []
  }

  get priority(): number {
    return this._def.priority ?? 0
  }

  enabled(ctx: ModuleContext): boolean {
    if (typeof this._def.enabled === 'function') {
      return this._def.enabled(ctx)
    }
    return this._def.enabled !== false
  }

  async connect(ctx: ModuleContext): Promise<void> {
    this._ctx = ctx
    if (typeof this._def.connect === 'function') {
      await this._def.connect(ctx)
    }
  }

  async disconnect(): Promise<void> {
    if (typeof this._def.disconnect === 'function') {
      await this._def.disconnect()
    }
    this._ctx = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Class Adapter for non-Module classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a class with static name and connect method into a Module-like interface
 */
class ClassModuleAdapter implements ModuleLike {
  private _ClassDef: ModuleClassConstructor
  private _instance: ModuleLike
  private _ctx: ModuleContext | null = null

  constructor(ClassDef: ModuleClassConstructor) {
    this._ClassDef = ClassDef
    this._instance = new ClassDef()
  }

  get name(): string {
    return this._ClassDef.name || 'anonymous'
  }

  get requires(): string[] {
    return this._ClassDef.requires || []
  }

  get priority(): number {
    return this._ClassDef.priority ?? 0
  }

  enabled(ctx: ModuleContext): boolean {
    if (typeof this._instance.enabled === 'function') {
      return this._instance.enabled(ctx)
    }
    if (typeof this._ClassDef.enabled === 'function') {
      return this._ClassDef.enabled(ctx)
    }
    return true
  }

  async connect(ctx: ModuleContext): Promise<void> {
    this._ctx = ctx
    if (typeof this._instance.connect === 'function') {
      await this._instance.connect(ctx)
    }
  }

  async disconnect(): Promise<void> {
    if (typeof this._instance.disconnect === 'function') {
      await this._instance.disconnect()
    }
    this._ctx = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Function Adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps a legacy init function into a Module-like interface
 */
class LegacyFunctionAdapter implements ModuleLike {
  private _initFn: LegacyInitFunction
  private _name: string

  constructor(initFn: LegacyInitFunction) {
    this._initFn = initFn
    this._name = initFn.name || 'legacyModule'
  }

  get name(): string {
    return this._name
  }

  get requires(): string[] {
    return []
  }

  get priority(): number {
    return 0
  }

  enabled(): boolean {
    return true
  }

  async connect(ctx: ModuleContext): Promise<void> {
    // Legacy pattern: init({ registry, zones })
    // Adapt KernelContext to legacy interface
    const legacyApi: LegacyInitApi = {
      registry: {
        addRoutes: (basePath: string, routes: unknown[], opts?: unknown) =>
          ctx.routes(basePath, routes, opts),
        addNavItem: (item: unknown) => ctx.navItem(item),
        addRouteFamily: (base: string, prefixes: string[]) => ctx.routeFamily(base, prefixes),
      },
      zones: ctx.zones,
      ctx,
    }
    await this._initFn(legacyApi)
  }

  async disconnect(): Promise<void> {
    // Legacy functions don't support disconnect
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ModuleLoader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ModuleLoader - Loads and manages modules with dependency resolution
 */
export class ModuleLoader {
  /** Registered module definitions (before normalization) */
  private _registered: Map<string, ModuleLike> = new Map()

  /** Loaded module instances */
  private _loaded: Map<string, ModuleLike> = new Map()

  /** Load order for proper unloading */
  private _loadOrder: string[] = []

  /**
   * Register a module (any format)
   *
   * Accepts:
   * - Module instance (instanceof Module)
   * - Module class (has static name + prototype.connect or extends Module)
   * - Plain object with connect function
   * - Plain function (legacy init pattern)
   *
   * @param moduleDef - Module definition in any format
   * @returns this for chaining
   *
   * @example
   * loader.add(new UsersModule())
   * loader.add(UsersModule)
   * loader.add({ name: 'simple', connect(ctx) { ... } })
   * loader.add(function initLegacy({ registry }) { ... })
   */
  add(moduleDef: ModuleDefinition): this {
    const normalized = this._normalize(moduleDef)
    const name = normalized.name

    if (!name || name === 'anonymous') {
      throw new Error('Module must have a name (static name property, options.name, or function name)')
    }

    if (this._registered.has(name)) {
      throw new Error(`Module '${name}' is already registered`)
    }

    this._registered.set(name, normalized)
    return this
  }

  /**
   * Load all registered modules in dependency order
   *
   * @param ctx - Context to pass to connect() (typically KernelContext-like)
   * @throws ModuleNotFoundError When a required module is not registered
   * @throws CircularDependencyError When circular dependencies exist
   * @throws ModuleLoadError When a module's connect() fails
   */
  async loadAll(ctx: ModuleContext): Promise<void> {
    // Get sorted modules
    const sorted = this._topologicalSort()

    // Load in order
    for (const name of sorted) {
      const module = this._registered.get(name)

      if (!module) continue

      // Check if enabled
      if (!module.enabled(ctx)) {
        continue
      }

      // Load styles and connect module
      try {
        // Load module styles if defined (Module subclasses only)
        if (typeof module.loadStyles === 'function') {
          await module.loadStyles()
        }
        await module.connect(ctx)
        this._loaded.set(name, module)
        this._loadOrder.push(name)
      } catch (err) {
        throw new ModuleLoadError(name, err as Error)
      }
    }
  }

  /**
   * Unload all modules in reverse order
   */
  async unloadAll(): Promise<void> {
    // Unload in reverse order
    const reversed = [...this._loadOrder].reverse()

    for (const name of reversed) {
      const module = this._loaded.get(name)
      if (module && typeof module.disconnect === 'function') {
        await module.disconnect()
      }
    }

    this._loaded.clear()
    this._loadOrder = []
  }

  /**
   * Get loaded modules (for debug/introspection)
   *
   * @returns Map of module name to module instance
   */
  getModules(): Map<string, ModuleLike> {
    return new Map(this._loaded)
  }

  /**
   * Normalize any module format to Module-like interface
   */
  private _normalize(moduleDef: ModuleDefinition): ModuleLike {
    // 1. Already a Module instance
    if (moduleDef instanceof Module) {
      return moduleDef as unknown as ModuleLike
    }

    // 2. Module class (constructor that extends Module or has static name + connect method)
    if (typeof moduleDef === 'function') {
      // Check if it's a class extending Module
      const funcDef = moduleDef as ModuleClassConstructor
      if (funcDef.prototype instanceof Module) {
        return new funcDef()
      }

      // Check if it looks like a Module class:
      // - Has own static 'name' property (not just inherited function name)
      // - Prototype has connect method
      const hasOwnStaticName = Object.prototype.hasOwnProperty.call(funcDef, 'name')
      if (
        hasOwnStaticName &&
        typeof funcDef.name === 'string' &&
        funcDef.name !== '' &&
        typeof funcDef.prototype?.connect === 'function'
      ) {
        // Use adapter to properly expose static properties
        return new ClassModuleAdapter(funcDef)
      }

      // Otherwise it's a legacy init function
      return new LegacyFunctionAdapter(moduleDef as LegacyInitFunction)
    }

    // 3. Plain object with connect function
    if (
      moduleDef &&
      typeof moduleDef === 'object' &&
      'connect' in moduleDef &&
      typeof moduleDef.connect === 'function'
    ) {
      return new ObjectModuleAdapter(moduleDef as ObjectModuleDefinition)
    }

    throw new Error(
      'Invalid module format. Expected: Module instance, Module class, object with connect(), or function'
    )
  }

  /**
   * Get the requires array from a module (handles static vs instance properties)
   */
  private _getRequires(module: ModuleLike): string[] {
    // Check instance property first
    if (Array.isArray(module.requires)) {
      return module.requires
    }
    // Check constructor (static) property for Module subclasses
    const constructor = (module as { constructor?: { requires?: string[] } }).constructor
    if (constructor && Array.isArray(constructor.requires)) {
      return constructor.requires
    }
    return []
  }

  /**
   * Get the priority from a module (handles static vs instance properties)
   */
  private _getPriority(module: ModuleLike): number {
    // Check instance property first
    if (typeof module.priority === 'number') {
      return module.priority
    }
    // Check constructor (static) property for Module subclasses
    const constructor = (module as { constructor?: { priority?: number } }).constructor
    if (constructor && typeof constructor.priority === 'number') {
      return constructor.priority
    }
    return 0
  }

  /**
   * Sort modules topologically based on requires + priority
   *
   * Uses Kahn's algorithm for topological sort with priority tie-breaking.
   *
   * @returns Sorted module names
   * @throws ModuleNotFoundError When a required module is not registered
   * @throws CircularDependencyError When circular dependencies exist
   */
  private _topologicalSort(): string[] {
    const modules = this._registered
    const names = Array.from(modules.keys())

    // Build dependency graph
    // inDegree: number of dependencies for each module
    // dependents: modules that depend on this module
    const inDegree = new Map<string, number>()
    const dependents = new Map<string, string[]>()

    for (const name of names) {
      inDegree.set(name, 0)
      dependents.set(name, [])
    }

    // Process requires for each module
    for (const [name, module] of modules) {
      const requires = this._getRequires(module)

      for (const req of requires) {
        if (!modules.has(req)) {
          throw new ModuleNotFoundError(req, name)
        }
        inDegree.set(name, (inDegree.get(name) || 0) + 1)
        dependents.get(req)?.push(name)
      }
    }

    // Initialize queue with modules that have no dependencies
    // Sort by priority (lower first) for consistent ordering
    let queue = names
      .filter((name) => inDegree.get(name) === 0)
      .sort((a, b) => {
        const modA = modules.get(a)
        const modB = modules.get(b)
        return this._getPriority(modA!) - this._getPriority(modB!)
      })

    const result: string[] = []

    while (queue.length > 0) {
      // Take first (lowest priority)
      const current = queue.shift()!
      result.push(current)

      // Reduce in-degree for dependents
      for (const dep of dependents.get(current) || []) {
        const newDegree = (inDegree.get(dep) || 0) - 1
        inDegree.set(dep, newDegree)

        if (newDegree === 0) {
          queue.push(dep)
        }
      }

      // Re-sort queue by priority
      queue.sort((a, b) => {
        const modA = modules.get(a)
        const modB = modules.get(b)
        return this._getPriority(modA!) - this._getPriority(modB!)
      })
    }

    // Check for cycles
    if (result.length !== names.length) {
      // Find the cycle for error message
      const cycle = this._findCycle(modules)
      throw new CircularDependencyError(cycle)
    }

    return result
  }

  /**
   * Find a cycle in the dependency graph for error reporting
   */
  private _findCycle(modules: Map<string, ModuleLike>): string[] {
    const visited = new Set<string>()
    const stack = new Set<string>()
    const path: string[] = []

    const dfs = (name: string): string[] | null => {
      if (stack.has(name)) {
        // Found cycle - extract it from path
        const cycleStart = path.indexOf(name)
        return [...path.slice(cycleStart), name]
      }

      if (visited.has(name)) {
        return null
      }

      visited.add(name)
      stack.add(name)
      path.push(name)

      const module = modules.get(name)
      const requires = module ? this._getRequires(module) : []

      for (const req of requires) {
        if (modules.has(req)) {
          const cycle = dfs(req)
          if (cycle) {
            return cycle
          }
        }
      }

      stack.delete(name)
      path.pop()
      return null
    }

    for (const name of modules.keys()) {
      const cycle = dfs(name)
      if (cycle) {
        return cycle
      }
    }

    return ['unknown cycle']
  }
}

/**
 * Factory function to create a ModuleLoader instance
 */
export function createModuleLoader(): ModuleLoader {
  return new ModuleLoader()
}

export default ModuleLoader
