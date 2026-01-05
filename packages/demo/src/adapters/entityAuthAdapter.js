/**
 * EntityAuthAdapter for demo app
 *
 * Implements AuthAdapter interface for entity-level permission checks (scope/silo).
 * This adapter is injected into all EntityManagers via the Kernel bootstrap.
 *
 * Permission rules:
 * - Admin users: full access to all entities and records
 * - Regular users: access based on entity-specific rules
 *
 * This demonstrates how to create a centralized permission adapter that integrates
 * with your app's authentication system.
 */

import { EntityAuthAdapter } from 'qdadm'
import { authAdapter } from './authAdapter.js'

/**
 * Entity-specific permission rules
 * For each entity, define which actions are allowed for non-admin users
 *
 * Note: Entities listed in `requiresAuth` will deny access to unauthenticated users
 */
const entityPermissions = {
  // Books: authenticated users can read/list/create/update, only admin can delete
  books: {
    read: true,
    list: true,
    create: true,
    update: true,
    delete: (user) => user?.role === 'ROLE_ADMIN'
  },
  // Users: admin-only for all actions
  users: {
    read: (user) => user?.role === 'ROLE_ADMIN',
    list: (user) => user?.role === 'ROLE_ADMIN',
    create: (user) => user?.role === 'ROLE_ADMIN',
    update: (user) => user?.role === 'ROLE_ADMIN',
    delete: (user) => user?.role === 'ROLE_ADMIN'
  },
  // Loans: authenticated users can access (silo check handles ownership)
  loans: {
    read: true,
    list: true,
    create: true,
    update: true,
    delete: true
  },
  // Genres: authenticated users can read/list, admin can modify
  genres: {
    read: true,
    list: true,
    create: (user) => user?.role === 'ROLE_ADMIN',
    update: (user) => user?.role === 'ROLE_ADMIN',
    delete: (user) => user?.role === 'ROLE_ADMIN'
  }
}

/**
 * Entities that require authentication
 * Unauthenticated users will be denied access to these entities
 */
const requiresAuth = ['books', 'loans', 'genres', 'users']

/**
 * Entity-specific silo rules (record-level access)
 * Defines which records a user can access
 */
const siloRules = {
  // Loans: users can only access their own loans (admin sees all)
  loans: (user, record) => {
    if (user?.role === 'ROLE_ADMIN') return true
    return record?.user_id === user?.id
  }
  // Other entities: no silo restrictions (scope check is sufficient)
}

/**
 * General permission rules (not entity-specific)
 * These are for app-level permissions like impersonation
 */
const generalPermissions = {
  'user:impersonate': (user) => user?.role === 'ROLE_ADMIN'
}

export class DemoEntityAuthAdapter extends EntityAuthAdapter {
  /**
   * Check if user has a general permission (not entity-specific)
   *
   * @param {string} permission - Permission string (e.g., 'user:impersonate')
   * @returns {boolean}
   */
  isGranted(permission) {
    const user = this.getCurrentUser()

    // Admin bypass: admins have all permissions
    if (user?.role === 'ROLE_ADMIN') {
      return true
    }

    // Check specific permission rule
    const rule = generalPermissions[permission]
    if (typeof rule === 'function') {
      return rule(user)
    }

    // Unknown permission: deny by default
    return false
  }

  /**
   * Check if user can perform an action on an entity type (scope check)
   *
   * @param {string} entity - Entity name (e.g., 'users', 'books')
   * @param {string} action - Action: 'read', 'create', 'update', 'delete', 'list'
   * @returns {boolean}
   */
  canPerform(entity, action) {
    const user = this.getCurrentUser()

    // Check if entity requires authentication
    if (requiresAuth.includes(entity) && !user) {
      return false
    }

    // Admin bypass: admins can do everything
    if (user?.role === 'ROLE_ADMIN') {
      return true
    }

    // Check entity-specific permissions
    const permissions = entityPermissions[entity]
    if (!permissions) {
      // Unknown entity: default to permissive (or could be restrictive)
      return true
    }

    const permission = permissions[action]
    if (typeof permission === 'function') {
      return permission(user)
    }
    return !!permission
  }

  /**
   * Check if user can access a specific record (silo check)
   *
   * @param {string} entity - Entity name
   * @param {object} record - The record to check access for
   * @returns {boolean}
   */
  canAccessRecord(entity, record) {
    const user = this.getCurrentUser()

    // Admin bypass: admins can access all records
    if (user?.role === 'ROLE_ADMIN') {
      return true
    }

    // Check entity-specific silo rules
    const siloRule = siloRules[entity]
    if (siloRule) {
      return siloRule(user, record)
    }

    // No silo rule: allow access (scope check was sufficient)
    return true
  }

  /**
   * Get the current authenticated user
   *
   * @returns {object|null} Current user or null if not authenticated
   */
  getCurrentUser() {
    return authAdapter.getUser()
  }
}

/**
 * Singleton instance for the demo app
 * Used in Kernel bootstrap: entityAuthAdapter: demoEntityAuthAdapter
 */
export const demoEntityAuthAdapter = new DemoEntityAuthAdapter()
