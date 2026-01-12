/**
 * Auth Module
 *
 * AuthAdapter interface and implementations for scope/silo permission checks.
 * Includes Symfony-inspired role hierarchy and security checker.
 *
 * Multi-source auth:
 * - CompositeAuthAdapter routes to different adapters based on entity patterns
 * - authFactory normalizes config (instance, string, or object)
 */

// Interface
export { EntityAuthAdapter, AuthActions } from './EntityAuthAdapter'
export type { AuthUser, EntityAuthAdapterOptions, AuthAction } from './EntityAuthAdapter'

// Role Hierarchy (topological resolution)
export { RoleHierarchy, createRoleHierarchy } from './RoleHierarchy'
export type { RoleHierarchyConfig } from './RoleHierarchy'

// Security Checker (isGranted contract)
export { SecurityChecker, createSecurityChecker } from './SecurityChecker'
export type {
  RoleGranterAdapter,
  SecurityCheckerOptions,
  SecurityCheckerConfig,
} from './SecurityChecker'

// Implementations
export { PermissiveAuthAdapter, createPermissiveAdapter } from './PermissiveAdapter'
export { CompositeAuthAdapter, createCompositeAuthAdapter } from './CompositeAuthAdapter'
export type { CompositeAuthConfig } from './CompositeAuthAdapter'

// Factory/Resolver pattern (like storage/factory.ts)
export {
  authFactory,
  createAuthFactory,
  authTypes,
  parseAuthPattern,
  defaultAuthResolver,
} from './factory'
export type {
  ParsedAuthPattern,
  AuthConfig,
  AuthFactoryContext,
  AuthResolver,
  AuthFactoryInput,
} from './factory'
