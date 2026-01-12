/**
 * Security module - Permission and role management
 *
 * Provides:
 * - PermissionMatcher: Wildcard pattern matching (*, **)
 * - PermissionRegistry: Central registry for module permissions
 * - RoleProvider: Interface for role → permissions mapping
 * - StaticRoleProvider: Config-based roles provider (default)
 * - EntityRoleProvider: Entity-based roles provider (for UI management)
 * - PersistableRoleProvider: Load/persist from any source (localStorage, API)
 * - SecurityModule: System module for roles UI (uses RolesManager)
 * - RolesManager: System entity manager for roles
 * - UsersManager: System entity manager for users (linked to roles)
 *
 * @example
 * import {
 *   PermissionMatcher,
 *   PermissionRegistry,
 *   StaticRoleProvider,
 *   EntityRoleProvider,
 *   PersistableRoleProvider,
 *   createLocalStorageRolesProvider,
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
  RoleProvider,
  type RoleMeta,
  type RoleData,
  type RoleHierarchyMap,
  type RolePermissionsMap,
  type RoleLabelsMap,
  type RoleProviderContext,
} from './RolesProvider'
export {
  StaticRoleProvider,
  type StaticRolesProviderConfig,
} from './StaticRolesProvider'
export {
  EntityRoleProvider,
  type EntityRolesProviderOptions,
} from './EntityRolesProvider'
export {
  PersistableRoleProvider,
  createLocalStorageRolesProvider,
  type RoleConfig,
  type MergeStrategy,
  type LoadCallback,
  type PersistCallback,
  type PersistableRolesProviderOptions,
  type LocalStorageRolesProviderOptions,
} from './PersistableRolesProvider'
export { SecurityModule } from './SecurityModule'
export { RolesManager, type RolesManagerOptions } from './RolesManager'
export { UsersManager, type UsersManagerOptions, type UserEntity } from './UsersManager'
export {
  RoleProviderStorage,
  type RoleListParams,
  type RoleListResult,
  type RoleInput,
} from './RolesProviderStorage'

/**
 * Standard entity actions for CRUD operations
 * Used by PermissionRegistry.registerEntity()
 */
export const ENTITY_ACTIONS = ['read', 'list', 'create', 'update', 'delete'] as const
