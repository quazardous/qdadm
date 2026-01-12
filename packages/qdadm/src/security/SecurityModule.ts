/**
 * SecurityModule - Role management UI
 *
 * Provides a page to view/edit roles and permissions.
 * Works with any RoleGranterAdapter:
 * - StaticRoleGranterAdapter: read-only view
 * - PersistableRoleGranterAdapter: full CRUD
 * - EntityRoleGranterAdapter: full CRUD via entity
 *
 * Dynamically registers permissions from managers:
 * - RolesManager.adminPermission (default: security:roles:manage)
 * - security:users:manage (for UsersManager)
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

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { Module } from '../kernel/Module'
import { RolesManager } from './RolesManager'
import type { RoleGranterAdapter } from './RoleGranterAdapter'
import type { PermissionRegistry } from './PermissionRegistry'

/**
 * Kernel context interface for modules
 */
interface ModuleContext {
  security?: {
    roleGranter?: RoleGranterAdapter
  }
  permissionRegistry?: PermissionRegistry
  entity(name: string, manager: unknown): void
  permissions(namespace: string, permissions: Record<string, string>): void
  crud(
    name: string,
    pages: { list?: () => Promise<unknown>; form?: () => Promise<unknown> },
    options?: { basePath?: string; nav?: { section?: string; icon?: string; permission?: string } }
  ): void
}

export class SecurityModule extends Module {
  static override moduleName = 'security'
  static override requires: string[] = []
  static override priority = 100 // Load late (after other modules register permissions)

  async connect(ctx: ModuleContext): Promise<void> {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY (wraps roleGranter)
    // ════════════════════════════════════════════════════════════════════════
    const rolesManager = new RolesManager({
      roleGranter: ctx.security?.roleGranter ?? null,
      permissionRegistry: ctx.permissionRegistry ?? null,
    })

    ctx.entity('roles', rolesManager)

    // ════════════════════════════════════════════════════════════════════════
    // PERMISSIONS (registered after entity so we can read adminPermission)
    // ════════════════════════════════════════════════════════════════════════
    const rolesPerm = rolesManager.adminPermission?.replace('security:', '') || 'roles:manage'
    ctx.permissions('security', {
      [rolesPerm]: 'Manage roles (view, create, edit, delete)',
      'users:manage': 'Manage users (view, create, edit, delete)',
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (using ctx.crud helper)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud(
      'roles',
      {
        list: () => import('./pages/RoleList.vue'),
        form: () => import('./pages/RoleForm.vue'),
      },
      {
        basePath: 'security/roles',
        nav: {
          section: 'Security',
          icon: 'pi pi-shield',
          permission: 'security:roles:read',
        },
      }
    )
  }
}

export default SecurityModule
