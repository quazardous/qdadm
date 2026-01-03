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

import { Module } from './Module.js'

// ─────────────────────────────────────────────────────────────────────────────
// Custom Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error thrown when a required module is not registered
 */
export class ModuleNotFoundError extends Error {
  /**
   * @param {string} moduleName - Name of the missing module
   * @param {string} requiredBy - Name of the module that requires it
   */
  constructor(moduleName, requiredBy) {
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
  /**
   * @param {string[]} cycle - Array of module names forming the cycle
   */
  constructor(cycle) {
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
  /**
   * @param {string} moduleName - Name of the module that failed
   * @param {Error} cause - Original error
   */
  constructor(moduleName, cause) {
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
class ObjectModuleAdapter {
  /**
   * @param {object} def - Plain object module definition
   */
  constructor(def) {
    this._def = def
    this._ctx = null
  }

  get name() {
    return this._def.name || 'anonymous'
  }

  get requires() {
    return this._def.requires || []
  }

  get priority() {
    return this._def.priority ?? 0
  }

  enabled(ctx) {
    if (typeof this._def.enabled === 'function') {
      return this._def.enabled(ctx)
    }
    return this._def.enabled !== false
  }

  async connect(ctx) {
    this._ctx = ctx
    if (typeof this._def.connect === 'function') {
      await this._def.connect(ctx)
    }
  }

  async disconnect() {
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
class ClassModuleAdapter {
  /**
   * @param {Function} ClassDef - Class definition with static name
   */
  constructor(ClassDef) {
    this._ClassDef = ClassDef
    this._instance = new ClassDef()
    this._ctx = null
  }

  get name() {
    return this._ClassDef.name || 'anonymous'
  }

  get requires() {
    return this._ClassDef.requires || []
  }

  get priority() {
    return this._ClassDef.priority ?? 0
  }

  enabled(ctx) {
    if (typeof this._instance.enabled === 'function') {
      return this._instance.enabled(ctx)
    }
    if (typeof this._ClassDef.enabled === 'function') {
      return this._ClassDef.enabled(ctx)
    }
    return true
  }

  async connect(ctx) {
    this._ctx = ctx
    if (typeof this._instance.connect === 'function') {
      await this._instance.connect(ctx)
    }
  }

  async disconnect() {
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
class LegacyFunctionAdapter {
  /**
   * @param {Function} initFn - Legacy init function
   */
  constructor(initFn) {
    this._initFn = initFn
    this._name = initFn.name || 'legacyModule'
  }

  get name() {
    return this._name
  }

  get requires() {
    return []
  }

  get priority() {
    return 0
  }

  enabled() {
    return true
  }

  async connect(ctx) {
    // Legacy pattern: init({ registry, zones })
    // Adapt KernelContext to legacy interface
    const legacyApi = {
      registry: {
        addRoutes: (basePath, routes, opts) => ctx.routes(basePath, routes, opts),
        addNavItem: (item) => ctx.navItem(item),
        addRouteFamily: (base, prefixes) => ctx.routeFamily(base, prefixes),
      },
      zones: ctx.zones,
      ctx,
    }
    await this._initFn(legacyApi)
  }

  async disconnect() {
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
  constructor() {
    /** @type {Map<string, object>} Registered module definitions (before normalization) */
    this._registered = new Map()

    /** @type {Map<string, object>} Loaded module instances */
    this._loaded = new Map()

    /** @type {string[]} Load order for proper unloading */
    this._loadOrder = []
  }

  /**
   * Register a module (any format)
   *
   * Accepts:
   * - Module instance (instanceof Module)
   * - Module class (has static name + prototype.connect or extends Module)
   * - Plain object with connect function
   * - Plain function (legacy init pattern)
   *
   * @param {Module|Function|object} moduleDef - Module definition in any format
   * @returns {this} For chaining
   *
   * @example
   * loader.add(new UsersModule())
   * loader.add(UsersModule)
   * loader.add({ name: 'simple', connect(ctx) { ... } })
   * loader.add(function initLegacy({ registry }) { ... })
   */
  add(moduleDef) {
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
   * @param {object} ctx - Context to pass to connect() (typically KernelContext-like)
   * @returns {Promise<void>}
   * @throws {ModuleNotFoundError} When a required module is not registered
   * @throws {CircularDependencyError} When circular dependencies exist
   * @throws {ModuleLoadError} When a module's connect() fails
   */
  async loadAll(ctx) {
    // Get sorted modules
    const sorted = this._topologicalSort()

    // Load in order
    for (const name of sorted) {
      const module = this._registered.get(name)

      // Check if enabled
      if (!module.enabled(ctx)) {
        continue
      }

      // Connect module
      try {
        await module.connect(ctx)
        this._loaded.set(name, module)
        this._loadOrder.push(name)
      } catch (err) {
        throw new ModuleLoadError(name, err)
      }
    }
  }

  /**
   * Unload all modules in reverse order
   *
   * @returns {Promise<void>}
   */
  async unloadAll() {
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
   * @returns {Map<string, object>} Map of module name to module instance
   */
  getModules() {
    return new Map(this._loaded)
  }

  /**
   * Normalize any module format to Module-like interface
   *
   * @param {Module|Function|object} moduleDef
   * @returns {object} Normalized module with name, requires, priority, enabled, connect, disconnect
   * @private
   */
  _normalize(moduleDef) {
    // 1. Already a Module instance
    if (moduleDef instanceof Module) {
      return moduleDef
    }

    // 2. Module class (constructor that extends Module or has static name + connect method)
    if (typeof moduleDef === 'function') {
      // Check if it's a class extending Module
      if (moduleDef.prototype instanceof Module) {
        return new moduleDef()
      }

      // Check if it looks like a Module class:
      // - Has own static 'name' property (not just inherited function name)
      // - Prototype has connect method
      const hasOwnStaticName = Object.prototype.hasOwnProperty.call(moduleDef, 'name')
      if (
        hasOwnStaticName &&
        typeof moduleDef.name === 'string' &&
        moduleDef.name !== '' &&
        typeof moduleDef.prototype?.connect === 'function'
      ) {
        // Use adapter to properly expose static properties
        return new ClassModuleAdapter(moduleDef)
      }

      // Otherwise it's a legacy init function
      return new LegacyFunctionAdapter(moduleDef)
    }

    // 3. Plain object with connect function
    if (
      moduleDef &&
      typeof moduleDef === 'object' &&
      typeof moduleDef.connect === 'function'
    ) {
      return new ObjectModuleAdapter(moduleDef)
    }

    throw new Error(
      'Invalid module format. Expected: Module instance, Module class, object with connect(), or function'
    )
  }

  /**
   * Get the requires array from a module (handles static vs instance properties)
   *
   * @param {object} module - Module instance
   * @returns {string[]}
   * @private
   */
  _getRequires(module) {
    // Check instance property first
    if (Array.isArray(module.requires)) {
      return module.requires
    }
    // Check constructor (static) property for Module subclasses
    if (module.constructor && Array.isArray(module.constructor.requires)) {
      return module.constructor.requires
    }
    return []
  }

  /**
   * Get the priority from a module (handles static vs instance properties)
   *
   * @param {object} module - Module instance
   * @returns {number}
   * @private
   */
  _getPriority(module) {
    // Check instance property first
    if (typeof module.priority === 'number') {
      return module.priority
    }
    // Check constructor (static) property for Module subclasses
    if (module.constructor && typeof module.constructor.priority === 'number') {
      return module.constructor.priority
    }
    return 0
  }

  /**
   * Sort modules topologically based on requires + priority
   *
   * Uses Kahn's algorithm for topological sort with priority tie-breaking.
   *
   * @returns {string[]} Sorted module names
   * @throws {ModuleNotFoundError} When a required module is not registered
   * @throws {CircularDependencyError} When circular dependencies exist
   * @private
   */
  _topologicalSort() {
    const modules = this._registered
    const names = Array.from(modules.keys())

    // Build dependency graph
    // inDegree: number of dependencies for each module
    // dependents: modules that depend on this module
    const inDegree = new Map()
    const dependents = new Map()

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
        inDegree.set(name, inDegree.get(name) + 1)
        dependents.get(req).push(name)
      }
    }

    // Initialize queue with modules that have no dependencies
    // Sort by priority (lower first) for consistent ordering
    let queue = names
      .filter((name) => inDegree.get(name) === 0)
      .sort((a, b) => {
        const modA = modules.get(a)
        const modB = modules.get(b)
        return this._getPriority(modA) - this._getPriority(modB)
      })

    const result = []

    while (queue.length > 0) {
      // Take first (lowest priority)
      const current = queue.shift()
      result.push(current)

      // Reduce in-degree for dependents
      for (const dep of dependents.get(current)) {
        inDegree.set(dep, inDegree.get(dep) - 1)

        if (inDegree.get(dep) === 0) {
          queue.push(dep)
        }
      }

      // Re-sort queue by priority
      queue.sort((a, b) => {
        const modA = modules.get(a)
        const modB = modules.get(b)
        return this._getPriority(modA) - this._getPriority(modB)
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
   *
   * @param {Map<string, object>} modules
   * @returns {string[]} Cycle path
   * @private
   */
  _findCycle(modules) {
    const visited = new Set()
    const stack = new Set()
    const path = []

    const dfs = (name) => {
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
 *
 * @returns {ModuleLoader}
 */
export function createModuleLoader() {
  return new ModuleLoader()
}

export default ModuleLoader
