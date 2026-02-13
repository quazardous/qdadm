import { PermissiveAuthAdapter } from './auth/PermissiveAdapter'
import { AuthActions, type AuthUser } from './auth/EntityAuthAdapter'
import type { EntityAuthAdapter as IEntityAuthAdapter } from './auth/EntityAuthAdapter'
import pluralize from 'pluralize'
import { applyCacheMethods } from './EntityManager.cache'
import { applyQueryMethods } from './EntityManager.query'
import { applyRelationsMethods } from './EntityManager.relations'
import { applyCrudMethods } from './EntityManager.crud'
import type {
  EntityRecord,
  ListParams,
  ListResult,
  IStorage,
  FieldConfig,
  ChildConfig,
  ParentConfig,
  RelationConfig,
  NavConfig,
} from '../types'
import type { SignalBus } from '../kernel/SignalBus'
import type { HookRegistry } from '../hooks/HookRegistry'
import type { QueryObject } from '../query/QueryExecutor'

// Import types from dedicated types file
import type {
  CacheState,
  OperationStats,
  ResolvedStorage,
  StorageResolution,
  Orchestrator,
} from './EntityManager.types'

// Re-export public types from types file
export type {
  RoutingContext,
  PresaveContext,
  PostsaveContext,
  PredeleteContext,
  QueryOptions,
  WhitelistContext,
  CacheInfo,
  EntityBadge,
  SeverityDescriptor,
  SeverityMapValue,
  SeverityMap,
  EntityManagerOptions,
} from './EntityManager.types'

// Import concrete types needed in method signatures
import type {
  RoutingContext,
  PresaveContext,
  PostsaveContext,
  PredeleteContext,
  QueryOptions,
  WhitelistContext,
  CacheInfo,
  EntityBadge,
  SeverityMap,
  SeverityDescriptor,
  EntityManagerOptions,
} from './EntityManager.types'

