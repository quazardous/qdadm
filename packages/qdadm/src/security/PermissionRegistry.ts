/**
 * Permission definition stored in the registry
 */
export interface PermissionDefinition {
  key: string
  namespace: string
  action: string
  module: string | null
  label: string
  description: string | null
  custom: boolean
}

/**
 * Permission metadata for registration
 */
export interface PermissionMeta {
  label?: string
  description?: string
  custom?: boolean
}

/**
 * Options for registering permissions
 */
export interface RegisterOptions {
  isEntity?: boolean
  module?: string
}

/**
 * Options for registering entity permissions
 */
export interface RegisterEntityOptions {
  module?: string
  actions?: string[]
  hasOwnership?: boolean
  ownActions?: string[]
}

/**
 * Grouped permissions by namespace
 */
export type GroupedPermissions = Record<string, PermissionDefinition[]>

/**
 * PermissionRegistry - Central registry for all permissions
 *
 * Collects permissions declared by modules via ctx.permissions().
 * Provides discovery methods for building role management UIs.
 *
 * Permission format: namespace:target:action
 * - entity:books:read     - Entity CRUD
 * - auth:impersonate      - System feature
 * - admin:config:edit     - Admin feature
 *
 * @example
 * const registry = new PermissionRegistry()
 *
 * // Module registers permissions
 * registry.register('books', { read: 'View books' }, { isEntity: true })
 * // → entity:books:read
 *
 * registry.register('auth', { impersonate: 'Impersonate users' })
 * // → auth:impersonate
 *
 * // Query permissions
 * registry.getAll()           // All permissions
 * registry.getGrouped()       // Grouped by namespace
 * registry.exists('auth:impersonate')  // true
 */
export class PermissionRegistry {
  private _permissions: Map<string, PermissionDefinition>

  constructor() {
    this._permissions = new Map()
  }

  /**
   * Register permissions for a namespace
   *
   * @param prefix - Namespace prefix (e.g., 'books', 'auth', 'admin:config')
   * @param permissions - Permission definitions
   * @param options - Registration options
   *
   * @example
   * // Entity permissions (auto-prefixed with 'entity:')
   * registry.register('books', {
   *   read: 'View books',
   *   checkout: { label: 'Checkout', description: 'Borrow books' }
   * }, { isEntity: true })
   * // → entity:books:read, entity:books:checkout
   *
   * // System permissions
   * registry.register('auth', {
   *   impersonate: 'Impersonate users'
   * })
   * // → auth:impersonate
   */
  register(
    prefix: string,
    permissions: Record<string, string | PermissionMeta>,
    options: RegisterOptions = {}
  ): void {
    const namespace = options.isEntity ? `entity:${prefix}` : prefix
    const module = options.module || null

    for (const [action, meta] of Object.entries(permissions)) {
      const key = `${namespace}:${action}`
      const definition: Partial<PermissionMeta> = typeof meta === 'string' ? { label: meta } : { ...meta }

      this._permissions.set(key, {
        key,
        namespace,
        action,
        module,
        label: definition.label || action,
        description: definition.description || null,
        custom: definition.custom || false,
      })
    }
  }

  /**
   * Register standard CRUD permissions for an entity
   * Called automatically by ctx.entity()
   *
   * @param entityName - Entity name
   * @param options - Registration options
   */
  registerEntity(entityName: string, options: RegisterEntityOptions = {}): void {
    const actions = options.actions || ['read', 'list', 'create', 'update', 'delete']
    const permissions: Record<string, PermissionMeta> = {}

    for (const action of actions) {
      permissions[action] = {
        label: `${this._capitalize(action)} ${entityName}`,
        description: `Can ${action} ${entityName} records`,
      }
    }

    this.register(entityName, permissions, {
      isEntity: true,
      module: options.module,
    })

    // Register entity-own:* permissions for ownership-based access
    if (options.hasOwnership) {
      const ownActions = options.ownActions ?? actions.filter((a) => a !== 'list' && a !== 'create')
      const ownPermissions: Record<string, PermissionMeta> = {}

      for (const action of ownActions) {
        ownPermissions[action] = {
          label: `${this._capitalize(action)} own ${entityName}`,
          description: `Can ${action} own ${entityName} records`,
        }
      }

      // Register under entity-own:entityName namespace
      this.register(`entity-own:${entityName}`, ownPermissions, {
        module: options.module,
      })
    }
  }

  /**
   * Unregister all permissions for a namespace
   */
  unregister(namespace: string): void {
    for (const key of this._permissions.keys()) {
      if (key.startsWith(namespace + ':')) {
        this._permissions.delete(key)
      }
    }
  }

  /**
   * Get all registered permissions
   */
  getAll(): PermissionDefinition[] {
    return [...this._permissions.values()]
  }

  /**
   * Get all permission keys
   */
  getKeys(): string[] {
    return [...this._permissions.keys()]
  }

  /**
   * Get permissions grouped by namespace
   *
   * @example
   * registry.getGrouped()
   * // {
   * //   'entity:books': [{ key: 'entity:books:read', ... }],
   * //   'auth': [{ key: 'auth:impersonate', ... }]
   * // }
   */
  getGrouped(): GroupedPermissions {
    const groups: GroupedPermissions = {}

    for (const perm of this._permissions.values()) {
      const existing = groups[perm.namespace]
      if (existing) {
        existing.push(perm)
      } else {
        groups[perm.namespace] = [perm]
      }
    }

    return groups
  }

  /**
   * Get permissions for a specific namespace
   */
  getByNamespace(namespace: string): PermissionDefinition[] {
    return this.getAll().filter(
      (p) => p.namespace === namespace || p.namespace.startsWith(namespace + ':')
    )
  }

  /**
   * Get permissions registered by a specific module
   */
  getByModule(moduleName: string): PermissionDefinition[] {
    return this.getAll().filter((p) => p.module === moduleName)
  }

  /**
   * Get entity permissions only
   */
  getEntityPermissions(): PermissionDefinition[] {
    return this.getAll().filter((p) => p.namespace.startsWith('entity:'))
  }

  /**
   * Get non-entity permissions (system, feature, admin, etc.)
   */
  getSystemPermissions(): PermissionDefinition[] {
    return this.getAll().filter((p) => !p.namespace.startsWith('entity:'))
  }

  /**
   * Check if a permission is registered
   */
  exists(permission: string): boolean {
    return this._permissions.has(permission)
  }

  /**
   * Get a specific permission definition
   */
  get(permission: string): PermissionDefinition | undefined {
    return this._permissions.get(permission)
  }

  /**
   * Get count of registered permissions
   */
  get size(): number {
    return this._permissions.size
  }

  /**
   * Capitalize first letter
   */
  private _capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
