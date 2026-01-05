/**
 * SecurityModule - Role management UI
 *
 * Provides a page to view/edit roles and permissions.
 * Works with any RoleGranterAdapter:
 * - StaticRoleGranterAdapter: read-only view
 * - PersistableRoleGranterAdapter: full CRUD
 * - EntityRoleGranterAdapter: full CRUD via entity
 *
 * Registers permissions:
 * - security:roles:read - View roles list
 * - security:roles:create - Create new roles
 * - security:roles:update - Edit existing roles
 * - security:roles:delete - Delete roles
 *
 * @example
 * import { SecurityModule } from 'qdadm/security'
 *
 * const kernel = new Kernel({
 *   moduleDefs: [SecurityModule, ...],
 *   security: {
 *     roleGranter: createLocalStorageRoleGranter({ ... })
 *   }
 * })
 */

import { Module } from '../kernel/Module.js'
import { RolesManager } from './RolesManager.js'

export class SecurityModule extends Module {
  static name = 'security'
  static requires = []
  static priority = 100 // Load late (after other modules register permissions)

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // PERMISSIONS
    // ════════════════════════════════════════════════════════════════════════
    ctx.permissions('security', {
      'roles:read': 'View roles and permissions',
      'roles:create': 'Create new roles',
      'roles:update': 'Edit role permissions',
      'roles:delete': 'Delete roles'
    })

    // ════════════════════════════════════════════════════════════════════════
    // ENTITY (wraps roleGranter)
    // ════════════════════════════════════════════════════════════════════════
    const rolesManager = new RolesManager({
      roleGranter: ctx.security?.roleGranter,
      permissionRegistry: ctx.permissionRegistry
    })

    ctx.entity('roles', rolesManager)

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('roles', {
      list: () => import('./pages/RoleList.vue'),
      form: () => import('./pages/RoleForm.vue')
    }, {
      basePath: 'security/roles',
      nav: {
        section: 'Security',
        icon: 'pi pi-shield',
        permission: 'security:roles:read'
      }
    })
  }
}

export default SecurityModule
