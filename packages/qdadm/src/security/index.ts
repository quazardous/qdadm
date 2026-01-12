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

export { PermissionMatcher } from './PermissionMatcher'
export {
  PermissionRegistry,
  type PermissionDefinition,
  type PermissionMeta,
  type RegisterOptions,
  type RegisterEntityOptions,
  type GroupedPermissions,
} from './PermissionRegistry'
export {
  RoleGranterAdapter,
  type RoleMeta,
  type RoleData,
  type RoleHierarchyMap,
  type RolePermissionsMap,
  type RoleLabelsMap,
  type RoleGranterContext,
} from './RoleGranterAdapter'
export {
  StaticRoleGranterAdapter,
  type StaticRoleGranterConfig,
} from './StaticRoleGranterAdapter'
export {
  EntityRoleGranterAdapter,
  type EntityRoleGranterOptions,
} from './EntityRoleGranterAdapter'
export {
  PersistableRoleGranterAdapter,
  createLocalStorageRoleGranter,
  type RoleConfig,
  type MergeStrategy,
  type LoadCallback,
  type PersistCallback,
  type PersistableRoleGranterOptions,
  type LocalStorageRoleGranterOptions,
} from './PersistableRoleGranterAdapter'
export { SecurityModule } from './SecurityModule'
export { RolesManager, type RolesManagerOptions } from './RolesManager'
export { UsersManager, type UsersManagerOptions, type UserEntity } from './UsersManager'
export {
  RoleGranterStorage,
  type RoleListParams,
  type RoleListResult,
  type RoleInput,
} from './RoleGranterStorage'

/**
 * Standard entity actions for CRUD operations
 * Used by PermissionRegistry.registerEntity()
 */
export const ENTITY_ACTIONS = ['read', 'list', 'create', 'update', 'delete'] as const
