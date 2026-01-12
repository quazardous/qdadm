/**
 * Auth Factory/Resolver Pattern
 *
 * Enables declarative auth adapter configuration with auto-resolution.
 * Follows the same pattern as storage/factory.js for consistency.
 */

import { EntityAuthAdapter, type EntityAuthAdapterOptions, type AuthUser } from './EntityAuthAdapter'
import { PermissiveAuthAdapter } from './PermissiveAdapter'
import type { CompositeAuthAdapter, CompositeAuthConfig } from './CompositeAuthAdapter'

/**
 * Auth adapter class type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthAdapterClass = new (options?: any) => EntityAuthAdapter

/**
 * Built-in auth adapter types
 */
export const authTypes: Record<string, AuthAdapterClass> = {
  permissive: PermissiveAuthAdapter,
}

/**
 * Parsed auth pattern
 */
export interface ParsedAuthPattern {
  type: string
  scope?: string
  [key: string]: unknown
}

/**
 * Auth config object
 */
export interface AuthConfig {
  type?: string
  [key: string]: unknown
}

/**
 * Auth factory context
 */
export interface AuthFactoryContext {
  authTypes?: Record<string, AuthAdapterClass>
  authResolver?: AuthResolver
  CompositeAuthAdapter?: new (config: CompositeAuthConfig, context: AuthFactoryContext) => CompositeAuthAdapter
}

/**
 * Auth resolver function type
 */
export type AuthResolver = (config: AuthConfig, context: AuthFactoryContext) => EntityAuthAdapter

/**
 * Parse auth pattern 'type' or 'type:scope'
 */
export function parseAuthPattern(pattern: string): ParsedAuthPattern | null {
  if (typeof pattern !== 'string') return null

  const match = pattern.match(/^(\w+)(?::(.+))?$/)
  if (match && match[1]) {
    const type = match[1]
    const scope = match[2]
    return scope ? { type, scope } : { type }
  }
  return null
}

/**
 * Default auth resolver - creates adapter instance from config
 */
export function defaultAuthResolver(config: AuthConfig, context: AuthFactoryContext = {}): EntityAuthAdapter {
  const { type, ...rest } = config

  if (!type) {
    throw new Error('[authFactory] Config object requires "type" property')
  }

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
 */
function isCompositeConfig(config: unknown): config is CompositeAuthConfig {
  return (
    config !== null &&
    typeof config === 'object' &&
    'default' in config &&
    !('type' in config)
  )
}

/**
 * Auth factory input types
 */
export type AuthFactoryInput =
  | EntityAuthAdapter
  | ((options?: EntityAuthAdapterOptions) => AuthUser | null)
  | string
  | CompositeAuthConfig
  | AuthConfig
  | null
  | undefined

/**
 * Auth factory - normalizes input and resolves to adapter
 *
 * Handles:
 * - AuthAdapter instance → return directly (backward compatible)
 * - Function → wrap as EntityAuthAdapter with getCurrentUser callback
 * - String pattern 'type' → parse and resolve
 * - Config object with 'type' → resolve via registry
 * - Config object with 'default' → create CompositeAuthAdapter
 */
export function authFactory(
  config: AuthFactoryInput,
  context: AuthFactoryContext = {}
): EntityAuthAdapter {
  const { authResolver = defaultAuthResolver } = context

  // Null/undefined → permissive (safe default)
  if (config == null) {
    return new PermissiveAuthAdapter()
  }

  // Function → wrap in EntityAuthAdapter with getCurrentUser callback
  if (typeof config === 'function') {
    return new EntityAuthAdapter({ getCurrentUser: config as () => AuthUser | null })
  }

  // Already an EntityAuthAdapter instance → return directly (backward compatible)
  if (config instanceof EntityAuthAdapter) {
    return config
  }

  // Duck-typed adapter (has canPerform method)
  if (
    typeof config === 'object' &&
    'canPerform' in config &&
    typeof config.canPerform === 'function'
  ) {
    return config as unknown as EntityAuthAdapter
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
    if ('type' in config && config.type) {
      return authResolver(config as AuthConfig, context)
    }

    throw new Error('[authFactory] Config object requires either "type" or "default" property')
  }

  throw new Error(
    `[authFactory] Invalid auth config: ${typeof config}. ` +
      'Expected AuthAdapter instance, string, or config object.'
  )
}

/**
 * Create a custom auth factory with bound context
 */
export function createAuthFactory(
  context: AuthFactoryContext
): (config: AuthFactoryInput) => EntityAuthAdapter {
  return (config) => authFactory(config, context)
}
