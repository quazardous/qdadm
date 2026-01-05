/**
 * Auth Factory/Resolver Pattern
 *
 * Enables declarative auth adapter configuration with auto-resolution.
 * Follows the same pattern as storage/factory.js for consistency.
 *
 * IMPORTANT: Backward compatible - passing an AuthAdapter instance
 * works exactly as before (simple passthrough).
 *
 * Usage:
 * ```js
 * // Instance passthrough (current behavior, unchanged)
 * authFactory(myAdapter)  // → myAdapter
 *
 * // String pattern → factory resolves from registry
 * authFactory('permissive')  // → PermissiveAuthAdapter
 * authFactory('jwt:internal')  // → JwtAuthAdapter (if registered)
 *
 * // Config object → factory resolves
 * authFactory({ type: 'jwt', tokenKey: 'auth_token' })
 *
 * // Composite config → creates CompositeAuthAdapter
 * authFactory({
 *   default: myAdapter,
 *   mapping: { 'external-*': externalAdapter }
 * })
 * ```
 */

import { EntityAuthAdapter } from './EntityAuthAdapter.js'
import { PermissiveAuthAdapter } from './PermissiveAdapter.js'

/**
 * Built-in auth adapter types
 * Extended via context.authTypes for custom adapters
 * @type {Record<string, typeof EntityAuthAdapter>}
 */
export const authTypes = {
  permissive: PermissiveAuthAdapter
}

/**
 * Parse auth pattern 'type' or 'type:scope'
 *
 * @param {string} pattern - Auth pattern (e.g., 'jwt', 'apikey:external')
 * @returns {{type: string, scope?: string} | null} Parsed config or null
 *
 * @example
 * parseAuthPattern('jwt')            // → { type: 'jwt' }
 * parseAuthPattern('apikey:external') // → { type: 'apikey', scope: 'external' }
 */
export function parseAuthPattern(pattern) {
  if (typeof pattern !== 'string') return null

  const match = pattern.match(/^(\w+)(?::(.+))?$/)
  if (match) {
    const [, type, scope] = match
    return scope ? { type, scope } : { type }
  }
  return null
}

/**
 * Default auth resolver - creates adapter instance from config
 *
 * @param {object} config - Normalized auth config with `type` property
 * @param {object} context - Context with authTypes registry
 * @returns {EntityAuthAdapter} Adapter instance
 */
export function defaultAuthResolver(config, context = {}) {
  const { type, ...rest } = config

  // Merge built-in types with custom types from context
  const allTypes = { ...authTypes, ...context.authTypes }
  const AdapterClass = allTypes[type]

  if (!AdapterClass) {
    throw new Error(
      `[authFactory] Unknown auth type: "${type}". ` +
      `Available: ${Object.keys(allTypes).join(', ')}`
    )
  }

  return new AdapterClass(rest)
}

/**
 * Check if config is a composite auth config
 * Composite config has 'default' + optional 'mapping'
 *
 * @param {any} config
 * @returns {boolean}
 */
function isCompositeConfig(config) {
  return (
    config &&
    typeof config === 'object' &&
    'default' in config &&
    !('type' in config)
  )
}

/**
 * Auth factory - normalizes input and resolves to adapter
 *
 * Handles:
 * - AuthAdapter instance → return directly (backward compatible)
 * - String pattern 'type' → parse and resolve
 * - Config object with 'type' → resolve via registry
 * - Config object with 'default' → create CompositeAuthAdapter
 *
 * @param {EntityAuthAdapter | string | object} config - Auth config
 * @param {object} [context={}] - Context with authTypes, authResolver
 * @returns {EntityAuthAdapter} Adapter instance
 *
 * @example
 * // Instance passthrough (most common, backward compatible)
 * authFactory(myAdapter)  // → myAdapter
 *
 * // String patterns
 * authFactory('permissive')  // → PermissiveAuthAdapter
 * authFactory('jwt')  // → JwtAuthAdapter (if registered)
 *
 * // Config objects
 * authFactory({ type: 'jwt', tokenKey: 'token' })
 *
 * // Composite (multi-source)
 * authFactory({
 *   default: myAdapter,
 *   mapping: { 'products': apiKeyAdapter }
 * })
 */
export function authFactory(config, context = {}) {
  const { authResolver = defaultAuthResolver } = context

  // Null/undefined → permissive (safe default)
  if (config == null) {
    return new PermissiveAuthAdapter()
  }

  // Already an EntityAuthAdapter instance → return directly (backward compatible)
  if (config instanceof EntityAuthAdapter) {
    return config
  }

  // Duck-typed adapter (has canPerform method)
  if (typeof config.canPerform === 'function') {
    return config
  }

  // String pattern → parse and resolve
  if (typeof config === 'string') {
    const parsed = parseAuthPattern(config)
    if (!parsed) {
      throw new Error(`[authFactory] Invalid auth pattern: "${config}"`)
    }
    return authResolver(parsed, context)
  }

  // Config object
  if (typeof config === 'object') {
    // Composite config: { default: ..., mapping: { ... } }
    // Handled separately to avoid circular dependency
    // The CompositeAuthAdapter is resolved via authTypes registry
    if (isCompositeConfig(config)) {
      const CompositeClass = context.authTypes?.composite || context.CompositeAuthAdapter
      if (!CompositeClass) {
        throw new Error(
          '[authFactory] Composite config requires CompositeAuthAdapter. ' +
          'Pass it via context.CompositeAuthAdapter or register as context.authTypes.composite'
        )
      }
      return new CompositeClass(config, context)
    }

    // Simple config with type: { type: 'jwt', ... }
    if (config.type) {
      return authResolver(config, context)
    }

    throw new Error(
      '[authFactory] Config object requires either "type" or "default" property'
    )
  }

  throw new Error(
    `[authFactory] Invalid auth config: ${typeof config}. ` +
    'Expected AuthAdapter instance, string, or config object.'
  )
}

/**
 * Create a custom auth factory with bound context
 *
 * @param {object} context - Context with authTypes, authResolver
 * @returns {function} Auth factory with bound context
 *
 * @example
 * const myAuthFactory = createAuthFactory({
 *   authTypes: { jwt: JwtAuthAdapter, apikey: ApiKeyAuthAdapter }
 * })
 *
 * const adapter = myAuthFactory('jwt')
 */
export function createAuthFactory(context) {
  return (config) => authFactory(config, context)
}
