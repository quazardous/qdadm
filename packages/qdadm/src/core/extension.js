/**
 * extendModule - Module extension helper for qdadm
 *
 * Provides a clean API for one module to extend another module's
 * configuration and behavior through the hook system.
 *
 * Extension types:
 * - columns: adds columns via `{target}:list:alter` hook
 * - fields: adds fields via `{target}:form:alter` hook
 * - filters: adds filters via `{target}:filter:alter` hook
 * - blocks: injects blocks via zone registry
 *
 * @example
 * // Simple config object approach
 * const cleanup = extendModule('books', {
 *   columns: [
 *     { field: 'rating', header: 'Rating', width: 100 }
 *   ],
 *   fields: [
 *     { name: 'rating', type: 'number', label: 'Rating' }
 *   ],
 *   blocks: {
 *     'books:detail:sidebar': [
 *       { component: RatingWidget, weight: 20 }
 *     ]
 *   }
 * }, { hooks, zones })
 *
 * // Later: cleanup()  // Removes all registered extensions
 *
 * @example
 * // Fluent API approach
 * const cleanup = extendModule('books')
 *   .addColumn({ field: 'rating', header: 'Rating' })
 *   .addField({ name: 'rating', type: 'number' })
 *   .addBlock('books:detail:sidebar', { component: RatingWidget })
 *   .register({ hooks, zones })
 */

/**
 * Default priority for extension hooks
 */
const DEFAULT_PRIORITY = 50

/**
 * Extension builder for fluent API
 *
 * @private
 */
class ExtensionBuilder {
  /**
   * @param {string} target - Target module name to extend
   */
  constructor(target) {
    if (!target || typeof target !== 'string') {
      throw new Error('[extendModule] Target module name must be a non-empty string')
    }
    this._target = target
    this._columns = []
    this._fields = []
    this._filters = []
    this._blocks = new Map()
  }

  /**
   * Add a column to the target module's list view
   *
   * @param {object} column - Column configuration
   * @param {string} column.field - Field name
   * @param {string} [column.header] - Column header label
   * @param {number} [column.width] - Column width
   * @param {Function} [column.body] - Custom body template function
   * @returns {this} For chaining
   */
  addColumn(column) {
    if (!column || !column.field) {
      throw new Error('[extendModule] Column must have a field property')
    }
    this._columns.push(column)
    return this
  }

  /**
   * Add multiple columns to the target module's list view
   *
   * @param {object[]} columns - Array of column configurations
   * @returns {this} For chaining
   */
  addColumns(columns) {
    if (!Array.isArray(columns)) {
      throw new Error('[extendModule] addColumns expects an array')
    }
    for (const column of columns) {
      this.addColumn(column)
    }
    return this
  }

  /**
   * Add a field to the target module's form view
   *
   * @param {object} field - Field configuration
   * @param {string} field.name - Field name
   * @param {string} [field.type='text'] - Field type
   * @param {string} [field.label] - Field label
   * @returns {this} For chaining
   */
  addField(field) {
    if (!field || !field.name) {
      throw new Error('[extendModule] Field must have a name property')
    }
    this._fields.push(field)
    return this
  }

  /**
   * Add multiple fields to the target module's form view
   *
   * @param {object[]} fields - Array of field configurations
   * @returns {this} For chaining
   */
  addFields(fields) {
    if (!Array.isArray(fields)) {
      throw new Error('[extendModule] addFields expects an array')
    }
    for (const field of fields) {
      this.addField(field)
    }
    return this
  }

  /**
   * Add a filter to the target module's filter bar
   *
   * @param {object} filter - Filter configuration
   * @param {string} filter.name - Filter name
   * @param {string} [filter.type='text'] - Filter type
   * @param {string} [filter.label] - Filter label
   * @returns {this} For chaining
   */
  addFilter(filter) {
    if (!filter || !filter.name) {
      throw new Error('[extendModule] Filter must have a name property')
    }
    this._filters.push(filter)
    return this
  }

  /**
   * Add multiple filters to the target module's filter bar
   *
   * @param {object[]} filters - Array of filter configurations
   * @returns {this} For chaining
   */
  addFilters(filters) {
    if (!Array.isArray(filters)) {
      throw new Error('[extendModule] addFilters expects an array')
    }
    for (const filter of filters) {
      this.addFilter(filter)
    }
    return this
  }

  /**
   * Add a block to a zone in the target module
   *
   * @param {string} zoneName - Zone name (e.g., 'books:detail:sidebar')
   * @param {object} block - Block configuration
   * @param {import('vue').Component} block.component - Vue component
   * @param {number} [block.weight=50] - Block weight for ordering
   * @param {object} [block.props={}] - Props to pass to component
   * @param {string} [block.id] - Unique block ID
   * @returns {this} For chaining
   */
  addBlock(zoneName, block) {
    if (!zoneName || typeof zoneName !== 'string') {
      throw new Error('[extendModule] Zone name must be a non-empty string')
    }
    if (!block || !block.component) {
      throw new Error('[extendModule] Block must have a component property')
    }
    if (!this._blocks.has(zoneName)) {
      this._blocks.set(zoneName, [])
    }
    this._blocks.get(zoneName).push(block)
    return this
  }

