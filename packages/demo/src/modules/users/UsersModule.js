/**
 * Users Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, storage, manager)
 * - Routes (CRUD)
 * - Navigation
 *
 * Admin-only access: Only ROLE_ADMIN can manage users.
 */

import { Module, EntityManager, MockApiStorage } from 'qdadm'

// ============================================================================
// STORAGE
// ============================================================================

import usersFixture from '../../fixtures/users.json'

// Auth check imported from shared config (cross-module dependency)
import { authCheck } from '../../config/storages'

const usersStorage = new MockApiStorage({
  entityName: 'users',
  initialData: usersFixture,
  authCheck
})

// Internal storage (no auth check) for other modules (login validation, enrichment)
export const usersStorageInternal = new MockApiStorage({
  entityName: 'users',
  initialData: usersFixture
})

// ============================================================================
// ENTITY MANAGER
// ============================================================================

const roleOptions = [
  { label: 'Admin', value: 'ROLE_ADMIN' },
  { label: 'User', value: 'ROLE_USER' }
]

/**
 * UsersManager - Admin-only access
 */
class UsersManager extends EntityManager {
  _isAdmin() {
    const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
    return user?.role === 'ROLE_ADMIN'
  }

  canRead() { return this._isAdmin() }
  canCreate() { return this._isAdmin() }
  canUpdate() { return this._isAdmin() }
  canDelete() { return this._isAdmin() }
}

// ============================================================================
// MODULE
// ============================================================================

export class UsersModule extends Module {
  static name = 'users'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('users', new UsersManager({
      name: 'users',
      labelField: 'username',
      fields: {
        username: { type: 'text', label: 'Username', required: true, default: '' },
        password: { type: 'password', label: 'Password', required: true, default: '' },
        role: { type: 'select', label: 'Role', options: roleOptions, default: 'ROLE_USER' }
      },
      storage: usersStorage
    }))

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('users', {
      list: () => import('./pages/UserList.vue'),
      form: () => import('./pages/UserForm.vue')
    }, {
      nav: { section: 'Administration', icon: 'pi pi-users' }
    })
  }
}

export default UsersModule
