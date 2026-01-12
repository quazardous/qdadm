/**
 * FilterQuery - Resolves dropdown options for filters
 *
 * Abstracts option resolution from two sources:
 * - 'entity': fetch options from a related EntityManager
 * - 'field': extract distinct values from parent manager's cached items
 *
 * Usage:
 * ```js
 * // Entity source - fetch from genres EntityManager
 * const query = new FilterQuery({
 *   source: 'entity',
 *   entity: 'genres',
 *   label: 'name',
 *   value: 'id'
 * })
 *
 * // Field source - extract unique status values
 * const query = new FilterQuery({
 *   source: 'field',
 *   field: 'status'
 * })
 *
 * // Get options (async)
 * const options = await query.getOptions(orchestrator)
 * // → [{ label: 'Rock', value: 1 }, { label: 'Jazz', value: 2 }]
 * ```
 */
import { getNestedValue } from './QueryExecutor'

const VALID_SOURCES = ['entity', 'field'] as const

export type FilterQuerySource = (typeof VALID_SOURCES)[number]

/**
 * Option item for dropdowns
 */
export interface FilterOption {
  label: string | null | undefined
  value: unknown
}

/**
 * Value resolver - can be a path string or function
 */
export type ValueResolver<T = unknown> = string | ((item: T) => unknown)

/**
 * FilterQuery constructor options
 */
export interface FilterQueryOptions<T = unknown> {
  source: FilterQuerySource
  entity?: string | null
  field?: string | null
  parentManager?: EntityManagerLike | null
  label?: ValueResolver<T>
  value?: ValueResolver<T>
  transform?: ((options: FilterOption[]) => FilterOption[]) | null
  toQuery?: ((value: unknown) => Record<string, unknown>) | null
}

/**
 * Minimal interface for EntityManager (to avoid circular deps)
 */
interface EntityManagerLike {
  _cache?: unknown[]
  list(params?: { page_size?: number }): Promise<{ items: unknown[] }>
}

/**
 * Minimal interface for Orchestrator (to avoid circular deps)
 */
interface OrchestratorLike {
  get(name: string): EntityManagerLike | undefined
}

/**
 * Minimal interface for SignalBus (to avoid circular deps)
 */
interface SignalBusLike {
  on(signal: string, handler: () => void): () => void
}

/**
 * Resolve a value from an item using a path or function
 */
function resolveValue<T>(item: T, resolver: ValueResolver<T>): unknown {
  if (typeof resolver === 'function') {
    return resolver(item)
  }

  // Use shared getNestedValue for path resolution
  return getNestedValue(resolver, item)
}

export class FilterQuery<T = unknown> {
  source: FilterQuerySource
  entity: string | null
  field: string | null
  parentManager: EntityManagerLike | null
  label: ValueResolver<T>
  value: ValueResolver<T>
  transform: ((options: FilterOption[]) => FilterOption[]) | null
  toQuery: ((value: unknown) => Record<string, unknown>) | null

  private _options: FilterOption[] | null = null
  private _signals: SignalBusLike | null = null
  private _subscriptions: Array<() => void> = []

  constructor(options: FilterQueryOptions<T>) {
    const {
      source,
      entity = null,
      field = null,
      parentManager = null,
      label = 'name',
      value = 'id',
      transform = null,
      toQuery = null,
    } = options

    // Validate source type
    if (!source || !VALID_SOURCES.includes(source)) {
      throw new Error(`FilterQuery: source must be one of: ${VALID_SOURCES.join(', ')}. Got: ${source}`)
    }

    // Validate source-specific requirements
    if (source === 'entity' && !entity) {
      throw new Error('FilterQuery: entity is required when source is "entity"')
    }

    if (source === 'field' && !field) {
      throw new Error('FilterQuery: field is required when source is "field"')
    }

    this.source = source
    this.entity = entity
    this.field = field
    this.parentManager = parentManager
    this.label = label
    this.value = value
    this.transform = transform
    this.toQuery = toQuery
  }

