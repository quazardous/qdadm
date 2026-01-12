import { RoleProvider } from './RolesProvider'
import type {
  RoleMeta,
  RoleData,
  RoleHierarchyMap,
  RoleProviderContext,
} from './RolesProvider'

/**
 * Options for EntityRoleProvider
 */
export interface EntityRoleGranterOptions {
  entityName?: string
  nameField?: string
  labelField?: string
  permissionsField?: string
  inheritsField?: string
}

/**
 * Role entity structure
 */
interface RoleEntity {
  id?: string | number
  [key: string]: unknown
}

/**
 * Entity manager interface (minimal for adapter needs)
 */
interface EntityManager {
  list(params?: Record<string, unknown>): Promise<{ items: RoleEntity[]; data?: RoleEntity[] }>
  create(data: Record<string, unknown>): Promise<RoleEntity>
  update(id: string | number, data: Record<string, unknown>): Promise<RoleEntity>
  delete(id: string | number): Promise<void>
}

/**
 * Orchestrator interface (minimal for adapter needs)
 */
interface Orchestrator {
  get(name: string): EntityManager | undefined
}

/**
 * Cache structure for roles
 */
interface RoleCache {
  permissions: Record<string, string[]>
  hierarchy: Record<string, string[]>
  labels: Record<string, string>
}

/**
 * EntityRoleProvider - Role granter backed by an entity
 *
 * Fetches roles and permissions from a 'roles' entity.
 * Auto-invalidates cache on entity:roles:* signals.
 * Use this for apps with a role management UI.
 *
 * Expected entity schema:
 * {
 *   id: 'role-1',
 *   name: 'ROLE_ADMIN',
 *   label: 'Administrator',
 *   permissions: ['entity:**', 'admin:**'],
 *   inherits: ['ROLE_USER']
 * }
 *
 * @example
 * // Configure Kernel with entity-based roles
 * const kernel = new Kernel({
 *   modules: [SecurityModule, ...],
 *   security: {
 *     rolesProvider: new EntityRoleProvider({
 *       entityName: 'roles',
 *       nameField: 'name',
 *       permissionsField: 'permissions',
 *       inheritsField: 'inherits'
 *     })
 *   }
 * })
 *
 * // Load roles before boot
 * await kernel.options.security.rolesProvider.load()
 * await kernel.boot()
 */
export class EntityRoleProvider extends RoleProvider {
  private _entityName: string
  private _nameField: string
  private _labelField: string
  private _permissionsField: string
  private _inheritsField: string

  private _cache: RoleCache | null = null
  private _ctx: RoleProviderContext | null = null
  private _orchestrator: Orchestrator | null = null
  private _signalCleanup: (() => void) | null = null
  private _loading: Promise<void> | null = null

  constructor(options: EntityRoleGranterOptions = {}) {
    super()
    this._entityName = options.entityName || 'roles'
    this._nameField = options.nameField || 'name'
    this._labelField = options.labelField || 'label'
    this._permissionsField = options.permissionsField || 'permissions'
    this._inheritsField = options.inheritsField || 'inherits'
  }

  /**
   * Install adapter (called by Kernel after orchestrator ready)
   */
  install(ctx: RoleProviderContext): void {
    this._ctx = ctx
    this._orchestrator = ctx.orchestrator as Orchestrator

    // Auto-invalidate on role changes
    if (ctx.signals) {
      this._signalCleanup = ctx.signals.on(`entity:${this._entityName}:**`, () => {
        this.invalidate()
      })
    }
  }

  /**
   * Uninstall adapter (cleanup)
   */
  uninstall(): void {
    if (this._signalCleanup) {
      this._signalCleanup()
      this._signalCleanup = null
    }
    this._ctx = null
    this._orchestrator = null
    this._cache = null
    this._loading = null
  }

  /**
   * Load roles from entity (async, must be called before use)
   */
  async load(): Promise<void> {
    // Prevent concurrent loads
    if (this._loading) {
      return this._loading
    }

    this._loading = this._doLoad()
    await this._loading
    this._loading = null
  }

  /**
   * Internal load implementation
   */
  private async _doLoad(): Promise<void> {
    const manager = this._orchestrator?.get(this._entityName)
    if (!manager) {
      console.warn(`[EntityRoleGranter] Entity '${this._entityName}' not found`)
      this._cache = { permissions: {}, hierarchy: {}, labels: {} }
      return
    }

    try {
      const { items: roles } = await manager.list({ page_size: 1000 })

      // Build cache
      const permissions: Record<string, string[]> = {}
      const hierarchy: Record<string, string[]> = {}
      const labels: Record<string, string> = {}

      for (const role of roles) {
        const name = role[this._nameField] as string
        if (!name) continue

        permissions[name] = (role[this._permissionsField] as string[]) || []
        labels[name] = (role[this._labelField] as string) || name

        const inherits = role[this._inheritsField] as string[] | undefined
        if (inherits && inherits.length > 0) {
          hierarchy[name] = inherits
        }
      }

      this._cache = { permissions, hierarchy, labels }
    } catch (error) {
      console.error(`[EntityRoleGranter] Failed to load roles:`, error)
      this._cache = { permissions: {}, hierarchy: {}, labels: {} }
    }
  }

