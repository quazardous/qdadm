/**
 * Users Module - Using ctx.userEntity() helper
 *
 * Self-contained module that uses the system-provided UsersManager.
 * Admin-only access: Only ROLE_ADMIN can manage users.
 */

import { Module, MockApiStorage } from 'qdadm'

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
// MODULE
// ============================================================================

export class UsersModule extends Module {
  static name = 'users'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY - Using ctx.userEntity() helper
    // ════════════════════════════════════════════════════════════════════════
    // Creates a UsersManager with:
    // - username, password, role fields (role linked to roles entity)
    // - System entity flag
    // - Admin-only access
    //
    // Override examples:
    // -----------------
    // ctx.userEntity({
    //   storage: usersStorage,
    //
    //   // Add extra fields beyond username/password/role
    //   extraFields: {
    //     email: { type: 'email', label: 'Email', required: true },
    //     firstName: { type: 'text', label: 'First Name' },
    //     lastName: { type: 'text', label: 'Last Name' },
    //     avatar: { type: 'image', label: 'Avatar' }
    //   },
    //
    //   // Override default field configs
    //   fieldOverrides: {
    //     username: { label: 'Login', placeholder: 'Enter login...' },
    //     password: { label: 'Secret', required: false },  // Optional password
    //     role: { default: 'ROLE_GUEST' }  // Different default role
    //   },
    //
    //   // Change admin role (default: 'ROLE_ADMIN')
    //   adminRole: 'ROLE_SUPER_ADMIN',
    //
    //   // Allow non-admin access (default: true = admin only)
    //   adminOnly: false
    // })
    //
    ctx.userEntity({
      storage: usersStorage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('users', {
      list: () => import('./pages/UserList.vue'),
      form: () => import('./pages/UserForm.vue')
    }, {
      nav: { section: 'Security', icon: 'pi pi-users' }
    })
  }
}

export default UsersModule
