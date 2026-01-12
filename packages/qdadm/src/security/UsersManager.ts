/**
 * UsersManager - System entity manager for users
 *
 * Provides standard user entity with:
 * - username, password, role fields
 * - role linked to roles entity via reference
 * - Admin-only access by default (customizable)
 *
 * @example
 * // In a module:
 * ctx.userEntity({
 *   storage: new ApiStorage({ endpoint: '/api/users' }),
 *   extraFields: {
 *     email: { type: 'email', label: 'Email' }
 *   }
 * })
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { EntityManager } from '../entity/EntityManager.js'
import type { FieldConfig } from '../types'

/**
 * User entity structure
 */
export interface UserEntity {
  id: string | number
  username: string
  password?: string
  role?: string
  [key: string]: unknown
}

/**
 * Field definitions for users
 */
export type FieldDefinitions = Record<string, FieldConfig>

/**
 * Storage interface for users
 */
export interface UserStorage {
  list(params?: unknown): Promise<{ items: UserEntity[]; total: number }>
  get(id: string | number): Promise<UserEntity | null>
  create(data: Partial<UserEntity>): Promise<UserEntity>
  update(id: string | number, data: Partial<UserEntity>): Promise<UserEntity>
  delete(id: string | number): Promise<void>
}

/**
 * Options for UsersManager
 */
export interface UsersManagerOptions {
  storage: UserStorage
  extraFields?: FieldDefinitions
  adminPermission?: string
  fieldOverrides?: {
    username?: Partial<FieldConfig>
    password?: Partial<FieldConfig>
    role?: Partial<FieldConfig>
  }
  [key: string]: unknown
}

// Type for EntityManager base class
interface EntityManagerInstance {
  _hasSecurityChecker(): boolean
  authAdapter: {
    isGranted(permission: string): boolean
  }
}

export class UsersManager extends EntityManager {
  private _adminPermission: string

  constructor(options: UsersManagerOptions) {
    const {
      storage,
      extraFields = {},
      adminPermission = 'security:users:manage',
      fieldOverrides = {},
      ...rest
    } = options

    if (!storage) {
      throw new Error('[UsersManager] storage is required')
    }

    // Default fields for users
    const defaultFields: FieldDefinitions = {
      username: {
        type: 'text',
        label: 'Username',
        required: true,
        default: '',
        ...fieldOverrides.username,
      },
      password: {
        type: 'password',
        label: 'Password',
        required: true,
        default: '',
        listable: false, // Don't show in list view
        ...fieldOverrides.password,
      },
      role: {
        type: 'select',
        label: 'Role',
        reference: { entity: 'roles' }, // Links to roles entity
        default: 'ROLE_USER',
        ...fieldOverrides.role,
      },
    }

    super({
      name: 'users',
      labelField: 'username',
      system: true, // System-provided entity
      fields: {
        ...defaultFields,
        ...extraFields,
      },
      storage,
      ...rest,
    })

    this._adminPermission = adminPermission
  }

  /**
   * Get admin permission (for external registration)
   */
  get adminPermission(): string {
    return this._adminPermission
  }

  private _isAdmin(): boolean {
    const self = this as unknown as EntityManagerInstance
    if (self._hasSecurityChecker()) {
      return self.authAdapter.isGranted(this._adminPermission)
    }
    return false
  }

  canRead(): boolean {
    return this._isAdmin()
  }

  canCreate(): boolean {
    // little dumb but should work for simple storages
    return this._isAdmin()
  }

  canUpdate(): boolean {
    // little dumb but should work for simple storages
    return this._isAdmin()
  }

  canDelete(): boolean {
    // little dumb but should work for simple storages
    return this._isAdmin()
  }
}
