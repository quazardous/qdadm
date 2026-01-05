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
export { EntityAuthAdapter, AuthActions } from './EntityAuthAdapter.js'

// Role Hierarchy (topological resolution)
export { RoleHierarchy, createRoleHierarchy } from './RoleHierarchy.js'

// Security Checker (isGranted contract)
export { SecurityChecker, createSecurityChecker } from './SecurityChecker.js'

// Implementations
export { PermissiveAuthAdapter, createPermissiveAdapter } from './PermissiveAdapter.js'
export { CompositeAuthAdapter, createCompositeAuthAdapter } from './CompositeAuthAdapter.js'

// Factory/Resolver pattern (like storage/factory.js)
export {
  authFactory,
  createAuthFactory,
  authTypes,
  parseAuthPattern,
  defaultAuthResolver
} from './factory.js'
