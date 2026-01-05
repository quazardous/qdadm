/**
 * Security module - Permission and role management
 *
 * Provides:
 * - PermissionMatcher: Wildcard pattern matching (*, **)
 * - PermissionRegistry: Central registry for module permissions
 * - RoleGranterAdapter: Interface for role → permissions mapping
 * - StaticRoleGranterAdapter: Config-based role granter (default)
 * - EntityRoleGranterAdapter: Entity-based role granter (for UI management)
 * - PersistableRoleGranterAdapter: Load/persist from any source (localStorage, API)
 * - SecurityModule: System module for roles UI (uses RolesManager)
 * - RolesManager: System entity manager for roles
 * - UsersManager: System entity manager for users (linked to roles)
 *
 * @example
 * import {
 *   PermissionMatcher,
 *   PermissionRegistry,
 *   StaticRoleGranterAdapter,
 *   EntityRoleGranterAdapter,
 *   PersistableRoleGranterAdapter,
 *   createLocalStorageRoleGranter,
 *   UsersManager
 * } from 'qdadm/security'
 */

export { PermissionMatcher } from './PermissionMatcher.js'
export { PermissionRegistry } from './PermissionRegistry.js'
export { RoleGranterAdapter } from './RoleGranterAdapter.js'
export { StaticRoleGranterAdapter } from './StaticRoleGranterAdapter.js'
export { EntityRoleGranterAdapter } from './EntityRoleGranterAdapter.js'
export {
  PersistableRoleGranterAdapter,
  createLocalStorageRoleGranter
} from './PersistableRoleGranterAdapter.js'
export { SecurityModule } from './SecurityModule.js'
export { RolesManager } from './RolesManager.js'
export { UsersManager } from './UsersManager.js'
export { RoleGranterStorage } from './RoleGranterStorage.js'

/**
 * Standard entity actions for CRUD operations
 * Used by PermissionRegistry.registerEntity()
 */
export const ENTITY_ACTIONS = ['read', 'list', 'create', 'update', 'delete']
