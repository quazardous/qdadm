/**
 * EntitiesCollector - Debug collector for Entity Managers
 *
 * This collector displays registered entity managers and their state:
 * - All registered managers from Orchestrator
 * - Storage type and capabilities
 * - Cache status (enabled, valid, items, threshold)
 * - Permissions (readOnly, canCreate, canUpdate, canDelete)
 * - Relations (parent, children, parents)
 *
 * Shows current state rather than historical events.
 */

import { Collector, type CollectorContext, type CollectorEntry, type CollectorOptions } from './Collector'
import type { EntityManager } from '../../entity/EntityManager'

/**
 * Storage info structure
 */
export interface StorageInfo {
  type: string
  endpoint: string | null
  capabilities: Record<string, unknown>
  hasNormalize: boolean
  hasDenormalize: boolean
}

/**
 * Multi-storage entry
 */
export interface MultiStorageEntry {
  name: string
  type: string
  endpoint: string | null
  hasNormalize: boolean
  hasDenormalize: boolean
  capabilities: Record<string, unknown>
}

/**
 * Multi-storage info
 */
export interface MultiStorageInfo {
  enabled: boolean
  storages: MultiStorageEntry[]
}

/**
 * Cache info structure
 */
export interface CacheInfo {
  enabled: boolean
  valid: boolean
  itemCount: number
  total: number
  threshold: number
  overflow: boolean
  loadedAt: string | null
  items: unknown[]
}

/**
 * Permissions info
 */
export interface PermissionsInfo {
  readOnly: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canList: boolean
}

/**
 * Warmup info
 */
export interface WarmupInfo {
  enabled: boolean
}

/**
 * Stats info
 */
export interface StatsInfo {
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
 * Fields info
 */
export interface FieldsInfo {
  count: number
  names: string[]
  required: string[]
}

/**
 * Relation parent info
 */
export interface RelationParentInfo {
  entity: string
  foreignKey: string
}

/**
 * Relation parents entry
 */
export interface RelationParentsEntry {
  key: string
  entity: string
  foreignKey: string
}

/**
 * Relation children entry
 */
export interface RelationChildrenEntry {
  key: string
  entity: string
  endpoint: string | null
}

/**
 * Field reference entry
 */
export interface FieldReferenceEntry {
  field: string
  entity: string
}

/**
 * Relations info
 */
export interface RelationsInfo {
  parent: RelationParentInfo | null
  parents: RelationParentsEntry[]
  children: RelationChildrenEntry[]
  references: FieldReferenceEntry[]
}

/**
 * Entity entry for display
 */
export interface EntityEntry extends CollectorEntry {
  name?: string
  system?: boolean
  hasActivity?: boolean
  label?: string
  labelPlural?: string
  routePrefix?: string
  idField?: string
  storage?: StorageInfo
  multiStorage?: MultiStorageInfo | null
  cache?: CacheInfo
  permissions?: PermissionsInfo
  authSensitive?: boolean
  warmup?: WarmupInfo
  stats?: StatsInfo
  fields?: FieldsInfo
  relations?: RelationsInfo
  type?: 'status'
  message?: string
  error?: string
}

/**
 * Orchestrator interface for entity operations
 */
interface EntityOrchestrator {
  getRegisteredNames(): string[]
  get(name: string): EntityManager
}

/**
 * Collector for Entity Manager state visualization
 */
export class EntitiesCollector extends Collector<EntityEntry> {
  static override collectorName = 'entities'
  static override records = false

  private _signalCleanups: Array<() => void> = []
  private _lastUpdate = 0
  private _previousStats: Map<string, StatsInfo> = new Map()
  private _activeEntities: Set<string> = new Set()

  constructor(options: CollectorOptions = {}) {
    super(options)
  }

  /**
   * Internal install - store context reference and subscribe to signals
   */
  protected override _doInstall(ctx: CollectorContext): void {
    this._ctx = ctx
    this._setupSignals()
  }

  /**
   * Setup signal listeners (deferred until signals available)
   */
  private _setupSignals(): void {
    const signals = this._ctx?.signals
    if (!signals) {
      setTimeout(() => this._setupSignals(), 100)
      return
    }

    // Listen to all entity lifecycle events
    const entityCleanup = signals.on('entity:*', () => {
      this._lastUpdate = Date.now()
      this.notifyChange()
    })
    this._signalCleanups.push(entityCleanup)

    // Listen to entity data changes (CRUD operations)
    const dataCleanup = signals.on('entity:data-invalidate', () => {
      this._lastUpdate = Date.now()
      this.notifyChange()
    })
    this._signalCleanups.push(dataCleanup)
  }