  /**
   * Set the parent manager (called by useListPage for field source)
   */
  setParentManager(manager: EntityManagerLike): this {
    this.parentManager = manager
    return this
  }

  /**
   * Set the SignalBus for cache invalidation
   *
   * Subscribes to entity CRUD signals ({entity}:created, {entity}:updated, {entity}:deleted)
   * to invalidate cached options when the source entity changes.
   */
  setSignals(signals: SignalBusLike | null): this {
    // Clean up existing subscriptions if any
    this._cleanupSubscriptions()

    this._signals = signals

    if (!signals) return this

    // Subscribe to entity CRUD signals for cache invalidation
    if (this.source === 'entity' && this.entity) {
      const actions = ['created', 'updated', 'deleted']
      for (const action of actions) {
        const signalName = `${this.entity}:${action}`
        const unbind = signals.on(signalName, () => this.invalidate())
        this._subscriptions.push(unbind)
      }
    }

    return this
  }

  /**
   * Cleanup signal subscriptions
   */
  private _cleanupSubscriptions(): void {
    for (const unbind of this._subscriptions) {
      if (typeof unbind === 'function') {
        unbind()
      }
    }
    this._subscriptions = []
  }

  /**
   * Dispose the FilterQuery, cleaning up signal subscriptions
   *
   * Call this when the FilterQuery is no longer needed to prevent memory leaks.
   */
  dispose(): void {
    this._cleanupSubscriptions()
    this._signals = null
    this._options = null
  }

  /**
   * Invalidate the cached options (forces refresh on next getOptions)
   */
  invalidate(): void {
    this._options = null
  }

  /**
   * Get options for dropdown
   */
  async getOptions(orchestrator: OrchestratorLike | null = null): Promise<FilterOption[]> {
    // Return cached options if available
    if (this._options !== null) {
      return this._options
    }

    let items: unknown[] = []

    if (this.source === 'entity') {
      items = await this._fetchFromEntity(orchestrator)
    } else if (this.source === 'field') {
      items = this._extractFromField()
    }

    // Map items to { label, value } format
    let options: FilterOption[] = items.map((item) => {
      const labelValue = resolveValue(item as T, this.label)
      return {
        label: labelValue == null ? labelValue : String(labelValue),
        value: resolveValue(item as T, this.value),
      }
    })

    // Apply transform if provided
    if (typeof this.transform === 'function') {
      options = this.transform(options)
    }

    // Cache the result
    this._options = options

    return options
  }

  /**
   * Fetch items from entity manager
   */
  private async _fetchFromEntity(orchestrator: OrchestratorLike | null): Promise<unknown[]> {
    if (!orchestrator) {
      throw new Error('FilterQuery: orchestrator is required for entity source')
    }

    const manager = orchestrator.get(this.entity!)
    if (!manager) {
      throw new Error(`FilterQuery: entity "${this.entity}" not found in orchestrator`)
    }

    // Fetch all items (large page_size to get everything)
    const result = await manager.list({ page_size: 1000 })
    return result.items || []
  }

  /**
   * Extract unique values from parent manager's cached items
   */
  private _extractFromField(): unknown[] {
    if (!this.parentManager) {
      throw new Error('FilterQuery: parentManager is required for field source')
    }

    // Get cached items from parent manager
    const cachedItems = this.parentManager._cache || []

    if (cachedItems.length === 0) {
      return []
    }

    // Extract unique values from the field
    const seen = new Set<string>()
    const items: unknown[] = []

    for (const item of cachedItems) {
      const fieldValue = resolveValue(item as T, this.field!)
      if (fieldValue == null) continue

      // Create a unique key for deduplication
      const key = typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue)

      if (!seen.has(key)) {
        seen.add(key)
        // For field source, the item IS the value (create a simple object)
        items.push({
          [this.field!]: fieldValue,
          // Also set 'name' and 'id' defaults for simple resolution
          name: fieldValue,
          id: fieldValue,
        })
      }
    }

    return items
  }
}
