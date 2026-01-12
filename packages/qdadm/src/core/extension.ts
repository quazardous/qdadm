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

import type { Component } from 'vue'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { ZoneRegistry } from '../zones/ZoneRegistry'

/**
 * Default priority for extension hooks
 */
const DEFAULT_PRIORITY = 50

/**
 * Column configuration
 */
export interface ExtensionColumn {
  field: string
  header?: string
  width?: number
  body?: (data: unknown) => unknown
  [key: string]: unknown
}

/**
 * Field configuration
 */
export interface ExtensionField {
  name: string
  type?: string
  label?: string
  [key: string]: unknown
}

/**
 * Filter configuration
 */
export interface ExtensionFilter {
  name: string
  type?: string
  label?: string
  [key: string]: unknown
}

/**
 * Block configuration
 */
export interface ExtensionBlock {
  component: Component
  weight?: number
  props?: Record<string, unknown>
  id?: string
  [key: string]: unknown
}

/**
 * Extensions config object
 */
export interface ExtensionsConfig {
  columns?: ExtensionColumn[]
  fields?: ExtensionField[]
  filters?: ExtensionFilter[]
  blocks?: Record<string, ExtensionBlock[]>
}

/**
 * Registration context
 */
export interface ExtensionContext {
  hooks: HookRegistry
  zones?: ZoneRegistry
  priority?: number
}

/**
 * Collected extensions config for serialization
 */
export interface CollectedExtensions {
  target: string
  columns?: ExtensionColumn[]
  fields?: ExtensionField[]
  filters?: ExtensionFilter[]
  blocks?: Record<string, ExtensionBlock[]>
}

/**
 * Block ID reference for cleanup
 */
interface BlockIdRef {
  zoneName: string
  id: string
}

/**
 * Extension builder for fluent API
 */
export class ExtensionBuilder {
  private _target: string
  private _columns: ExtensionColumn[]
  private _fields: ExtensionField[]
  private _filters: ExtensionFilter[]
  private _blocks: Map<string, ExtensionBlock[]>

  /**
   * @param target - Target module name to extend
   */
  constructor(target: string) {
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
   * @param column - Column configuration
   * @returns This instance for chaining
   */
  addColumn(column: ExtensionColumn): this {
    if (!column || !column.field) {
      throw new Error('[extendModule] Column must have a field property')
    }
    this._columns.push(column)
    return this
  }

  /**
   * Add multiple columns to the target module's list view
   *
   * @param columns - Array of column configurations
   * @returns This instance for chaining
   */
  addColumns(columns: ExtensionColumn[]): this {
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
   * @param field - Field configuration
   * @returns This instance for chaining
   */
  addField(field: ExtensionField): this {
    if (!field || !field.name) {
      throw new Error('[extendModule] Field must have a name property')
    }
    this._fields.push(field)
    return this
  }

  /**
   * Add multiple fields to the target module's form view
   *
   * @param fields - Array of field configurations
   * @returns This instance for chaining
   */
  addFields(fields: ExtensionField[]): this {
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
   * @param filter - Filter configuration
   * @returns This instance for chaining
   */
  addFilter(filter: ExtensionFilter): this {
    if (!filter || !filter.name) {
      throw new Error('[extendModule] Filter must have a name property')
    }
    this._filters.push(filter)
    return this
  }

  /**
   * Add multiple filters to the target module's filter bar
   *
   * @param filters - Array of filter configurations
   * @returns This instance for chaining
   */
  addFilters(filters: ExtensionFilter[]): this {
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
   * @param zoneName - Zone name (e.g., 'books:detail:sidebar')
   * @param block - Block configuration
   * @returns This instance for chaining
   */
  addBlock(zoneName: string, block: ExtensionBlock): this {
    if (!zoneName || typeof zoneName !== 'string') {
      throw new Error('[extendModule] Zone name must be a non-empty string')
    }
    if (!block || !block.component) {
      throw new Error('[extendModule] Block must have a component property')
    }
    if (!this._blocks.has(zoneName)) {
      this._blocks.set(zoneName, [])
    }
    this._blocks.get(zoneName)!.push(block)
    return this
  }

  /**
   * Add multiple blocks to a zone
   *
   * @param zoneName - Zone name
   * @param blocks - Array of block configurations
   * @returns This instance for chaining
   */
  addBlocks(zoneName: string, blocks: ExtensionBlock[]): this {
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
   * @param context - Registration context
   * @returns Cleanup function to remove all extensions
   */
  register(context: ExtensionContext): () => void {
    if (!context || !context.hooks) {
      throw new Error('[extendModule] register() requires { hooks } context')
    }

    const { hooks, zones, priority = DEFAULT_PRIORITY } = context
    const cleanupFns: Array<() => void> = []

    // Register column alter hook
    if (this._columns.length > 0) {
      const hookName = `${this._target}:list:alter`
      const columns = [...this._columns]
      const unbind = hooks.register(
        hookName,
        (config) => {
          const cfg = config as { columns?: ExtensionColumn[] }
          if (!cfg.columns) {
            cfg.columns = []
          }
          cfg.columns.push(...columns)
          return config
        },
        { priority }
      )
      cleanupFns.push(unbind)
    }

    // Register field alter hook
    if (this._fields.length > 0) {
      const hookName = `${this._target}:form:alter`
      const fields = [...this._fields]
      const unbind = hooks.register(
        hookName,
        (config) => {
          const cfg = config as { fields?: ExtensionField[] }
          if (!cfg.fields) {
            cfg.fields = []
          }
          cfg.fields.push(...fields)
          return config
        },
        { priority }
      )
      cleanupFns.push(unbind)
    }

    // Register filter alter hook
    if (this._filters.length > 0) {
      const hookName = `${this._target}:filter:alter`
      const filters = [...this._filters]
      const unbind = hooks.register(
        hookName,
        (config) => {
          const cfg = config as { filters?: ExtensionFilter[] }
          if (!cfg.filters) {
            cfg.filters = []
          }
          cfg.filters.push(...filters)
          return config
        },
        { priority }
      )
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
      const blockIds: BlockIdRef[] = []
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
   * @returns Extensions config
   */
  toConfig(): CollectedExtensions {
    const config: CollectedExtensions = {
      target: this._target,
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
 * @param target - Target module name to extend
 * @param extensions - Optional extensions config object
 * @param context - Registration context (required if extensions provided)
 * @returns Builder for fluent API, or cleanup function if extensions provided
 */
export function extendModule(target: string): ExtensionBuilder
export function extendModule(
  target: string,
  extensions: ExtensionsConfig,
  context: ExtensionContext
): () => void
export function extendModule(
  target: string,
  extensions?: ExtensionsConfig,
  context?: ExtensionContext
): ExtensionBuilder | (() => void) {
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
