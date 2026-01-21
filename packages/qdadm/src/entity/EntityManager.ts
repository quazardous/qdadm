import { PermissiveAuthAdapter } from './auth/PermissiveAdapter'
import { AuthActions, type AuthUser } from './auth/EntityAuthAdapter'
import type { EntityAuthAdapter as IEntityAuthAdapter } from './auth/EntityAuthAdapter'
import { QueryExecutor, type QueryObject } from '../query/QueryExecutor'
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pluralize from 'pluralize'
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
  StorageCapabilities,
} from '../types'
import type { SignalBus } from '../kernel/SignalBus'
import type { HookRegistry } from '../hooks/HookRegistry'

// ============ INTERNAL TYPES ============

/**
 * Cache state for local filtering
 */
interface CacheState<T> {
  items: T[]
  total: number
  loadedAt: number | null
  valid: boolean
}

/**
 * Operation stats for debugging
 */
interface OperationStats {
  list: number
  get: number
  create: number
  update: number
  delete: number
  cacheHits: number
  cacheMisses: number
  maxItemsSeen: number
  maxTotal: number
}

/**
 * Resolved storage result
 */
interface ResolvedStorage<T extends EntityRecord> {
  storage: IStorage<T> | null | undefined
  endpoint?: string
  params?: Record<string, unknown>
  isDynamic?: boolean
}

/**
 * Storage resolution result (what resolveStorage returns)
 */
type StorageResolution<T extends EntityRecord> =
  | string
  | ((context: RoutingContext | undefined) => string)
  | {
      storage?: IStorage<T> | null
      endpoint?: string | ((context: RoutingContext | undefined) => string)
      params?: Record<string, unknown>
    }
  | null
  | undefined

/**
 * Routing context for multi-storage patterns
 */
export interface RoutingContext {
  parentChain?: Array<{ entity: string; id: string | number }>
  [key: string]: unknown
}

/**
 * Presave hook context
 */
export interface PresaveContext<T extends EntityRecord = EntityRecord> {
  entity: string
  record: Partial<T>
  isNew: boolean
  id?: string | number
  manager: EntityManager<T>
}

/**
 * Postsave hook context
 */
export interface PostsaveContext<T extends EntityRecord = EntityRecord> {
  entity: string
  record: Partial<T>
  result: T
  isNew: boolean
  id?: string | number
  manager: EntityManager<T>
}

/**
 * Predelete hook context
 */
export interface PredeleteContext<T extends EntityRecord = EntityRecord> {
  entity: string
  id: string | number
  manager: EntityManager<T>
}

/**
 * Query options
 */
export interface QueryOptions {
  context?: WhitelistContext
  routingContext?: RoutingContext | null
}

/**
 * Whitelist check context
 */
export interface WhitelistContext {
  module?: string
  scope?: string
  form?: string
  field?: string
  bypassPermissions?: boolean
  reason?: string
}

/**
 * Cache info for debugging
 */
export interface CacheInfo {
  enabled: boolean
  storageSupportsTotal: boolean
  threshold: number
  valid: boolean
  overflow: boolean
  itemCount: number
  total: number
  loadedAt: number | null
  /** Effective TTL in milliseconds (0 = no TTL) */
  ttlMs: number
  /** Timestamp when cache expires (null if no TTL) */
  expiresAt: number | null
  /** Whether the cache has expired based on TTL */
  expired: boolean
}

/**
 * EntityManager constructor options
 */
export interface EntityManagerOptions<T extends EntityRecord = EntityRecord> {
  name: string
  storage?: IStorage<T> | null
  idField?: string
  label?: string
  labelPlural?: string
  routePrefix?: string
  labelField?: string | ((entity: T) => string)
  fields?: Record<string, FieldConfig>
  localFilterThreshold?: number | null
  /** Cache TTL in milliseconds (0=disabled, -1=infinite, >0=TTL). Overrides global, overridden by storage. */
  cacheTtlMs?: number | null
  readOnly?: boolean
  warmup?: boolean
  authSensitive?: boolean
  system?: boolean
  scopeWhitelist?: string[] | null
  isOwn?: ((record: T, user: AuthUser) => boolean) | null
  children?: Record<string, ChildConfig>
  parent?: ParentConfig | null
  parents?: Record<string, ParentConfig>
  relations?: Record<string, RelationConfig>
  authAdapter?: IEntityAuthAdapter | null
  nav?: NavConfig
}

// Forward declaration for Orchestrator (to avoid circular deps)
interface Orchestrator {
  get<T extends EntityRecord>(name: string): EntityManager<T> | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kernel?: any
  deferred?: DeferredRegistry | null
}

// Forward declaration for DeferredRegistry
interface DeferredRegistry {
  has(key: string): boolean
  await(key: string): Promise<unknown>
  queue<T>(key: string, fn: () => Promise<T>): Promise<T>
}