  /**
   * Get cache, throwing if not loaded
   */
  private _getCache(): RoleCache {
    if (!this._cache) {
      throw new Error(
        '[EntityRoleGranter] Roles not loaded. Call load() before using the adapter.'
      )
    }
    return this._cache
  }

  /**
   * Get permissions for a role
   */
  getPermissions(role: string): string[] {
    const cache = this._getCache()
    return cache.permissions[role] || []
  }

  /**
   * Get all defined roles
   */
  getRoles(): string[] {
    const cache = this._getCache()
    return Object.keys(cache.permissions)
  }

  /**
   * Get role hierarchy
   */
  getHierarchy(): RoleHierarchyMap {
    const cache = this._getCache()
    return cache.hierarchy
  }

  /**
   * Get role metadata
   */
  getRoleMeta(role: string): RoleMeta | null {
    const cache = this._getCache()
    const label = cache.labels[role]
    if (!label) return null
    return { label }
  }

  /**
   * Invalidate cache (triggers reload on next access)
   * Call this after role changes
   */
  invalidate(): void {
    this._cache = null
  }

  /**
   * Check if cache is loaded
   */
  get isLoaded(): boolean {
    return this._cache !== null
  }

  /**
   * Entity-backed adapter can always persist (via entity manager)
   */
  get canPersist(): boolean {
    return true
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Role query methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a role exists
   */
  roleExists(role: string): boolean {
    const cache = this._getCache()
    return cache.permissions[role] !== undefined
  }

  /**
   * Get complete role object
   */
  getRole(role: string): RoleData | null {
    const cache = this._getCache()
    if (cache.permissions[role] === undefined) {
      return null
    }
    return {
      name: role,
      label: cache.labels[role] || role,
      permissions: cache.permissions[role] || [],
      inherits: cache.hierarchy[role] || [],
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutation methods (via entity manager)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the entity manager for roles
   */
  private _getManager(): EntityManager {
    const manager = this._orchestrator?.get(this._entityName)
    if (!manager) {
      throw new Error(`Entity '${this._entityName}' not found`)
    }
    return manager
  }

  /**
   * Create a new role
   */
  async createRole(
    name: string,
    { label, permissions = [], inherits = [] }: { label?: string; permissions?: string[]; inherits?: string[] } = {}
  ): Promise<RoleEntity> {
    if (this.roleExists(name)) {
      throw new Error(`Role '${name}' already exists`)
    }
    const manager = this._getManager()
    const data = {
      [this._nameField]: name,
      [this._labelField]: label || name,
      [this._permissionsField]: permissions,
      [this._inheritsField]: inherits,
    }
    const result = await manager.create(data)
    this.invalidate()
    return result
  }

  /**
   * Update an existing role
   */
  async updateRole(
    name: string,
    { label, permissions, inherits }: { label?: string; permissions?: string[]; inherits?: string[] } = {}
  ): Promise<RoleEntity> {
    // Ensure loaded first
    this._getCache()
    const manager = this._getManager()

    // Find the role entity by name
    const response = await manager.list({
      filter: { [this._nameField]: name },
      limit: 1,
    })
    const roles = response.data || response.items
    if (roles.length === 0) {
      throw new Error(`Role '${name}' does not exist`)
    }

    const roleEntity = roles[0]
    if (!roleEntity) {
      throw new Error(`Role '${name}' does not exist`)
    }
    const updates: Record<string, unknown> = {}
    if (label !== undefined) updates[this._labelField] = label
    if (permissions !== undefined) updates[this._permissionsField] = permissions
    if (inherits !== undefined) updates[this._inheritsField] = inherits

    const result = await manager.update(roleEntity.id as string | number, updates)
    this.invalidate()
    return result
  }

  /**
   * Delete a role
   */
  async deleteRole(name: string): Promise<void> {
    // Ensure loaded first
    this._getCache()
    const manager = this._getManager()

    // Find the role entity by name
    const response = await manager.list({
      filter: { [this._nameField]: name },
      limit: 1,
    })
    const roles = response.data || response.items
    if (roles.length === 0) {
      throw new Error(`Role '${name}' does not exist`)
    }

    const roleToDelete = roles[0]
    if (!roleToDelete) {
      throw new Error(`Role '${name}' does not exist`)
    }
    await manager.delete(roleToDelete.id as string | number)
    this.invalidate()
  }
}
