/**
 * Auth Module
 *
 * AuthAdapter interface and implementations for scope/silo permission checks.
 */

// Interface
export { AuthAdapter, AuthActions } from './AuthAdapter.js'

// Implementations
export { PermissiveAuthAdapter, createPermissiveAdapter } from './PermissiveAdapter.js'