/**
 * EntityManager - Base class for entity CRUD operations
 *
 * An EntityManager can either:
 * 1. BE its own storage (implement methods directly)
 * 2. DELEGATE to a storage adapter
 */
export class EntityManager<T extends EntityRecord = EntityRecord> {
  readonly name: string
  storage: IStorage<T> | null
  readonly idField: string

  protected _labelField: string | ((entity: T) => string)
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
  protected _severityMaps: Record<string, Record<string, string>> = {}

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
   * Set severity map for a field
   */
  setSeverityMap(field: string, map: Record<string, string>): this {
    this._severityMaps[field] = map
    return this
  }

  /**
   * Get severity for a field value
   */
  getSeverity(
    field: string,
    value: string | number,
    defaultSeverity: string = 'secondary'
  ): string {
    const map = this._severityMaps[field]
    if (!map) return defaultSeverity
    return map[String(value)] ?? defaultSeverity
  }

  /**
   * Check if a severity map exists for a field
   */
  hasSeverityMap(field: string): boolean {
    return field in this._severityMaps
  }

  // ============ CRUD OPERATIONS ============

  /**
   * API Response Contract for Caching
   * ==================================
   *
   * The storage/API must return responses in this format:
   *
   *   {
   *     items: T[],     // Items for current page/request
   *     total: number   // TOTAL count of ALL items matching the query (not just this page)
   *   }
   *
   * Why `total` is critical:
   * ------------------------
   * The `total` field enables the smart caching mechanism:
   *
   * 1. Cache eligibility: if `total <= localFilterThreshold`, EntityManager will cache all items
   * 2. Cache validation: `items.length >= total` confirms we received the complete dataset
   * 3. Background loading: if `items.length < total` but `total <= threshold`, loads all items in background
   *
   * Once cached, all filtering/sorting/pagination happens locally via QueryExecutor (MongoDB-like syntax).
   * This dramatically reduces API calls for small datasets.
   *
   * Common pitfalls:
   * ----------------
   * - `total` missing or 0: falls back to `items.length`, may create incomplete cache
   * - `total` incorrect (e.g., always returns page size): cache thinks it's complete when it's not
   * - `total` always equals real total (ignoring filters): cache works but may overflow threshold
   *
   * Example:
   * --------
   * // Good: API returns correct total
   * GET /api/users?page=1&page_size=20
   * → { items: [...20 users...], total: 45 }  // 45 users exist, got first 20
   *
   * // EntityManager sees: total(45) <= threshold(100), items(20) < total(45)
   * // → Triggers background load of all 45 users for cache
   */

  /**
   * List entities with pagination/filtering
   */
  async list(
    params: ListParams & { _internal?: boolean } = {},
    context?: RoutingContext
  ): Promise<ListResult<T>> {
    const resolved = this._normalizeResolveResult(
      this.resolveStorage('list', context),
      context
    )
    const { storage, endpoint, params: resolvedParams } = resolved
    if (!storage) {
      throw new Error(`[EntityManager:${this.name}] list() not implemented`)
    }

    // Extract internal flag and cacheSafe flag
    const { _internal = false, cacheSafe = false, ...queryParams } = params

    // Merge resolved params (defaults) with query params (overrides)
    const mergedParams = resolvedParams
      ? { ...resolvedParams, ...queryParams }
      : queryParams

    // Only count stats for non-internal operations
    if (!_internal) {
      this._stats.list++
    }

    const hasFilters =
      mergedParams.search ||
      Object.keys(mergedParams.filters || {}).length > 0
    const canUseCache = !hasFilters || cacheSafe

    // Check TTL expiration before using cache
    if (this._isCacheExpired()) {
      this.invalidateCache()
    }

    // 1. Cache valid + cacheable -> use cache with local filtering
    if (this._cache.valid && canUseCache) {
      if (!_internal) this._stats.cacheHits++
      console.log('[cache] Using local cache for entity:', this.name)
      const filtered = this._filterLocally(this._cache.items, mergedParams)
      // Update max stats
      if (filtered.items.length > this._stats.maxItemsSeen) {
        this._stats.maxItemsSeen = filtered.items.length
      }
      if (filtered.total > this._stats.maxTotal) {
        this._stats.maxTotal = filtered.total
      }
      return { ...filtered, fromCache: true }
    }

    if (!_internal) this._stats.cacheMisses++

    // 2. Fetch from API
    let response: { items?: T[]; data?: T[] | { items?: T[]; data?: T[] }; total?: number; pagination?: { total?: number } }
    if (endpoint && storage.request) {
      // Use request() with endpoint for multi-storage routing
      const apiResponse = (await storage.request('GET', endpoint, {
        params: mergedParams,
        context,
      })) as { data?: unknown }
      // Normalize response
      const data = apiResponse.data ?? apiResponse
      const dataObj = data as {
        items?: T[]
        data?: T[]
        total?: number
        pagination?: { total?: number }
      }
      response = {
        items: Array.isArray(data)
          ? (data as T[])
          : dataObj.items || dataObj.data || [],
        total:
          dataObj.total ??
          dataObj.pagination?.total ??
          (Array.isArray(data) ? (data as T[]).length : 0),
      }
    } else {
      // Standard storage.list() (normalizes response to { items, total })
      response = await storage.list(mergedParams, context)
    }
    const items = response.items || []
    const total = response.total ?? items.length

    // Update max stats
    if (items.length > this._stats.maxItemsSeen) {
      this._stats.maxItemsSeen = items.length
    }
    if (total > this._stats.maxTotal) {
      this._stats.maxTotal = total
    }

    // 3. Fill cache opportunistically
    if (canUseCache && this.isCacheEnabled && total <= this.effectiveThreshold) {
      // Only cache if we received ALL items (not a partial page)
      if (items.length >= total) {
        this._cache.items = items
        this._cache.total = total
        this._cache.valid = true
        this._cache.loadedAt = Date.now()
        // Resolve parent fields for search (book.title, user.username, etc.)
        await this._resolveSearchFields(items)
      }
      // If we got partial results but total fits threshold, load all items for cache
      else if (!this._cacheLoading) {
        // Fire-and-forget: load full cache in background
        this._loadCacheInBackground()
      }
    }

    return { items, total, fromCache: false }
  }