  /**
   * Add multiple blocks to a zone
   *
   * @param {string} zoneName - Zone name
   * @param {object[]} blocks - Array of block configurations
   * @returns {this} For chaining
   */
  addBlocks(zoneName, blocks) {
    if (!Array.isArray(blocks)) {
      throw new Error('[extendModule] addBlocks expects an array')
    }
    for (const block of blocks) {
      this.addBlock(zoneName, block)
    }
    return this
  }

  /**
   * Register all extensions with the kernel
   *
   * @param {object} context - Registration context
   * @param {object} context.hooks - HookRegistry instance
   * @param {object} [context.zones] - ZoneRegistry instance (required for blocks)
   * @param {number} [context.priority=50] - Hook priority
   * @returns {Function} Cleanup function to remove all extensions
   */
  register(context) {
    if (!context || !context.hooks) {
      throw new Error('[extendModule] register() requires { hooks } context')
    }

    const { hooks, zones, priority = DEFAULT_PRIORITY } = context
    const cleanupFns = []

    // Register column alter hook
    if (this._columns.length > 0) {
      const hookName = `${this._target}:list:alter`
      const columns = [...this._columns]
      const unbind = hooks.register(hookName, (config) => {
        if (!config.columns) {
          config.columns = []
        }
        config.columns.push(...columns)
        return config
      }, { priority })
      cleanupFns.push(unbind)
    }

    // Register field alter hook
    if (this._fields.length > 0) {
      const hookName = `${this._target}:form:alter`
      const fields = [...this._fields]
      const unbind = hooks.register(hookName, (config) => {
        if (!config.fields) {
          config.fields = []
        }
        config.fields.push(...fields)
        return config
      }, { priority })
      cleanupFns.push(unbind)
    }

    // Register filter alter hook
    if (this._filters.length > 0) {
      const hookName = `${this._target}:filter:alter`
      const filters = [...this._filters]
      const unbind = hooks.register(hookName, (config) => {
        if (!config.filters) {
          config.filters = []
        }
        config.filters.push(...filters)
        return config
      }, { priority })
      cleanupFns.push(unbind)
    }

    // Register zone blocks
    if (this._blocks.size > 0) {
      if (!zones) {
        throw new Error('[extendModule] register() requires { zones } context when blocks are defined')
      }
      for (const [zoneName, blocks] of this._blocks) {
        for (const block of blocks) {
          zones.registerBlock(zoneName, block)
        }
      }
      // Zone blocks cleanup: store zone/id pairs for removal
      const blockIds = []
      for (const [zoneName, blocks] of this._blocks) {
        for (const block of blocks) {
          if (block.id) {
            blockIds.push({ zoneName, id: block.id })
          }
        }
      }
      if (blockIds.length > 0) {
        cleanupFns.push(() => {
          for (const { zoneName, id } of blockIds) {
            zones.removeBlock(zoneName, id)
          }
        })
      }
    }

    // Return cleanup function
    return () => {
      for (const cleanup of cleanupFns) {
        cleanup()
      }
    }
  }

  /**
   * Get collected extensions as a config object
   *
   * Useful for debugging or serialization.
   *
   * @returns {object} Extensions config
   */
  toConfig() {
    const config = {
      target: this._target
    }
    if (this._columns.length > 0) {
      config.columns = [...this._columns]
    }
    if (this._fields.length > 0) {
      config.fields = [...this._fields]
    }
    if (this._filters.length > 0) {
      config.filters = [...this._filters]
    }
    if (this._blocks.size > 0) {
      config.blocks = {}
      for (const [zoneName, blocks] of this._blocks) {
        config.blocks[zoneName] = [...blocks]
      }
    }
    return config
  }
}

/**
 * Create an extension for a target module
 *
 * Can be used in two ways:
 * 1. Fluent API: extendModule('target').addColumn(...).register({ hooks })
 * 2. Config object: extendModule('target', { columns: [...] }, { hooks })
 *
 * @param {string} target - Target module name to extend
 * @param {object} [extensions] - Optional extensions config object
 * @param {object[]} [extensions.columns] - Columns to add to list view
 * @param {object[]} [extensions.fields] - Fields to add to form view
 * @param {object[]} [extensions.filters] - Filters to add to filter bar
 * @param {Object.<string, object[]>} [extensions.blocks] - Blocks to add to zones
 * @param {object} [context] - Registration context (required if extensions provided)
 * @param {object} context.hooks - HookRegistry instance
 * @param {object} [context.zones] - ZoneRegistry instance
 * @param {number} [context.priority] - Hook priority
 * @returns {ExtensionBuilder|Function} Builder for fluent API, or cleanup function if extensions provided
 */
export function extendModule(target, extensions, context) {
  const builder = new ExtensionBuilder(target)

  // If no extensions provided, return builder for fluent API
  if (!extensions) {
    return builder
  }

  // Config object approach: apply extensions and register immediately
  if (extensions.columns) {
    builder.addColumns(extensions.columns)
  }
  if (extensions.fields) {
    builder.addFields(extensions.fields)
  }
  if (extensions.filters) {
    builder.addFilters(extensions.filters)
  }
  if (extensions.blocks) {
    for (const [zoneName, blocks] of Object.entries(extensions.blocks)) {
      builder.addBlocks(zoneName, blocks)
    }
  }

  // Context required for config object approach
  if (!context) {
    throw new Error('[extendModule] Context { hooks } is required when extensions are provided')
  }

  return builder.register(context)
}

/**
 * ExtensionBuilder class export for instanceof checks
 */
export { ExtensionBuilder }
