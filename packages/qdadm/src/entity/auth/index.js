/**
 * Auth Module
 *
 * AuthAdapter interface and implementations for scope/silo permission checks.
 * Includes Symfony-inspired role hierarchy and security checker.
 */

// Interface
export { AuthAdapter, AuthActions } from './AuthAdapter.js'

// Role Hierarchy (topological resolution)
export { RoleHierarchy, createRoleHierarchy } from './RoleHierarchy.js'

// Security Checker (isGranted contract)
export { SecurityChecker, createSecurityChecker } from './SecurityChecker.js'

// Implementations
export { PermissiveAuthAdapter, createPermissiveAdapter } from './PermissiveAdapter.js'