/**
 * EntityManager - Base class for entity CRUD operations
 *
 * An EntityManager can either:
 * 1. BE its own storage (implement methods directly)
 * 2. DELEGATE to a storage adapter
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class EntityManager<T extends EntityRecord = EntityRecord> {
  readonly name: string
  storage: IStorage<T> | null
  readonly idField: string

  protected _labelField: string | ((entity: T) => string)
  protected _badges: ((entity: T) => EntityBadge[]) | null
  protected _label: string | null
  protected _labelPlural: string | null
  protected _routePrefix: string | null
  protected _fields: Record<string, FieldConfig>

  localFilterThreshold: number | null
  protected _cacheTtlMs: number | null
  protected _readOnly: boolean
  protected _warmup: boolean
  protected _authSensitive: boolean
  protected _system: boolean

  protected _scopeWhitelist: string[] | null
  protected _isOwn: ((record: T, user: AuthUser) => boolean) | null

  protected _children: Record<string, ChildConfig>
  protected _parent: ParentConfig | null
  protected _parents: Record<string, ParentConfig>
  protected _relations: Record<string, RelationConfig>
  protected _orchestrator: Orchestrator | null = null

  protected _authAdapter: IEntityAuthAdapter | null
  protected _nav: NavConfig

  protected _hooks: HookRegistry | null = null
  protected _severityMaps: Record<string, SeverityMap> = {}

  protected _cache: CacheState<T> = {
    items: [],
    total: 0,
    loadedAt: null,
    valid: false,
  }
  protected _cacheLoading: Promise<boolean> | null = null

  protected _signals: SignalBus | null = null
  protected _signalCleanup: (() => void) | null = null

  protected _stats: OperationStats = {
    list: 0,
    get: 0,
    create: 0,
    update: 0,
    delete: 0,
    cacheHits: 0,
    cacheMisses: 0,
    maxItemsSeen: 0,
    maxTotal: 0,
  }

  // Hook for query result customization (can be overridden)
  onQueryResult?: (
    result: ListResult<T>,
    context: WhitelistContext
  ) => ListResult<T> | void

  constructor(options: EntityManagerOptions<T> = {} as EntityManagerOptions<T>) {
    const {
      name,
      storage = null,
      idField = 'id',
      label = null,
      labelPlural = null,
      routePrefix = null,
      labelField = 'name',
      badges = null,
      fields = {},
      localFilterThreshold = null,
      cacheTtlMs = null,
      readOnly = false,
      warmup = true,
      authSensitive,
      system = false,
      scopeWhitelist = null,
      isOwn = null,
      children = {},
      parent = null,
      parents = {},
      relations = {},
      authAdapter = null,
      nav = {},
    } = options

    this.name = name
    this.storage = storage
    this.idField = idField
    this._labelField = labelField
    this._badges = badges

    this._label = label
    this._labelPlural = labelPlural
    this._routePrefix = routePrefix
    this._fields = fields

    this.localFilterThreshold = localFilterThreshold
    this._cacheTtlMs = cacheTtlMs
    this._readOnly = readOnly
    this._warmup = warmup
    this._authSensitive = authSensitive ?? this._getStorageRequiresAuth()
    this._system = system

    this._scopeWhitelist = scopeWhitelist
    this._isOwn = isOwn

    this._children = children
    this._parent = parent
    this._parents = parents
    this._relations = relations

    this._authAdapter = authAdapter
    this._nav = nav
  }

  // ============ SIGNALS ============

  /**
   * Set the SignalBus reference (called by Orchestrator during registration)
   */
  setSignals(signals: SignalBus): void {
    this._signals = signals
    this._setupCacheListeners()
  }

  /**
   * Set the HookRegistry reference (called by Orchestrator during registration)
   */
  setHooks(hooks: HookRegistry): void {
    this._hooks = hooks
  }

  /**
   * Get the HookRegistry reference
   */
  get hooks(): HookRegistry | null {
    return this._hooks
  }

  /**
   * Emit entity signals after CRUD operations
   */
  protected _emitSignal(
    action: 'created' | 'updated' | 'deleted',
    data: Record<string, unknown>
  ): void {
    if (!this._signals) return
    this._signals.emitEntity(this.name, action, data)
  }

  /**
   * Emit entity:data-invalidate signal for client cache invalidation
   */
  protected _emitDataInvalidate(
    action: 'created' | 'updated' | 'deleted',
    id: string | number | undefined
  ): void {
    if (!this._signals) return
    this._signals.emit('entity:data-invalidate', {
      entity: this.name,
      action,
      id,
    })
  }

  // ============ LIFECYCLE HOOKS ============

  /**
   * Invoke a lifecycle hook for this entity
   */
  protected async _invokeHook(
    hookName: string,
    context: Record<string, unknown>
  ): Promise<void> {
    if (!this._hooks) return
    await this._hooks.invoke(`entity:${hookName}`, context)
  }

  /**
   * Build hook context for presave operations
   */
  protected _buildPresaveContext(
    data: Partial<T>,
    isNew: boolean,
    id: string | number | null = null
  ): PresaveContext<T> {
    const context: PresaveContext<T> = {
      entity: this.name,
      record: data,
      isNew,
      manager: this,
    }
    if (!isNew && id !== null) {
      context.id = id
    }
    return context
  }

  /**
   * Build hook context for postsave operations
   */
  protected _buildPostsaveContext(
    data: Partial<T>,
    result: T,
    isNew: boolean,
    id: string | number | null = null
  ): PostsaveContext<T> {
    const context: PostsaveContext<T> = {
      entity: this.name,
      record: data,
      result,
      isNew,
      manager: this,
    }
    if (id !== null) {
      context.id = id
    } else if (result?.[this.idField] !== undefined) {
      context.id = result[this.idField] as string | number
    }
    return context
  }

  /**
   * Build hook context for predelete operations
   */
  protected _buildPredeleteContext(id: string | number): PredeleteContext<T> {
    return {
      entity: this.name,
      id,
      manager: this,
    }
  }

  // ============ STORAGE RESOLUTION ============

  /**
   * Resolve which storage to use for an operation
   */
  resolveStorage(
    _method: string,
    _context?: RoutingContext
  ): StorageResolution<T> {
    return { storage: this.storage }
  }

  /**
   * Normalize resolveStorage() return value to standard format
   */
  protected _normalizeResolveResult(
    result: StorageResolution<T>,
    context?: RoutingContext
  ): ResolvedStorage<T> {
    // Function = dynamic endpoint builder
    if (typeof result === 'function') {
      return {
        storage: this.storage,
        endpoint: result(context),
        isDynamic: true,
      }
    }

    // String = endpoint with primary storage
    if (typeof result === 'string') {
      return { storage: this.storage, endpoint: result }
    }

    // Null/undefined = primary storage
    if (!result) {
      return { storage: this.storage }
    }

    // Object with endpoint function = dynamic endpoint builder
    if (typeof result.endpoint === 'function') {
      return {
        storage: result.storage || this.storage,
        endpoint: result.endpoint(context),
        params: result.params,
        isDynamic: true,
      }
    }

    // Object without storage = use primary storage
    if (!result.storage) {
      return {
        storage: this.storage,
        endpoint: result.endpoint as string | undefined,
        params: result.params,
      }
    }

    return {
      storage: result.storage,
      endpoint: result.endpoint as string | undefined,
      params: result.params,
    }
  }

  // ============ METADATA ACCESSORS ============

  /**
   * Get entity label (singular)
   */
  get label(): string {
    if (this._label) return this._label
    if (!this.name) return 'Item'
    const singular = pluralize.singular(this.name)
    return singular.charAt(0).toUpperCase() + singular.slice(1)
  }

  /**
   * Get entity label (plural)
   */
  get labelPlural(): string {
    if (this._labelPlural) return this._labelPlural
    if (!this.name) return 'Items'
    const plural = pluralize.plural(this.name)
    return plural.charAt(0).toUpperCase() + plural.slice(1)
  }

  /**
   * Get route prefix for this entity
   */
  get routePrefix(): string {
    if (this._routePrefix) return this._routePrefix
    if (!this.name) return 'item'
    return pluralize.singular(this.name)
  }

  /**
   * Get labelField config (string or function)
   */
  get labelField(): string | ((entity: T) => string) {
    return this._labelField
  }

  /**
   * Get display label for an entity
   */
  getEntityLabel(entity: T | null): string | null {
    if (!entity) return null
    if (typeof this._labelField === 'function') {
      return this._labelField(entity)
    }
    return (entity[this._labelField] as string) || null
  }

  /**
   * Get badges for an entity item header
   */
  getEntityBadges(entity: T | null): EntityBadge[] {
    if (!entity || !this._badges) return []
    return this._badges(entity)
  }

  /**
   * Get navigation config for auto-generated menus
   */
  get nav(): NavConfig {
    return this._nav || {}
  }

  // ============ PERMISSIONS ============

  /**
   * Get the auth adapter (lazy-initialized PermissiveAuthAdapter if not set)
   */
  get authAdapter(): IEntityAuthAdapter {
    if (!this._authAdapter) {
      this._authAdapter = new PermissiveAuthAdapter()
    }
    return this._authAdapter
  }

  /**
   * Set the auth adapter
   */
  set authAdapter(adapter: IEntityAuthAdapter | null) {
    this._authAdapter = adapter
  }

  /**
   * Build permission string for an entity action
   */
  protected _getPermissionString(action: string): string {
    return `entity:${this.name}:${action}`
  }

  /**
   * Get the current authenticated user
   */
  protected _getCurrentUser(): AuthUser | null {
    // Try authAdapter.getCurrentUser() first (EntityAuthAdapter subclass)
    if (typeof this.authAdapter?.getCurrentUser === 'function') {
      try {
        return this.authAdapter.getCurrentUser() ?? null
      } catch {
        // Fallback if not implemented
      }
    }
    // Fallback to kernel's authAdapter
    return this._orchestrator?.kernel?.options?.authAdapter?.getUser?.() ?? null
  }

  /**
   * Check if SecurityChecker is configured via authAdapter
   */
  protected _hasSecurityChecker(): boolean {
    return (
      (this.authAdapter as unknown as { _securityChecker?: unknown })
        ?._securityChecker != null
    )
  }

  /**
   * Check if the current user can perform an action, optionally on a specific record
   */
  canAccess(action: string, record: T | null = null): boolean {
    // 1. Check readOnly restriction for write actions
    if (
      this._readOnly &&
      action !== AuthActions.READ &&
      action !== AuthActions.LIST
    ) {
      return false
    }

    // 2. Ownership check: if user owns the record, check entity-own permission
    if (record && this._isOwn && this._hasSecurityChecker()) {
      const user = this._getCurrentUser()
      if (user && this._isOwn(record, user)) {
        // Owner - check entity-own:{entity}:{action} permission
        const ownPerm = `entity-own:${this.name}:${action}`
        if (this.authAdapter.isGranted?.(ownPerm, record)) {
          return true
        }
      }
    }

    // 3. Use isGranted() with entity:name:action format when available
    if (this._hasSecurityChecker()) {
      const perm = this._getPermissionString(action)
      return this.authAdapter.isGranted?.(perm, record) ?? false
    }

    // 4. Legacy fallback: canPerform() + canAccessRecord()
    const canPerformAction = this.authAdapter.canPerform(this.name, action)
    if (!canPerformAction) {
      return false
    }

    // 5. Silo check: if record provided, can user access this specific record?
    if (record !== null) {
      return this.authAdapter.canAccessRecord?.(this.name, record) ?? true
    }

    return true
  }

  /**
   * Check if user can read entities
   */
  canRead(entity: T | null = null): boolean {
    return this.canAccess(AuthActions.READ, entity)
  }

  /**
   * Check if manager is read-only
   */
  get readOnly(): boolean {
    return this._readOnly
  }

  /**
   * Check if entity is system-provided (roles, users)
   */
  get system(): boolean {
    return this._system
  }

  /**
   * Check if user can create new entities
   */
  canCreate(): boolean {
    return this.canAccess(AuthActions.CREATE)
  }

  /**
   * Check if user can update entities
   */
  canUpdate(entity: T | null = null): boolean {
    return this.canAccess(AuthActions.UPDATE, entity)
  }

  /**
   * Check if user can delete entities
   */
  canDelete(entity: T | null = null): boolean {
    return this.canAccess(AuthActions.DELETE, entity)
  }

  /**
   * Check if user can list entities
   */
  canList(): boolean {
    return this.canAccess(AuthActions.LIST)
  }

  /**
   * Get scope whitelist
   */
  get scopeWhitelist(): string[] | null {
    return this._scopeWhitelist
  }

  /**
   * Check if a context is whitelisted (can bypass restrictions)
   */
  isWhitelisted(context: WhitelistContext = {}): boolean {
    // Explicit bypass with reason
    if (context.bypassPermissions && context.reason) {
      return true
    }

    // No whitelist configured = nothing whitelisted
    if (!this._scopeWhitelist || this._scopeWhitelist.length === 0) {
      return false
    }

    // Check if any context property matches the whitelist
    const checkValues = [context.module, context.scope, context.form].filter(
      Boolean
    ) as string[]
    return checkValues.some((val) => this._scopeWhitelist!.includes(val))
  }

  /**
   * Get fields schema
   */
  get fields(): Record<string, FieldConfig> {
    return this._fields
  }

  /**
   * Get a specific field config
   */
  getFieldConfig(fieldName: string): FieldConfig | undefined {
    return this._fields[fieldName]
  }

  /**
   * Get initial data for a new entity based on field defaults
   */
  getInitialData(context: RoutingContext | null = null): Partial<T> {
    const data: Record<string, unknown> = {}
    for (const [fieldName, fieldConfig] of Object.entries(this._fields)) {
      if (fieldConfig.default !== undefined) {
        data[fieldName] =
          typeof fieldConfig.default === 'function'
            ? (fieldConfig.default as (ctx: RoutingContext | null) => unknown)(
                context
              )
            : fieldConfig.default
      } else {
        // Type-based defaults
        switch (fieldConfig.type) {
          case 'boolean':
            data[fieldName] = false
            break
          case 'number':
            data[fieldName] = null
            break
          case 'array':
            data[fieldName] = []
            break
          case 'object':
            data[fieldName] = {}
            break
          default:
            data[fieldName] = ''
        }
      }
    }
    return data as Partial<T>
  }

  /**
   * Apply field defaults to data (for create operations)
   */
  applyDefaults(
    data: Partial<T>,
    context: RoutingContext | null = null
  ): Partial<T> {
    const result = { ...data } as Record<string, unknown>
    for (const [fieldName, fieldConfig] of Object.entries(this._fields)) {
      // Only apply default if field is undefined in data
      if (
        result[fieldName] === undefined &&
        fieldConfig.default !== undefined
      ) {
        result[fieldName] =
          typeof fieldConfig.default === 'function'
            ? (fieldConfig.default as (ctx: RoutingContext | null) => unknown)(
                context
              )
            : fieldConfig.default
      }
    }
    return result as Partial<T>
  }

  /**
   * Get field names that are required
   */
  getRequiredFields(): string[] {
    return Object.entries(this._fields)
      .filter(([, config]) => config.required)
      .map(([name]) => name)
  }

  /**
   * Get fields that should appear in list view
   */
  getListFields(): Array<{ name: string } & FieldConfig> {
    return Object.entries(this._fields)
      .filter(([, config]) => config.listable !== false)
      .map(([name, config]) => ({ name, ...config }))
  }

  /**
   * Get fields that should appear in form view
   */
  getFormFields(): Array<{ name: string } & FieldConfig> {
    return Object.entries(this._fields)
      .filter(([, config]) => config.editable !== false)
      .map(([name, config]) => ({ name, ...config }))
  }

  // ============ REFERENCE OPTIONS ============

  /**
   * Resolve reference options for a field
   */
  async resolveReferenceOptions(
    fieldName: string
  ): Promise<Array<{ label: string; value: unknown }>> {
    const fieldConfig = this._fields[fieldName]
    if (!fieldConfig) {
      console.warn(`[EntityManager:${this.name}] Unknown field '${fieldName}'`)
      return []
    }

    // If field has static options, return them
    if (fieldConfig.options && !fieldConfig.reference) {
      return fieldConfig.options
    }

    // If no reference, return empty
    if (!fieldConfig.reference) {
      return []
    }

    // Need orchestrator to access other managers
    if (!this._orchestrator) {
      console.warn(
        `[EntityManager:${this.name}] No orchestrator, cannot resolve reference for '${fieldName}'`
      )
      return fieldConfig.options || []
    }

    const { entity, labelField, valueField } = fieldConfig.reference
    const refManager = this._orchestrator.get(entity)

    if (!refManager) {
      console.warn(
        `[EntityManager:${this.name}] Referenced entity '${entity}' not found`
      )
      return fieldConfig.options || []
    }

    try {
      // Fetch all items from referenced entity
      const { items } = await refManager.list({ page_size: 1000 })

      // Build options array
      const refLabelField = labelField || refManager.labelField || 'label'
      const refValueField = valueField || refManager.idField || 'id'

      return items.map((item) => ({
        label:
          (item[refLabelField as keyof typeof item] as string) ??
          (item[refValueField as keyof typeof item] as string),
        value: item[refValueField as keyof typeof item],
      }))
    } catch (error) {
      console.error(
        `[EntityManager:${this.name}] Failed to resolve reference for '${fieldName}':`,
        error
      )
      return fieldConfig.options || []
    }
  }

  /**
   * Resolve all reference options for form fields
   */
  async resolveAllReferenceOptions(): Promise<
    Map<string, Array<{ label: string; value: unknown }>>
  > {
    const optionsMap = new Map<string, Array<{ label: string; value: unknown }>>()

    for (const [fieldName, fieldConfig] of Object.entries(this._fields)) {
      if (fieldConfig.reference) {
        const options = await this.resolveReferenceOptions(fieldName)
        optionsMap.set(fieldName, options)
      }
    }

    return optionsMap
  }

  // ============ SEVERITY MAPS ============

  /**
   * Set severity map for a field.
   * Values can be plain severity strings or rich descriptors with icon/label.
   */
  setSeverityMap(field: string, map: SeverityMap): this {
    this._severityMaps[field] = map
    return this
  }

  /**
   * Get severity string for a field value (backward compat).
   * Extracts .severity from descriptors automatically.
   */
  getSeverity(
    field: string,
    value: string | number,
    defaultSeverity: string = 'secondary'
  ): string {
    const entry = this._severityMaps[field]?.[String(value)]
    if (!entry) return defaultSeverity
    return typeof entry === 'string' ? entry : entry.severity
  }

  /**
   * Get full severity descriptor for a field value.
   * Returns normalized descriptor (plain strings wrapped as { severity }).
   */
  getSeverityDescriptor(
    field: string,
    value: string | number,
    defaultSeverity: string = 'secondary'
  ): SeverityDescriptor {
    const entry = this._severityMaps[field]?.[String(value)]
    if (!entry) return { severity: defaultSeverity }
    return typeof entry === 'string' ? { severity: entry } : entry
  }

  /**
   * Check if a severity map exists for a field
   */
  hasSeverityMap(field: string): boolean {
    return field in this._severityMaps
  }

  /**
   * Hook: called when orchestrator is disposed
   */
  onDispose(): void {
    // Override in subclass if needed
  }
}

