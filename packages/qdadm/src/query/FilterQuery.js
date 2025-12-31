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
import { getNestedValue } from './QueryExecutor.js'

const VALID_SOURCES = ['entity', 'field']

/**
 * Resolve a value from an item using a path or function
 *
 * @param {object} item - The item to extract value from
 * @param {string|Function} resolver - Path string ('name', 'author.country') or function (item => value)
 * @returns {*} The resolved value
 */
function resolveValue(item, resolver) {
  if (typeof resolver === 'function') {
    return resolver(item)
  }

  // Use shared getNestedValue for path resolution
  return getNestedValue(resolver, item)
}

export class FilterQuery {
  /**
   * @param {object} options
   * @param {'entity'|'field'} options.source - Source type for options
   * @param {string} [options.entity] - Entity name (required if source='entity')
   * @param {string} [options.field] - Field name to extract values from (required if source='field')
   * @param {object} [options.parentManager] - Parent EntityManager (for field source, set by builder)
   * @param {string|Function} [options.label='name'] - Label resolver (path or function)
   * @param {string|Function} [options.value='id'] - Value resolver (path or function)
   * @param {Function} [options.transform] - Post-processing function for options
   * @param {Function} [options.toQuery] - Transform filter value to query object
   */
  constructor(options = {}) {
    const {
      source,
      entity = null,
      field = null,
      parentManager = null,
      label = 'name',
      value = 'id',
      transform = null,
      toQuery = null
    } = options

    // Validate source type
    if (!source || !VALID_SOURCES.includes(source)) {
      throw new Error(
        `FilterQuery: source must be one of: ${VALID_SOURCES.join(', ')}. Got: ${source}`
      )
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

    // Internal cache
    this._options = null
    this._signals = null
    this._subscriptions = []  // Signal unsubscribe functions for cleanup
  }

  /**
   * Set the parent manager (called by useListPageBuilder for field source)
   *
   * @param {EntityManager} manager
   * @returns {FilterQuery} this for chaining
   */
  setParentManager(manager) {
    this.parentManager = manager
    return this
  }

  /**
   * Set the SignalBus for cache invalidation
   *
   * Subscribes to entity CRUD signals ({entity}:created, {entity}:updated, {entity}:deleted)
   * to invalidate cached options when the source entity changes.
   *
   * Note: Auth changes are handled by Vue component lifecycle - when user logs out,
   * router guard redirects to login, component unmounts, FilterQuery is disposed.
   * On re-login, new FilterQuery is created with empty cache.
   *
   * @param {SignalBus} signals
   * @returns {FilterQuery} this for chaining
   */
  setSignals(signals) {
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
   * @private
   */
  _cleanupSubscriptions() {
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
  dispose() {
    this._cleanupSubscriptions()
    this._signals = null
    this._options = null
  }

  /**
   * Invalidate the cached options (forces refresh on next getOptions)
   */
  invalidate() {
    this._options = null
  }

  /**
   * Get options for dropdown
   *
   * @param {Orchestrator} [orchestrator] - Required for entity source
   * @returns {Promise<Array<{label: string, value: *}>>}
   */
  async getOptions(orchestrator = null) {
    // Return cached options if available
    if (this._options !== null) {
      return this._options
    }

    let items = []

    if (this.source === 'entity') {
      items = await this._fetchFromEntity(orchestrator)
    } else if (this.source === 'field') {
      items = this._extractFromField()
    }

    // Map items to { label, value } format
    let options = items.map(item => ({
      label: resolveValue(item, this.label),
      value: resolveValue(item, this.value)
    }))

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
   *
   * @param {Orchestrator} orchestrator
   * @returns {Promise<Array>}
   * @private
   */
  async _fetchFromEntity(orchestrator) {
    if (!orchestrator) {
      throw new Error('FilterQuery: orchestrator is required for entity source')
    }

    const manager = orchestrator.get(this.entity)
    if (!manager) {
      throw new Error(`FilterQuery: entity "${this.entity}" not found in orchestrator`)
    }

    // Fetch all items (large page_size to get everything)
    const result = await manager.list({ page_size: 1000 })
    return result.items || []
  }

  /**
   * Extract unique values from parent manager's cached items
   *
   * @returns {Array}
   * @private
   */
  _extractFromField() {
    if (!this.parentManager) {
      throw new Error('FilterQuery: parentManager is required for field source')
    }

    // Get cached items from parent manager
    const cachedItems = this.parentManager._cache || []

    if (cachedItems.length === 0) {
      return []
    }

    // Extract unique values from the field
    const seen = new Set()
    const items = []

    for (const item of cachedItems) {
      const fieldValue = resolveValue(item, this.field)
      if (fieldValue == null) continue

      // Create a unique key for deduplication
      const key = typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : fieldValue

      if (!seen.has(key)) {
        seen.add(key)
        // For field source, the item IS the value (create a simple object)
        items.push({
          [this.field]: fieldValue,
          // Also set 'name' and 'id' defaults for simple resolution
          name: fieldValue,
          id: fieldValue
        })
      }
    }

    return items
  }
}