  /**
   * Get a single entity by ID
   */
  async get(id: string | number, context?: RoutingContext): Promise<T> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('get', context),
      context
    )
    this._stats.get++

    // Check TTL expiration before using cache
    if (this._isCacheExpired()) {
      this.invalidateCache()
    }

    // Try cache first if valid and complete
    if (this._cache.valid && !this.overflow) {
      const idStr = String(id)
      const cached = this._cache.items.find(
        (item) => String(item[this.idField]) === idStr
      )
      if (cached) {
        this._stats.cacheHits++
        return { ...cached } as T // Return copy to avoid mutation
      }
    }

    // Fallback to storage
    this._stats.cacheMisses++
    if (storage) {
      // Use request() with endpoint for multi-storage routing, otherwise use get()
      if (endpoint && storage.request) {
        const response = (await storage.request('GET', `${endpoint}/${id}`, {
          context,
        })) as { data?: T }
        return (response.data ?? response) as T
      }
      const result = await storage.get(id, context)
      if (!result) {
        throw new Error(
          `[EntityManager:${this.name}] Entity not found: ${id}`
        )
      }
      return result
    }
    throw new Error(`[EntityManager:${this.name}] get() not implemented`)
  }

  /**
   * Get multiple entities by IDs (batch fetch)
   */
  async getMany(
    ids: Array<string | number>,
    context?: RoutingContext
  ): Promise<T[]> {
    if (!ids || ids.length === 0) return []

    // Check TTL expiration before using cache
    if (this._isCacheExpired()) {
      this.invalidateCache()
    }

    // Try cache first if valid and complete
    if (this._cache.valid && !this.overflow) {
      const idStrs = new Set(ids.map(String))
      const cached = this._cache.items
        .filter((item) => idStrs.has(String(item[this.idField])))
        .map((item) => ({ ...item }) as T) // Return copies

      // If we found all items in cache
      if (cached.length === ids.length) {
        this._stats.cacheHits += ids.length
        return cached
      }
      // Partial cache hit - fall through to storage
    }

    this._stats.cacheMisses += ids.length

    const { storage } = this._normalizeResolveResult(
      this.resolveStorage('getMany', context),
      context
    )
    if (storage && 'getMany' in storage && typeof storage.getMany === 'function') {
      return (storage as unknown as { getMany: (ids: Array<string | number>, context?: RoutingContext) => Promise<T[]> }).getMany(ids, context)
    }
    // Fallback: parallel get calls (get() handles its own stats)
    this._stats.cacheMisses -= ids.length // Avoid double counting
    const results = await Promise.all(
      ids.map((id) => this.get(id, context).catch((): null => null))
    )
    return results.filter((r): r is NonNullable<typeof r> => r !== null) as T[]
  }

  /**
   * Create a new entity
   */
  async create(data: Partial<T>, context?: RoutingContext): Promise<T> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('create', context),
      context
    )
    this._stats.create++
    if (storage) {
      // Apply field defaults before presave hooks
      const dataWithDefaults = this.applyDefaults(data, context ?? null)

      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(dataWithDefaults, true)
      await this._invokeHook('presave', presaveContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use create()
      let result: T
      if (endpoint && storage.request) {
        const response = (await storage.request('POST', endpoint, {
          data: presaveContext.record,
          context,
        })) as { data?: T }
        result = (response.data ?? response) as T
      } else {
        result = await storage.create(presaveContext.record)
      }
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, true)
      await this._invokeHook('postsave', postsaveContext as unknown as Record<string, unknown>)

      this._emitSignal('created', {
        entity: result,
        manager: this.name,
        id: result?.[this.idField],
      })
      this._emitDataInvalidate('created', result?.[this.idField] as string | number | undefined)
      return result
    }
    throw new Error(`[EntityManager:${this.name}] create() not implemented`)
  }

  /**
   * Update an entity (PUT - full replacement)
   */
  async update(
    id: string | number,
    data: Partial<T>,
    context?: RoutingContext
  ): Promise<T> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('update', context),
      context
    )
    this._stats.update++
    if (storage) {
      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(data, false, id)
      await this._invokeHook('presave', presaveContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use update()
      let result: T
      if (endpoint && storage.request) {
        const response = (await storage.request('PUT', `${endpoint}/${id}`, {
          data: presaveContext.record,
          context,
        })) as { data?: T }
        result = (response.data ?? response) as T
      } else {
        result = await storage.update(id, presaveContext.record)
      }
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, false, id)
      await this._invokeHook('postsave', postsaveContext as unknown as Record<string, unknown>)

      this._emitSignal('updated', {
        entity: result,
        manager: this.name,
        id,
      })
      this._emitDataInvalidate('updated', id)
      return result
    }
    throw new Error(`[EntityManager:${this.name}] update() not implemented`)
  }

  /**
   * Partially update an entity (PATCH)
   */
  async patch(
    id: string | number,
    data: Partial<T>,
    context?: RoutingContext
  ): Promise<T> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('patch', context),
      context
    )
    this._stats.update++ // patch counts as update
    if (storage) {
      // Invoke presave hooks (can modify data or throw to abort)
      const presaveContext = this._buildPresaveContext(data, false, id)
      await this._invokeHook('presave', presaveContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use patch()
      let result: T
      if (endpoint && storage.request) {
        const response = (await storage.request('PATCH', `${endpoint}/${id}`, {
          data: presaveContext.record,
          context,
        })) as { data?: T }
        result = (response.data ?? response) as T
      } else if (storage.patch) {
        result = await storage.patch(id, presaveContext.record)
      } else {
        throw new Error(
          `[EntityManager:${this.name}] Storage does not support patch()`
        )
      }
      this.invalidateCache()

      // Invoke postsave hooks (for side effects)
      const postsaveContext = this._buildPostsaveContext(data, result, false, id)
      await this._invokeHook('postsave', postsaveContext as unknown as Record<string, unknown>)

      this._emitSignal('updated', {
        entity: result,
        manager: this.name,
        id,
      })
      this._emitDataInvalidate('updated', id)
      return result
    }
    throw new Error(`[EntityManager:${this.name}] patch() not implemented`)
  }

  /**
   * Delete an entity
   */
  async delete(id: string | number, context?: RoutingContext): Promise<void> {
    const { storage, endpoint } = this._normalizeResolveResult(
      this.resolveStorage('delete', context),
      context
    )
    this._stats.delete++
    if (storage) {
      // Invoke predelete hooks (can throw to abort, e.g., for cascade checks)
      const predeleteContext = this._buildPredeleteContext(id)
      await this._invokeHook('predelete', predeleteContext as unknown as Record<string, unknown>)

      // Use request() with endpoint for multi-storage routing, otherwise use delete()
      if (endpoint && storage.request) {
        await storage.request('DELETE', `${endpoint}/${id}`, { context })
      } else {
        await storage.delete(id)
      }
      this.invalidateCache()
      this._emitSignal('deleted', {
        manager: this.name,
        id,
      })
      this._emitDataInvalidate('deleted', id)
      return
    }
    throw new Error(`[EntityManager:${this.name}] delete() not implemented`)
  }

  /**
   * Generic request for special operations
   */
  async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: {
      data?: unknown
      params?: Record<string, unknown>
      headers?: Record<string, string>
      invalidateCache?: boolean
    } = {}
  ): Promise<unknown> {
    if (this.storage?.request) {
      const { invalidateCache: shouldInvalidate, ...storageOptions } = options
      const result = await this.storage.request(method, path, storageOptions)

      // Auto-invalidate cache for mutation methods, or if explicitly requested
      if (shouldInvalidate ?? method !== 'GET') {
        this.invalidateCache()
      }

      return result
    }
    throw new Error(`[EntityManager:${this.name}] request() not implemented`)
  }

  /**
   * Hook: called when manager is registered with orchestrator
   */
  onRegister(orchestrator: Orchestrator): void {
    this._orchestrator = orchestrator
  }

  // ============ CACHE MANAGEMENT ============

  /**
   * Get effective threshold (0 = no cache)
   */
  get effectiveThreshold(): number {
    return this.localFilterThreshold ?? 100
  }

  /**
   * Get effective cache TTL in milliseconds
   * Priority: storage.cacheTtlMs > entity.cacheTtlMs > kernel.defaultEntityCacheTtlMs > -1
   *
   * Values:
   * - 0: disable caching
   * - -1: infinite (no expiration, cache until invalidation)
   * - > 0: TTL in milliseconds
   */
  get effectiveCacheTtlMs(): number {
    // 1. Storage capabilities (can be set dynamically from API headers)
    const storageCaps =
      (this.storage as unknown as { capabilities?: StorageCapabilities })?.capabilities ||
      (this.storage?.constructor as { capabilities?: StorageCapabilities })?.capabilities
    if (storageCaps?.cacheTtlMs !== undefined) {
      return storageCaps.cacheTtlMs
    }

    // 2. Entity-level config
    if (this._cacheTtlMs !== null) {
      return this._cacheTtlMs
    }

    // 3. Global default from kernel options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalTtl = (this._orchestrator as any)?.kernelOptions?.defaultEntityCacheTtlMs
    if (globalTtl !== undefined) {
      return globalTtl
    }

    // 4. Default: infinite (no expiration)
    return -1
  }

  /**
   * Check if caching is disabled by TTL=0
   */
  get isCacheTtlDisabled(): boolean {
    return this.effectiveCacheTtlMs === 0
  }

  /**
   * Check if cache has expired based on TTL
   */
  protected _isCacheExpired(): boolean {
    if (!this._cache.valid || !this._cache.loadedAt) return false
    const ttl = this.effectiveCacheTtlMs
    if (ttl <= 0) return false // 0 = disabled (handled elsewhere), -1 = infinite
    return Date.now() - this._cache.loadedAt > ttl
  }

  /**
   * Check if storage adapter supports returning total count
   */
  get storageSupportsTotal(): boolean {
    const caps = (this.storage?.constructor as { capabilities?: Partial<StorageCapabilities> })
      ?.capabilities
    return caps?.supportsTotal ?? false
  }

  /**
   * Check if storage requires authentication
   */
  protected _getStorageRequiresAuth(): boolean {
    // Check instance capabilities first (may have dynamic requiresAuth)
    const instanceCaps = (this.storage as unknown as { capabilities?: Partial<StorageCapabilities> })
      ?.capabilities
    if (instanceCaps?.requiresAuth !== undefined) {
      return instanceCaps.requiresAuth
    }
    // Fallback to static capabilities
    const caps = (this.storage?.constructor as { capabilities?: Partial<StorageCapabilities> })
      ?.capabilities
    return caps?.requiresAuth ?? false
  }

  /**
   * Get searchable fields declared by storage adapter
   */
  get storageSearchFields(): string[] | undefined {
    const caps = (this.storage?.constructor as { capabilities?: Partial<StorageCapabilities> })
      ?.capabilities
    return caps?.searchFields
  }

  /**
   * Parse searchFields into own fields and parent fields
   */
  protected _parseSearchFields(overrideSearchFields: string[] | null = null): {
    ownFields: string[]
    parentFields: Record<string, string[]>
  } {
    const searchFields = overrideSearchFields ?? this.storageSearchFields ?? []
    const ownFields: string[] = []
    const parentFields: Record<string, string[]> = {}

    for (const field of searchFields) {
      if (!field.includes('.')) {
        ownFields.push(field)
        continue
      }

      // Split on first dot only
      const parts = field.split('.', 2)
      const parentKey = parts[0]
      const fieldName = parts[1]

      if (!parentKey || !fieldName) {
        continue
      }

      // Validate parentKey exists in parents config
      if (!this._parents[parentKey]) {
        console.warn(
          `[EntityManager:${this.name}] Unknown parent '${parentKey}' in searchFields '${field}', skipping`
        )
        continue
      }

      // Group by parentKey
      if (!parentFields[parentKey]) {
        parentFields[parentKey] = []
      }
      parentFields[parentKey].push(fieldName)
    }

    return { ownFields, parentFields }
  }

  /**
   * Resolve parent entity fields for searchable caching
   */
  protected async _resolveSearchFields(items: T[]): Promise<void> {
    const { parentFields } = this._parseSearchFields()

    // No parent fields to resolve
    if (Object.keys(parentFields).length === 0) return

    // Need orchestrator to access other managers
    if (!this._orchestrator) {
      console.warn(
        `[EntityManager:${this.name}] No orchestrator, cannot resolve parent fields`
      )
      return
    }

    // Process each parent type
    for (const [parentKey, fields] of Object.entries(parentFields)) {
      const config = this._parents[parentKey]

      if (!config) {
        console.warn(
          `[EntityManager:${this.name}] Missing parent config for '${parentKey}'`
        )
        continue
      }

      // Extract unique parent IDs (deduplicated)
      const ids = [
        ...new Set(
          items
            .map((i) => i[config.foreignKey as keyof T] as string | number | undefined)
            .filter((id): id is string | number => id != null)
        ),
      ]
      if (ids.length === 0) continue

      // Batch fetch parent entities
      const manager = this._orchestrator.get(config.entity)
      if (!manager) {
        console.warn(
          `[EntityManager:${this.name}] Manager not found for '${config.entity}'`
        )
        continue
      }

      const parents = await manager.getMany(ids)
      const parentMap = new Map(
        parents.map((p) => [p[manager.idField as keyof typeof p], p])
      )

      // Cache resolved values in _search (non-enumerable)
      for (const item of items) {
        // Initialize _search as non-enumerable if needed
        const itemWithSearch = item as T & { _search?: Record<string, string> }
        if (!itemWithSearch._search) {
          Object.defineProperty(item, '_search', {
            value: {},
            enumerable: false,
            writable: true,
            configurable: true,
          })
        }

        const parent = parentMap.get(item[config.foreignKey as keyof T])
        for (const field of fields) {
          itemWithSearch._search![`${parentKey}.${field}`] =
            (parent?.[field as keyof typeof parent] as string) ?? ''
        }
      }
    }
  }

  /**
   * Set up signal listeners for cache invalidation
   */
  protected _setupCacheListeners(): void {
    if (!this._signals) return

    // Clean up existing listeners if any
    if (this._signalCleanup) {
      this._signalCleanup()
      this._signalCleanup = null
    }

    const cleanups: Array<() => void> = []

    // Listen for parent data changes (if parents defined)
    if (this._parents && Object.keys(this._parents).length > 0) {
      const parentEntities = Object.values(this._parents).map((p) => p.entity)
      cleanups.push(
        this._signals.on(
          'entity:data-invalidate',
          (event: { name: string; data: unknown }) => {
            const { entity } = (event.data || {}) as { entity?: string }
            if (entity && parentEntities.includes(entity)) {
              this._clearSearchCache()
            }
          }
        )
      )
    }

    // Listen for datalayer invalidation
    cleanups.push(
      this._signals.on(
        'entity:datalayer-invalidate',
        (event: { name: string; data: unknown }) => {
          const { entity, actuator } = (event.data || {}) as {
            entity?: string
            actuator?: string
          }
          // Auth-triggered: only react if authSensitive
          if (actuator === 'auth' && !this._authSensitive) return

          // Check entity match (global or targeted)
          if (!entity || entity === '*' || entity === this.name) {
            this.invalidateDataLayer()
          }
        }
      )
    )

    // Combined cleanup function
    this._signalCleanup = () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }

  /**
   * Clear the _search cache from all cached items
   */
  protected _clearSearchCache(): void {
    if (!this._cache.valid) return

    for (const item of this._cache.items) {
      const itemWithSearch = item as T & { _search?: Record<string, string> }
      if (itemWithSearch._search) {
        itemWithSearch._search = {}
      }
    }

    // Invalidate cache so next list() refetches
    this.invalidateCache()
  }

  /**
   * Check if caching is enabled for this entity
   */
  get isCacheEnabled(): boolean {
    if (this.effectiveThreshold <= 0) return false
    if (this.isCacheTtlDisabled) return false // TTL=0 disables cache
    // Check capabilities (instance getter or static)
    const caps =
      (this.storage as unknown as { capabilities?: StorageCapabilities })?.capabilities ||
      (this.storage?.constructor as { capabilities?: StorageCapabilities })?.capabilities
    if (caps?.supportsCaching === false) return false
    if (!this.storageSupportsTotal) return false
    return true
  }

  /**
   * Check if cache is in overflow mode (has more items than cached)
   */
  get overflow(): boolean {
    return this._cache.valid && this._cache.total > this._cache.items.length
  }

  /**
   * Invalidate the cache, forcing next list() to refetch
   */
  invalidateCache(): void {
    this._cache.valid = false
    this._cache.items = []
    this._cache.total = 0
    this._cache.loadedAt = null
    this._cacheLoading = null
  }

  /**
   * Invalidate the entire data layer (cache + storage state)
   */
  invalidateDataLayer(): void {
    this.invalidateCache()

    // Reset storage if it supports it (e.g., clear auth tokens, cached responses)
    if (typeof this.storage?.reset === 'function') {
      this.storage.reset()
    }
  }

  /**
   * Ensure cache is loaded (if caching is enabled and items fit)
   */
  async ensureCache(): Promise<boolean> {
    if (!this.isCacheEnabled) return false
    if (this._cache.valid) return true

    // Avoid concurrent cache loads
    if (this._cacheLoading) {
      await this._cacheLoading
      return this._cache.valid
    }

    this._cacheLoading = this._loadCache()
    const result = await this._cacheLoading
    this._cacheLoading = null
    return result
  }

  /**
   * Internal: load all items into cache in background (fire-and-forget)
   */
  protected _loadCacheInBackground(): void {
    this._cacheLoading = this._loadCache()
    this._cacheLoading
      .catch((err) =>
        console.error(
          `[EntityManager:${this.name}] Background cache load failed:`,
          err
        )
      )
      .finally(() => {
        this._cacheLoading = null
      })
  }

  /**
   * Internal: load all items into cache
   */
  protected async _loadCache(): Promise<boolean> {
    // First, check total count with minimal request
    // Use _internal to skip stats counting
    const probe = await this.list({ page_size: 1, _internal: true })

    if (probe.total > this.effectiveThreshold) {
      // Too many items, don't cache
      this._cache.valid = false
      return false
    }

    // Load all items (internal operation, skip stats)
    const result = await this.list({
      page_size: probe.total || this.effectiveThreshold,
      _internal: true,
    })
    this._cache.items = result.items || []
    this._cache.total = result.total
    this._cache.loadedAt = Date.now()
    this._cache.valid = true
    // Resolve parent fields for search (book.title, user.username, etc.)
    await this._resolveSearchFields(this._cache.items)
    return true
  }

  /**
   * Warmup: preload cache via DeferredRegistry for loose async coupling
   */
  async warmup(): Promise<boolean | null> {
    // Skip if warmup disabled or caching not applicable
    if (!this._warmup) return null
    if (!this.isCacheEnabled) return null

    const deferred = this._orchestrator?.deferred

    // Wait for auth if app uses authentication (user context affects cache)
    if (deferred?.has('auth:ready')) {
      await deferred.await('auth:ready')
    }

    const key = `entity:${this.name}:cache`

    if (!deferred) {
      // Fallback: direct cache load without DeferredRegistry
      return this.ensureCache()
    }

    // Register in DeferredRegistry for loose coupling
    return deferred.queue(key, () => this.ensureCache())
  }

  /**
   * Check if warmup is enabled for this manager
   */
  get warmupEnabled(): boolean {
    return this._warmup && this.isCacheEnabled
  }

  /**
   * Query entities with automatic cache/API decision
   */
  async query(
    params: ListParams = {},
    options: QueryOptions = {}
  ): Promise<ListResult<T>> {
    const { context = {}, routingContext = null } = options

    // Ensure cache is filled (via list)
    if (!this._cache.valid && this.isCacheEnabled) {
      await this.list(
        { page_size: this.effectiveThreshold },
        routingContext ?? undefined
      )
    }

    let result: ListResult<T>

    // If overflow or cache disabled, use API for accurate filtered results
    if (this.overflow || !this.isCacheEnabled) {
      result = await this.list(params, routingContext ?? undefined)
    } else {
      // Full cache available - filter locally
      const filtered = this._filterLocally(this._cache.items, params)
      result = { ...filtered, fromCache: true }
    }

    // Call hook if defined (for context-based customization)
    if (this.onQueryResult) {
      result = this.onQueryResult(result, context) || result
    }

    return result
  }

  /**
   * Build MongoDB-like query from filters object
   */
  protected _buildQuery(filters: Record<string, unknown>): QueryObject {
    const query: QueryObject = {}
    for (const [field, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      // Cast value to QueryCondition - QueryExecutor handles type validation
      query[field] = value as QueryObject[string]
    }
    return query
  }

  /**
   * Apply filters, search, sort and pagination locally
   */
  protected _filterLocally(
    items: T[],
    params: ListParams & { searchFields?: string[] | null } = {}
  ): { items: T[]; total: number } {
    const {
      search = '',
      searchFields: overrideSearchFields = null,
      filters = {},
      sort_by = null,
      sort_order = 'asc',
      page = 1,
      page_size = 20,
    } = params

    let result = [...items]

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase()
      const searchFields = overrideSearchFields ?? this.storageSearchFields

      result = result.filter((item) => {
        if (searchFields) {
          const { ownFields, parentFields } =
            this._parseSearchFields(searchFields)

          // Search own fields
          for (const field of ownFields) {
            const value = item[field as keyof T]
            if (
              typeof value === 'string' &&
              value.toLowerCase().includes(searchLower)
            ) {
              return true
            }
            if (
              typeof value === 'number' &&
              value.toString().includes(search)
            ) {
              return true
            }
          }

          // Search cached parent fields (in item._search)
          const itemWithSearch = item as T & {
            _search?: Record<string, string>
          }
          if (itemWithSearch._search) {
            for (const [parentKey, fields] of Object.entries(parentFields)) {
              for (const field of fields) {
                const key = `${parentKey}.${field}`
                const value = itemWithSearch._search[key]
                // _search values are always strings
                if (value && value.toLowerCase().includes(searchLower)) {
                  return true
                }
              }
            }
          }

          return false
        } else {
          // No searchFields declared: search all string/number fields
          return Object.values(item).some((value) => {
            if (typeof value === 'string') {
              return value.toLowerCase().includes(searchLower)
            }
            if (typeof value === 'number') {
              return value.toString().includes(search)
            }
            return false
          })
        }
      })
    }

    // Build query and apply filters using QueryExecutor
    const query = this._buildQuery(filters)
    if (Object.keys(query).length > 0) {
      const { items: filtered } = QueryExecutor.execute(result, query)
      result = filtered as T[]
    }

    // Total after filtering (before pagination)
    const total = result.length

    // Apply sort (QueryExecutor does not sort)
    if (sort_by) {
      result.sort((a, b) => {
        const aVal = a[sort_by as keyof T]
        const bVal = b[sort_by as keyof T]

        // Handle nulls
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sort_order === 'asc' ? 1 : -1
        if (bVal == null) return sort_order === 'asc' ? -1 : 1

        // Compare
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const cmp = aVal.localeCompare(bVal)
          return sort_order === 'asc' ? cmp : -cmp
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sort_order === 'asc' ? cmp : -cmp
      })
    }

    // Apply pagination
    const start = (page - 1) * page_size
    const paged = result.slice(start, start + page_size)

    return { items: paged, total }
  }

  /**
   * Get cache info (for debugging)
   */
  getCacheInfo(): CacheInfo {
    const ttlMs = this.effectiveCacheTtlMs
    return {
      enabled: this.isCacheEnabled,
      storageSupportsTotal: this.storageSupportsTotal,
      threshold: this.effectiveThreshold,
      valid: this._cache.valid,
      overflow: this.overflow,
      itemCount: this._cache.items.length,
      total: this._cache.total,
      loadedAt: this._cache.loadedAt,
      ttlMs,
      expiresAt: this._cache.loadedAt && ttlMs > 0
        ? this._cache.loadedAt + ttlMs
        : null,
      expired: this._isCacheExpired(),
    }
  }

  /**
   * Get operation stats (for debug panel)
   */
  getStats(): OperationStats {
    return { ...this._stats }
  }

  /**
   * Reset operation stats
   */
  resetStats(): void {
    this._stats = {
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
  }

  // ============ RELATIONS ============

  /**
   * Get child relation config
   */
  getChildConfig(childName: string): ChildConfig | undefined {
    return this._children[childName]
  }

  /**
   * Get all child relation names
   */
  getChildNames(): string[] {
    return Object.keys(this._children)
  }

  /**
   * Get parent relation config
   */
  getParentConfig(): ParentConfig | null {
    return this._parent
  }

  /**
   * List children of a parent entity
   */
  async listChildren(
    parentId: string | number,
    childName: string,
    params: ListParams = {}
  ): Promise<ListResult<EntityRecord>> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    // Build endpoint path
    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('GET', childEndpoint, {
        params,
      }) as Promise<ListResult<EntityRecord>>
    }

    throw new Error(
      `[EntityManager:${this.name}] listChildren() requires storage with request()`
    )
  }

  /**
   * Get a specific child entity
   */
  async getChild(
    parentId: string | number,
    childName: string,
    childId: string | number
  ): Promise<EntityRecord> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request(
        'GET',
        `${childEndpoint}/${childId}`
      ) as Promise<EntityRecord>
    }

    throw new Error(
      `[EntityManager:${this.name}] getChild() requires storage with request()`
    )
  }

  /**
   * Create a child entity
   */
  async createChild(
    parentId: string | number,
    childName: string,
    data: Record<string, unknown>
  ): Promise<EntityRecord> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      return this.storage.request('POST', childEndpoint, {
        data,
      }) as Promise<EntityRecord>
    }

    throw new Error(
      `[EntityManager:${this.name}] createChild() requires storage with request()`
    )
  }

  /**
   * Delete a child entity
   */
  async deleteChild(
    parentId: string | number,
    childName: string,
    childId: string | number
  ): Promise<void> {
    const childConfig = this._children[childName]
    if (!childConfig) {
      throw new Error(
        `[EntityManager:${this.name}] Unknown child relation "${childName}"`
      )
    }

    const childEndpoint = childConfig.endpoint || `${parentId}/${childName}`

    if (this.storage?.request) {
      await this.storage.request('DELETE', `${childEndpoint}/${childId}`)
      return
    }

    throw new Error(
      `[EntityManager:${this.name}] deleteChild() requires storage with request()`
    )
  }

  /**
   * Get the parent entity's manager
   */
  getParentManager(): EntityManager<EntityRecord> | null {
    if (!this._parent || !this._orchestrator) return null
    return (
      this._orchestrator.get<EntityRecord>(this._parent.entity) ?? null
    )
  }

  /**
   * Get a child entity's manager (from orchestrator)
   */
  getChildManager(childName: string): EntityManager<EntityRecord> | null {
    const childConfig = this._children[childName]
    if (!childConfig || !this._orchestrator) return null
    return (
      this._orchestrator.get<EntityRecord>(childConfig.entity) ?? null
    )
  }

  /**
   * Hook: called when orchestrator is disposed
   */
  onDispose(): void {
    // Override in subclass if needed
  }
}

/**
 * Factory function to create an EntityManager
 */
export function createEntityManager<T extends EntityRecord = EntityRecord>(
  options: EntityManagerOptions<T>
): EntityManager<T> {
  return new EntityManager<T>(options)
}