  /**
   * Internal uninstall - cleanup signal subscriptions
   */
  protected override _doUninstall(): void {
    for (const cleanup of this._signalCleanups) {
      if (typeof cleanup === 'function') cleanup()
    }
    this._signalCleanups = []
    this._ctx = null
  }

  /**
   * Get orchestrator lazily (may not exist at install time)
   */
  private get _orchestrator(): EntityOrchestrator | null {
    return (this._ctx as CollectorContext & { orchestrator?: EntityOrchestrator })?.orchestrator ?? null
  }

  /**
   * Get badge - show count of entities with unseen activity
   */
  override getBadge(): number {
    if (!this._orchestrator) return 0
    this._detectActivity()
    return this._activeEntities.size
  }

  /**
   * Detect activity by comparing current stats with previous snapshot
   */
  private _detectActivity(): void {
    if (!this._orchestrator) return

    for (const name of this._orchestrator.getRegisteredNames()) {
      try {
        const manager = this._orchestrator.get(name) as EntityManager & { getStats?: () => StatsInfo }
        const currentStats = manager.getStats?.()
        if (!currentStats) continue

        const prevStats = this._previousStats.get(name)
        if (!prevStats) {
          this._previousStats.set(name, { ...currentStats })
          continue
        }

        const hasChanged =
          currentStats.list !== prevStats.list ||
          currentStats.get !== prevStats.get ||
          currentStats.create !== prevStats.create ||
          currentStats.update !== prevStats.update ||
          currentStats.delete !== prevStats.delete ||
          currentStats.cacheHits !== prevStats.cacheHits ||
          currentStats.cacheMisses !== prevStats.cacheMisses

        if (hasChanged) {
          this._activeEntities.add(name)
          this._previousStats.set(name, { ...currentStats })
        }
      } catch {
        // Skip failed managers
      }
    }
  }

  /**
   * Get total count - number of registered entities
   */
  getTotalCount(): number {
    if (!this._orchestrator) return 0
    return this._orchestrator.getRegisteredNames().length
  }

  /**
   * Get all entity information for display
   */
  override getEntries(): EntityEntry[] {
    if (!this._orchestrator) {
      return [{ timestamp: Date.now(), type: 'status', message: 'No orchestrator configured' }]
    }

    const names = this._orchestrator.getRegisteredNames()
    if (names.length === 0) {
      return [{ timestamp: Date.now(), type: 'status', message: 'No entities registered' }]
    }

    const entries: EntityEntry[] = []

    for (const name of names.sort()) {
      try {
        const manager = this._orchestrator.get(name)
        entries.push(this._buildEntityInfo(name, manager))
      } catch (e) {
        entries.push({
          timestamp: Date.now(),
          name,
          error: (e as Error).message
        })
      }
    }

    // Sort: system entities first, then alphabetically
    entries.sort((a, b) => {
      if (a.system && !b.system) return -1
      if (!a.system && b.system) return 1
      return (a.name || '').localeCompare(b.name || '')
    })

    return entries
  }

