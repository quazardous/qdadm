/**
 * CompositeAuthAdapter - Routes to sub-adapters based on entity patterns
 *
 * Enables multi-source authentication where different entities may use
 * different auth backends (internal JWT, external API keys, OAuth, etc.)
 *
 * Pattern matching:
 * - Exact match: 'products' matches only 'products'
 * - Prefix glob: 'external-*' matches 'external-products', 'external-orders'
 * - Suffix glob: '*-readonly' matches 'products-readonly'
 *
 * @example
 * ```js
 * const composite = new CompositeAuthAdapter({
 *   default: internalAuthAdapter,  // JWT for most entities
 *   mapping: {
 *     'products': apiKeyAdapter,    // API key for products
 *     'external-*': externalAuth,   // OAuth for external-* entities
 *     'readonly-*': readonlyAuth    // Read-only adapter
 *   }
 * })
 *
 * composite.canPerform('books', 'read')     // → uses default (internal)
 * composite.canPerform('products', 'read')  // → uses apiKeyAdapter
 * composite.canPerform('external-orders', 'read')  // → uses externalAuth
 * ```
 */

import { AuthAdapter } from './AuthAdapter.js'
import { authFactory } from './factory.js'

export class CompositeAuthAdapter extends AuthAdapter {
  /**
   * @param {object} config - Composite auth configuration
   * @param {AuthAdapter|string|object} config.default - Default adapter (required)
   * @param {Object<string, AuthAdapter|string|object>} [config.mapping={}] - Entity pattern to adapter mapping
   * @param {object} [context={}] - Factory context with authTypes
   */
  constructor(config, context = {}) {
    super()

    const { default: defaultConfig, mapping = {} } = config

    if (!defaultConfig) {
      throw new Error('[CompositeAuthAdapter] "default" adapter is required')
    }

    // Resolve default adapter via factory
    this._default = authFactory(defaultConfig, context)

    // Resolve mapped adapters
    this._exactMatches = new Map()
    this._patterns = []

    for (const [pattern, adapterConfig] of Object.entries(mapping)) {
      const adapter = authFactory(adapterConfig, context)

      if (pattern.includes('*')) {
        // Glob pattern: convert to regex
        const regexPattern = pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
          .replace(/\*/g, '.*')  // * → .*
        const regex = new RegExp(`^${regexPattern}$`)
        this._patterns.push({ pattern, regex, adapter })
      } else {
        // Exact match
        this._exactMatches.set(pattern, adapter)
      }
    }
  }

  /**
   * Get the adapter for a specific entity
   *
   * Resolution order:
   * 1. Exact match in mapping
   * 2. First matching glob pattern
   * 3. Default adapter
   *
   * @param {string} entity - Entity name
   * @returns {AuthAdapter}
   */
  _getAdapter(entity) {
    // 1. Exact match
    if (this._exactMatches.has(entity)) {
      return this._exactMatches.get(entity)
    }

    // 2. Pattern match (first wins)
    for (const { regex, adapter } of this._patterns) {
      if (regex.test(entity)) {
        return adapter
      }
    }

    // 3. Default
    return this._default
  }

  /**
   * Check if user can perform action on entity type (scope check)
   * Delegates to the appropriate adapter based on entity name
   *
   * @param {string} entity - Entity name
   * @param {string} action - Action: read, create, update, delete, list
   * @returns {boolean}
   */
  canPerform(entity, action) {
    return this._getAdapter(entity).canPerform(entity, action)
  }

  /**
   * Check if user can access specific record (silo check)
   * Delegates to the appropriate adapter based on entity name
   *
   * @param {string} entity - Entity name
   * @param {object} record - The record to check
   * @returns {boolean}
   */
  canAccessRecord(entity, record) {
    return this._getAdapter(entity).canAccessRecord(entity, record)
  }

  /**
   * Get current user from the default adapter
   * The "user" concept comes from the primary auth source
   *
   * @returns {object|null}
   */
  getCurrentUser() {
    return this._default.getCurrentUser()
  }

  /**
   * Check if user is granted an attribute (role or permission)
   * Delegates to default adapter for global permissions
   *
   * @param {string} attribute - Role or permission to check
   * @param {object} [subject] - Optional subject for context
   * @returns {boolean}
   */
  isGranted(attribute, subject = null) {
    // For entity-specific permissions (entity:action), route to appropriate adapter
    if (attribute.includes(':') && !attribute.startsWith('ROLE_')) {
      const [entity] = attribute.split(':')
      const adapter = this._getAdapter(entity)
      if (adapter.isGranted) {
        return adapter.isGranted(attribute, subject)
      }
    }

    // Global permissions use default adapter
    if (this._default.isGranted) {
      return this._default.isGranted(attribute, subject)
    }

    // Fallback for adapters without isGranted
    return true
  }

  /**
   * Get the default adapter
   * @returns {AuthAdapter}
   */
  get defaultAdapter() {
    return this._default
  }

  /**
   * Get adapter info for debugging
   * @returns {object}
   */
  getAdapterInfo() {
    const info = {
      default: this._getAdapterName(this._default),
      exactMatches: {},
      patterns: []
    }

    for (const [entity, adapter] of this._exactMatches) {
      info.exactMatches[entity] = this._getAdapterName(adapter)
    }

    for (const { pattern, adapter } of this._patterns) {
      info.patterns.push({
        pattern,
        adapter: this._getAdapterName(adapter)
      })
    }

    return info
  }

  /**
   * Get adapter name for debugging
   * @private
   */
  _getAdapterName(adapter) {
    return adapter.constructor?.name || 'Unknown'
  }
}

/**
 * Factory function to create CompositeAuthAdapter
 *
 * @param {object} config - { default, mapping }
 * @param {object} [context] - Factory context
 * @returns {CompositeAuthAdapter}
 */
export function createCompositeAuthAdapter(config, context = {}) {
  return new CompositeAuthAdapter(config, context)
}