// ============ INTERFACE MERGING ============
// Declares prototype-patched methods for type safety.

export interface EntityManager<T extends EntityRecord = EntityRecord> {
  // --- Cache getters ---
  readonly effectiveThreshold: number
  readonly effectiveCacheTtlMs: number
  readonly isCacheTtlDisabled: boolean
  readonly storageSupportsTotal: boolean
  readonly storageSearchFields: string[] | undefined
  readonly isCacheEnabled: boolean
  readonly overflow: boolean
  readonly warmupEnabled: boolean

  // --- Cache methods ---
  /** @internal */ _isCacheExpired(): boolean
  /** @internal */ _getStorageRequiresAuth(): boolean
  /** @internal */ _parseSearchFields(overrideSearchFields?: string[] | null): { ownFields: string[]; parentFields: Record<string, string[]> }
  /** @internal */ _resolveSearchFields(items: T[]): Promise<void>
  /** @internal */ _setupCacheListeners(): void
  /** @internal */ _clearSearchCache(): void
  /** @internal */ _loadCacheInBackground(): void
  /** @internal */ _loadCache(): Promise<boolean>
  invalidateCache(): void
  invalidateDataLayer(): void
  ensureCache(): Promise<boolean>
  warmup(): Promise<boolean | null>
  getCacheInfo(): CacheInfo