  /**
   * Build entity info object from manager
   */
  private _buildEntityInfo(name: string, manager: EntityManager): EntityEntry {
    const extManager = manager as EntityManager & {
      getCacheInfo?: () => {
        enabled?: boolean
        valid?: boolean
        itemCount?: number
        total?: number
        threshold?: number
        overflow?: boolean
        loadedAt?: number
      }
      getStats?: () => StatsInfo
      getRequiredFields?: () => string[]
      system?: boolean
      label?: string
      labelPlural?: string
      routePrefix?: string
      idField?: string
      readOnly?: boolean
      canCreate?: () => boolean
      canUpdate?: () => boolean
      canDelete?: () => boolean
      canList?: () => boolean
      _authSensitive?: boolean
      warmupEnabled?: boolean
      fields?: Record<string, { reference?: { entity?: string } }>
      _parent?: { entity: string; foreignKey: string }
      _parents?: Record<string, { entity: string; foreignKey: string }>
      _children?: Record<string, { entity: string; endpoint?: string }>
      _cache?: unknown[]
      _cacheMap?: Map<unknown, unknown>
      cache?: unknown[]
      _cachedItems?: unknown[]
      resolveStorage?: (method: string, context: unknown) => { storage: unknown }
    }

    const cache = extManager.getCacheInfo?.() || {}
    const storage = extManager.storage as {
      constructor?: { storageName?: string; name?: string; capabilities?: Record<string, unknown> }
      endpoint?: string
      _endpoint?: string
      capabilities?: Record<string, unknown>
      _normalize?: unknown
      _denormalize?: unknown
    } | null

    return {
      timestamp: Date.now(),
      name,
      system: extManager.system ?? false,
      hasActivity: this._activeEntities.has(name),
      label: extManager.label,
      labelPlural: extManager.labelPlural,
      routePrefix: extManager.routePrefix,
      idField: extManager.idField,

      storage: {
        type: storage?.constructor?.storageName || storage?.constructor?.name || 'None',
        endpoint: storage?.endpoint || storage?._endpoint || null,
        capabilities: storage?.capabilities || storage?.constructor?.capabilities || {},
        hasNormalize: !!(storage?._normalize),
        hasDenormalize: !!(storage?._denormalize)
      },

      multiStorage: this._detectMultiStorage(extManager),

      cache: {
        enabled: cache.enabled ?? false,
        valid: cache.valid ?? false,
        itemCount: cache.itemCount ?? 0,
        total: cache.total ?? 0,
        threshold: cache.threshold ?? 0,
        overflow: cache.overflow ?? false,
        loadedAt: cache.loadedAt ? new Date(cache.loadedAt).toLocaleTimeString() : null,
        items: this._getCacheItems(extManager, 50)
      },

      permissions: {
        readOnly: extManager.readOnly ?? false,
        canCreate: extManager.canCreate?.() ?? true,
        canUpdate: extManager.canUpdate?.() ?? true,
        canDelete: extManager.canDelete?.() ?? true,
        canList: extManager.canList?.() ?? true
      },

      authSensitive: extManager._authSensitive ?? false,

      warmup: {
        enabled: extManager.warmupEnabled ?? false
      },

      stats: extManager.getStats?.() || {
        list: 0,
        get: 0,
        create: 0,
        update: 0,
        delete: 0,
        cacheHits: 0,
        cacheMisses: 0,
        maxItemsSeen: 0,
        maxTotal: 0
      },

      fields: {
        count: Object.keys(extManager.fields || {}).length,
        names: Object.keys(extManager.fields || {}).slice(0, 10),
        required: extManager.getRequiredFields?.() || []
      },

      relations: {
        parent: extManager._parent ? {
          entity: extManager._parent.entity,
          foreignKey: extManager._parent.foreignKey
        } : null,
        parents: Object.entries(extManager._parents || {}).map(([key, config]) => ({
          key,
          entity: config.entity,
          foreignKey: config.foreignKey
        })),
        children: Object.entries(extManager._children || {}).map(([key, config]) => ({
          key,
          entity: config.entity,
          endpoint: config.endpoint || null
        })),
        references: Object.entries(extManager.fields || {})
          .filter(([, field]) => field.reference?.entity)
          .map(([fieldName, field]) => ({
            field: fieldName,
            entity: field.reference!.entity!
          }))
      }
    }
  }

  /**
   * Detect if a manager uses multi-storage pattern
   */
  private _detectMultiStorage(manager: EntityManager): MultiStorageInfo | null {
    const extManager = manager as EntityManager & {
      resolveStorage?: (method: string, context: unknown) => { storage: unknown }
      storage?: unknown
    }

    const hasCustomResolve = extManager.resolveStorage &&
      extManager.resolveStorage.toString() !== 'resolveStorage(method, context) {\n    return { storage: this.storage };\n  }'

    if (!hasCustomResolve) {
      const additionalStorages = this._findAdditionalStorages(manager)
      if (additionalStorages.length === 0) {
        return null
      }
    }

    const storages = this._findAdditionalStorages(manager)

    return {
      enabled: true,
      storages: storages.map(s => ({
        name: s.name,
        type: s.storage?.constructor?.storageName || s.storage?.constructor?.name || 'Unknown',
        endpoint: s.storage?.endpoint || null,
        hasNormalize: !!(s.storage?._normalize),
        hasDenormalize: !!(s.storage?._denormalize),
        capabilities: s.storage?.capabilities || s.storage?.constructor?.capabilities || {}
      }))
    }
  }

  /**
   * Find additional storage instances on a manager
   */
  private _findAdditionalStorages(manager: EntityManager): Array<{
    name: string
    storage: {
      constructor?: { storageName?: string; name?: string; capabilities?: Record<string, unknown> }
      endpoint?: string
      capabilities?: Record<string, unknown>
      _normalize?: unknown
      _denormalize?: unknown
      list?: (params: unknown) => unknown
      get?: (id: unknown) => unknown
      fetch?: (params: unknown) => unknown
    }
  }> {
    const storages: Array<{
      name: string
      storage: {
        constructor?: { storageName?: string; name?: string; capabilities?: Record<string, unknown> }
        endpoint?: string
        capabilities?: Record<string, unknown>
        _normalize?: unknown
        _denormalize?: unknown
        list?: (params: unknown) => unknown
        get?: (id: unknown) => unknown
        fetch?: (params: unknown) => unknown
      }
    }> = []
    const extManager = manager as EntityManager & { storage?: unknown } & Record<string, unknown>
    const mainStorage = extManager.storage

    for (const key of Object.keys(extManager)) {
      if (key.startsWith('_') || key === 'storage') continue

      const value = extManager[key] as {
        constructor?: { storageName?: string; name?: string; capabilities?: Record<string, unknown> }
        endpoint?: string
        capabilities?: Record<string, unknown>
        _normalize?: unknown
        _denormalize?: unknown
        list?: (params: unknown) => unknown
        get?: (id: unknown) => unknown
        fetch?: (params: unknown) => unknown
      } | null
      if (!value || typeof value !== 'object') continue

      const isStorage = (
        (typeof value.list === 'function' && typeof value.get === 'function') ||
        (value.endpoint && typeof value.fetch === 'function')
      )

      if (isStorage && value !== mainStorage) {
        storages.push({ name: key, storage: value })
      }
    }

    return storages
  }

