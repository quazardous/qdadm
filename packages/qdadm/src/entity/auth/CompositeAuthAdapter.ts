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
 */

import { EntityAuthAdapter } from './EntityAuthAdapter'
import { authFactory, type AuthFactoryContext } from './factory'

/**
 * Pattern match entry
 */
interface PatternEntry {
  pattern: string
  regex: RegExp
  adapter: EntityAuthAdapter
}

/**
 * Composite adapter config
 */
export interface CompositeAuthConfig {
  default: EntityAuthAdapter | string | Record<string, unknown>
  mapping?: Record<string, EntityAuthAdapter | string | Record<string, unknown>>
}

/**
 * CompositeAuthAdapter - Routes to sub-adapters based on entity patterns
 */
export class CompositeAuthAdapter extends EntityAuthAdapter {
  protected _default: EntityAuthAdapter
  protected _exactMatches: Map<string, EntityAuthAdapter>
  protected _patterns: PatternEntry[]

  constructor(config: CompositeAuthConfig, context: AuthFactoryContext = {}) {
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
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
          .replace(/\*/g, '.*') // * → .*
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
   */
  protected _getAdapter(entity: string): EntityAuthAdapter {
    // 1. Exact match
    const exactMatch = this._exactMatches.get(entity)
    if (exactMatch) {
      return exactMatch
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
   */
  canPerform(entity: string, action: string): boolean {
    return this._getAdapter(entity).canPerform(entity, action)
  }

  /**
   * Check if user can access specific record (silo check)
   */
  canAccessRecord(entity: string, record: unknown): boolean {
    return this._getAdapter(entity).canAccessRecord(entity, record)
  }

  /**
   * Get current user from the default adapter
   */
  getCurrentUser() {
    return this._default.getCurrentUser()
  }

  /**
   * Check if user is granted an attribute (role or permission)
   */
  isGranted(attribute: string, subject: unknown = null): boolean {
    // For entity-specific permissions (entity:action), route to appropriate adapter
    if (attribute.includes(':') && !attribute.startsWith('ROLE_')) {
      const parts = attribute.split(':')
      const entity = parts[0] || ''
      const adapter = this._getAdapter(entity)
      if ('isGranted' in adapter && typeof adapter.isGranted === 'function') {
        return adapter.isGranted(attribute, subject)
      }
    }

    // Global permissions use default adapter
    if ('isGranted' in this._default && typeof this._default.isGranted === 'function') {
      return this._default.isGranted(attribute, subject)
    }

    // Fallback for adapters without isGranted
    return true
  }

  /**
   * Get the default adapter
   */
  get defaultAdapter(): EntityAuthAdapter {
    return this._default
  }

  /**
   * Get adapter info for debugging
   */
  getAdapterInfo(): {
    default: string
    exactMatches: Record<string, string>
    patterns: Array<{ pattern: string; adapter: string }>
  } {
    const info: {
      default: string
      exactMatches: Record<string, string>
      patterns: Array<{ pattern: string; adapter: string }>
    } = {
      default: this._getAdapterName(this._default),
      exactMatches: {},
      patterns: [],
    }

    for (const [entity, adapter] of this._exactMatches) {
      info.exactMatches[entity] = this._getAdapterName(adapter)
    }

    for (const { pattern, adapter } of this._patterns) {
      info.patterns.push({
        pattern,
        adapter: this._getAdapterName(adapter),
      })
    }

    return info
  }

  /**
   * Get adapter name for debugging
   */
  protected _getAdapterName(adapter: EntityAuthAdapter): string {
    return adapter.constructor?.name || 'Unknown'
  }
}

/**
 * Factory function to create CompositeAuthAdapter
 */
export function createCompositeAuthAdapter(
  config: CompositeAuthConfig,
  context: AuthFactoryContext = {}
): CompositeAuthAdapter {
  return new CompositeAuthAdapter(config, context)
}