  // --- Query methods ---
  /** @internal */ _buildQuery(filters: Record<string, unknown>): QueryObject
  /** @internal */ _filterLocally(items: T[], params?: ListParams & { searchFields?: string[] | null }): { items: T[]; total: number }
  query(params?: ListParams, options?: QueryOptions): Promise<ListResult<T>>
  getStats(): OperationStats
  resetStats(): void

  // --- CRUD methods ---
  list(params?: ListParams & { _internal?: boolean }, context?: RoutingContext): Promise<ListResult<T>>
  get(id: string | number, context?: RoutingContext): Promise<T>
  getMany(ids: Array<string | number>, context?: RoutingContext): Promise<T[]>
  create(data: Partial<T>, context?: RoutingContext): Promise<T>
  update(id: string | number, data: Partial<T>, context?: RoutingContext): Promise<T>
  patch(id: string | number, data: Partial<T>, context?: RoutingContext): Promise<T>
  delete(id: string | number, context?: RoutingContext): Promise<void>
  request(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, options?: { data?: unknown; params?: Record<string, unknown>; headers?: Record<string, string>; invalidateCache?: boolean }): Promise<unknown>
  onRegister(orchestrator: Orchestrator): void

  // --- Relations methods ---
  getChildConfig(childName: string): ChildConfig | undefined
  getChildNames(): string[]
  getParentConfig(): ParentConfig | null
  listChildren(parentId: string | number, childName: string, params?: ListParams): Promise<ListResult<EntityRecord>>
  getChild(parentId: string | number, childName: string, childId: string | number): Promise<EntityRecord>
  createChild(parentId: string | number, childName: string, data: Record<string, unknown>): Promise<EntityRecord>
  deleteChild(parentId: string | number, childName: string, childId: string | number): Promise<void>
  getParentManager(): EntityManager<EntityRecord> | null
  getChildManager(childName: string): EntityManager<EntityRecord> | null
}

// ============ APPLY PROTOTYPE PATCHES ============
applyCacheMethods(EntityManager)
applyQueryMethods(EntityManager)
applyRelationsMethods(EntityManager)
applyCrudMethods(EntityManager)

/**
 * Factory function to create an EntityManager
 */
export function createEntityManager<T extends EntityRecord = EntityRecord>(
  options: EntityManagerOptions<T>
): EntityManager<T> {
  return new EntityManager<T>(options)
}