  /**
   * Get cached items from a manager
   */
  private _getCacheItems(manager: EntityManager, limit = 50): unknown[] {
    const extManager = manager as EntityManager & {
      _cache?: unknown[]
      _cacheMap?: Map<unknown, unknown>
      cache?: unknown[]
      _cachedItems?: unknown[]
      getCacheInfo?: () => { valid?: boolean }
    }

    try {
      if (extManager._cache && Array.isArray(extManager._cache)) {
        return extManager._cache.slice(0, limit)
      }
      if (extManager._cacheMap && extManager._cacheMap instanceof Map) {
        return Array.from(extManager._cacheMap.values()).slice(0, limit)
      }
      if (extManager.cache && Array.isArray(extManager.cache)) {
        return extManager.cache.slice(0, limit)
      }
      if (extManager.getCacheInfo?.()?.valid && extManager._cachedItems) {
        return extManager._cachedItems.slice(0, limit)
      }
      return []
    } catch {
      return []
    }
  }

  /**
   * Force refresh a specific entity's cache
   */
  async refreshCache(entityName: string, reload = false): Promise<boolean> {
    if (!this._orchestrator) return false
    try {
      const manager = this._orchestrator.get(entityName) as EntityManager & {
        invalidateCache: () => void
        ensureCache: () => Promise<void>
      }
      manager.invalidateCache()
      if (reload) {
        await manager.ensureCache()
      }
      this.notifyChange()
      return true
    } catch (e) {
      console.error('[EntitiesCollector] Failed to refresh cache:', e)
      return false
    }
  }

  /**
   * Invalidate a specific entity's cache
   */
  invalidateCache(entityName: string): void {
    if (!this._orchestrator) return
    try {
      const manager = this._orchestrator.get(entityName) as EntityManager & {
        invalidateCache: () => void
      }
      manager.invalidateCache()
    } catch (e) {
      console.error('[EntitiesCollector] Failed to invalidate cache:', e)
    }
  }

  /**
   * Mark all entities as seen (clear activity state)
   */
  markSeen(): void {
    this._activeEntities.clear()
  }

  /**
   * Mark a specific entity as seen
   */
  markEntitySeen(entityName: string): void {
    this._activeEntities.delete(entityName)
  }

  /**
   * Test fetch data from a specific entity
   */
  async testFetch(entityName: string): Promise<{ success: boolean; count?: number; error?: string; status?: number }> {
    if (!this._orchestrator) {
      return { success: false, error: 'No orchestrator' }
    }
    try {
      const manager = this._orchestrator.get(entityName) as EntityManager & {
        storage: { list: (params: { page: number; page_size: number }) => Promise<{ total?: number; items?: unknown[] }> }
      }
      const result = await manager.storage.list({ page: 1, page_size: 1 })
      return {
        success: true,
        count: result.total ?? result.items?.length ?? 0
      }
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        status: (e as Error & { status?: number }).status
      }
    }
  }

  /**
   * Test fetch data from a specific storage of an entity
   */
  async testStorageFetch(
    entityName: string,
    storageName: string
  ): Promise<{ success: boolean; count?: number; error?: string; status?: number }> {
    if (!this._orchestrator) {
      return { success: false, error: 'No orchestrator' }
    }
    try {
      const manager = this._orchestrator.get(entityName) as EntityManager & Record<string, unknown>
      const storage = storageName === 'storage'
        ? manager.storage as { list: (params: { page: number; page_size: number }) => Promise<{ total?: number; items?: unknown[] }> }
        : manager[storageName] as { list: (params: { page: number; page_size: number }) => Promise<{ total?: number; items?: unknown[] }> } | undefined

      if (!storage) {
        return { success: false, error: `Storage '${storageName}' not found` }
      }
      const result = await storage.list({ page: 1, page_size: 1 })
      return {
        success: true,
        count: result.total ?? result.items?.length ?? 0
      }
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        status: (e as Error & { status?: number }).status
      }
    }
  }
}
