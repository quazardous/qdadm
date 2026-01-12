import type { SecurityChecker } from './SecurityChecker'

/**
 * User type for auth checks
 */
export interface AuthUser {
  id?: string | number
  role?: string
  roles?: string[]
  permissions?: string[]
  [key: string]: unknown
}

/**
 * EntityAuthAdapter options
 */
export interface EntityAuthAdapterOptions {
  getCurrentUser?: () => AuthUser | null
}

/**
 * EntityAuthAdapter - Thin layer for entity-level permission checks
 *
 * Provides entity-level permission checking by delegating to SecurityChecker.
 * All methods have sensible defaults - subclass only if you need custom behavior.
 */
export class EntityAuthAdapter {
  protected _securityChecker: SecurityChecker | null = null
  protected _getCurrentUserCallback: (() => AuthUser | null) | null = null

  constructor(options: EntityAuthAdapterOptions = {}) {
    if (options.getCurrentUser) {
      this._getCurrentUserCallback = options.getCurrentUser
    }
  }

  /**
   * Set the SecurityChecker instance for isGranted() delegation
   */
  setSecurityChecker(checker: SecurityChecker): void {
    this._securityChecker = checker
  }

  /**
   * Check if current user is granted an attribute (Symfony-like contract)
   *
   * This is the unified permission check method. It delegates to SecurityChecker
   * if one is configured, otherwise returns true (permissive fallback).
   */
  isGranted(attribute: string, subject: unknown = null): boolean {
    if (!this._securityChecker) return true // Permissive if not configured
    return this._securityChecker.isGranted(attribute, subject)
  }

  /**
   * Check if current user can assign a specific role
   */
  canAssignRole(targetRole: string): boolean {
    if (!this._securityChecker) return true
    return this._securityChecker.canAssignRole(targetRole)
  }

  /**
   * Get all roles that current user can assign
   */
  getAssignableRoles(): string[] {
    if (!this._securityChecker) return []
    return this._securityChecker.getAssignableRoles()
  }

  /**
   * Check if the current user can perform an action on an entity type (scope check)
   *
   * Default: delegates to isGranted('entity:{entity}:{action}')
   * Override for custom authentication requirements or business rules.
   */
  canPerform(_entity: string, _action: string): boolean {
    return this.isGranted(`entity:${_entity}:${_action}`)
  }

  /**
   * Check if the current user can access a specific record (silo check)
   *
   * Default: delegates to isGranted('entity:{entity}:read', record)
   * Note: Ownership checks are typically handled via EntityManager's isOwn callback.
   */
  canAccessRecord(_entity: string, record: unknown): boolean {
    return this.isGranted(`entity:${_entity}:read`, record)
  }

  /**
   * Get the current authenticated user
   *
   * Returns user from:
   * 1. _getCurrentUserCallback if provided in constructor
   * 2. Subclass override if using class extension pattern
   * 3. null if neither is configured
   */
  getCurrentUser(): AuthUser | null {
    if (this._getCurrentUserCallback) {
      return this._getCurrentUserCallback()
    }
    // Subclasses can override this method
    return null
  }
}

/**
 * Valid action types for scope checks
 */
export const AuthActions = Object.freeze({
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
} as const)

export type AuthAction = (typeof AuthActions)[keyof typeof AuthActions]
