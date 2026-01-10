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
 *
 * @example
 * const collector = new EntitiesCollector()
 * collector.install(ctx)
 * collector.getEntries() // [{ name: 'books', storage: 'ApiStorage', ... }, ...]
 */

import { Collector } from './Collector.js'

/**
 * Collector for Entity Manager state visualization
 */
export class EntitiesCollector extends Collector {
  /**
   * Collector name identifier
   * @type {string}
   */
  static name = 'entities'

  /**
   * This collector shows state, not events
   * @type {boolean}
   */
  static records = false

  constructor(options = {}) {
    super(options)
    this._ctx = null
    this._signalCleanups = []
    this._lastUpdate = 0
    // Activity tracking: store previous stats to detect changes
    this._previousStats = new Map()  // entityName -> stats snapshot
    this._activeEntities = new Set() // entities with unseen activity
  }

  /**
   * Internal install - store context reference and subscribe to signals
   * The orchestrator is accessed lazily since it may not exist at install time.
   * @param {object} ctx - Context object
   * @protected
   */
  _doInstall(ctx) {
    this._ctx = ctx

    // Subscribe to entity signals for reactive updates
    // Uses deferred access since signals may not be ready at install time
    this._setupSignals()
  }

  /**
   * Setup signal listeners (deferred until signals available)
   * @private
   */
  _setupSignals() {
    const signals = this._ctx?.signals
    if (!signals) {
      // Retry on next tick if signals not ready
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
   * @protected
   */
  _doUninstall() {
    // Cleanup signal listeners
    for (const cleanup of this._signalCleanups) {
      if (typeof cleanup === 'function') cleanup()
    }
    this._signalCleanups = []
    this._ctx = null
  }

  /**
   * Get orchestrator lazily (may not exist at install time)
   * @returns {object|null}
   * @private
   */
  get _orchestrator() {
    return this._ctx?.orchestrator ?? null
  }

  /**
   * Get badge - show count of entities with unseen activity
   * @returns {number}
   */
  getBadge() {
    if (!this._orchestrator) return 0
    // Check for new activity before returning badge count
    this._detectActivity()
    return this._activeEntities.size
  }

  /**
   * Detect activity by comparing current stats with previous snapshot
   * @private
   */
  _detectActivity() {
    if (!this._orchestrator) return

    for (const name of this._orchestrator.getRegisteredNames()) {
      try {
        const manager = this._orchestrator.get(name)
        const currentStats = manager.getStats?.()
        if (!currentStats) continue

        const prevStats = this._previousStats.get(name)
        if (!prevStats) {
          // First time seeing this entity, store snapshot
          this._previousStats.set(name, { ...currentStats })
          continue
        }

        // Check if any stat changed
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
          // Update snapshot for next comparison
          this._previousStats.set(name, { ...currentStats })
        }
      } catch (e) {
        // Skip failed managers
      }
    }
  }

  /**
   * Get total count - number of registered entities
   * @returns {number}
   */
  getTotalCount() {
    if (!this._orchestrator) return 0
    return this._orchestrator.getRegisteredNames().length
  }

  /**
   * Get all entity information for display
   * @returns {Array<object>} Entity info array
   */
  getEntries() {
    if (!this._orchestrator) {
      return [{ type: 'status', message: 'No orchestrator configured' }]
    }

    const names = this._orchestrator.getRegisteredNames()
    if (names.length === 0) {
      return [{ type: 'status', message: 'No entities registered' }]
    }

    const entries = []

    for (const name of names.sort()) {
      try {
        const manager = this._orchestrator.get(name)
        entries.push(this._buildEntityInfo(name, manager))
      } catch (e) {
        entries.push({
          name,
          error: e.message
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
   * @param {string} name - Entity name
   * @param {EntityManager} manager - Manager instance
   * @returns {object} Entity info
   * @private
   */
  _buildEntityInfo(name, manager) {
    const cache = manager.getCacheInfo?.() || {}
    const storage = manager.storage

    return {
      name,
      system: manager.system ?? false,
      hasActivity: this._activeEntities.has(name),
      label: manager.label,
      labelPlural: manager.labelPlural,
      routePrefix: manager.routePrefix,
      idField: manager.idField,

      // Storage info
      // Prefer instance capabilities (may include requiresAuth) over static ones
      storage: {
        type: storage?.constructor?.storageName || storage?.constructor?.name || 'None',
        endpoint: storage?.endpoint || storage?._endpoint || null,
        capabilities: storage?.capabilities || storage?.constructor?.capabilities || {},
        hasNormalize: !!(storage?._normalize),
        hasDenormalize: !!(storage?._denormalize)
      },

      // Multi-storage info
      multiStorage: this._detectMultiStorage(manager),

      // Cache info
      cache: {
        enabled: cache.enabled ?? false,
        valid: cache.valid ?? false,
        itemCount: cache.itemCount ?? 0,
        total: cache.total ?? 0,
        threshold: cache.threshold ?? 0,
        overflow: cache.overflow ?? false,
        loadedAt: cache.loadedAt ? new Date(cache.loadedAt).toLocaleTimeString() : null,
        // Include cached items for inspection (limited to first 50)
        items: this._getCacheItems(manager, 50)
      },

      // Permissions
      permissions: {
        readOnly: manager.readOnly,
        canCreate: manager.canCreate?.() ?? true,
        canUpdate: manager.canUpdate?.() ?? true,
        canDelete: manager.canDelete?.() ?? true,
        canList: manager.canList?.() ?? true
      },

      // Auth sensitivity (auto-invalidates on auth events)
      authSensitive: manager._authSensitive ?? false,

      // Warmup
      warmup: {
        enabled: manager.warmupEnabled ?? false
      },

      // Operation stats
      stats: manager.getStats?.() || {
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

      // Fields
      fields: {
        count: Object.keys(manager.fields || {}).length,
        names: Object.keys(manager.fields || {}).slice(0, 10), // First 10
        required: manager.getRequiredFields?.() || []
      },

      // Relations
      relations: {
        parent: manager._parent ? {
          entity: manager._parent.entity,
          foreignKey: manager._parent.foreignKey
        } : null,
        parents: Object.entries(manager._parents || {}).map(([key, config]) => ({
          key,
          entity: config.entity,
          foreignKey: config.foreignKey
        })),
        children: Object.entries(manager._children || {}).map(([key, config]) => ({
          key,
          entity: config.entity,
          endpoint: config.endpoint || null
        })),
        // Field references (reference: { entity: 'x' } in field config)
        references: Object.entries(manager.fields || {})
          .filter(([, field]) => field.reference?.entity)
          .map(([fieldName, field]) => ({
            field: fieldName,
            entity: field.reference.entity
          }))
      }
    }
  }

  /**
   * Detect if a manager uses multi-storage pattern
   * @param {EntityManager} manager - Manager instance
   * @returns {object|null} Multi-storage info or null
   * @private
   */
  _detectMultiStorage(manager) {
    // Check if resolveStorage is overridden (not the base implementation)
    const hasCustomResolve = manager.resolveStorage &&
      manager.resolveStorage.toString() !== 'resolveStorage(method, context) {\n    return { storage: this.storage };\n  }'

    if (!hasCustomResolve) {
      // Also check by looking for additional storage properties
      const additionalStorages = this._findAdditionalStorages(manager)
      if (additionalStorages.length === 0) {
        return null
      }
    }

    // Find all storage properties on the manager
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
   * @param {EntityManager} manager - Manager instance
   * @returns {Array<{name: string, storage: object}>}
   * @private
   */
  _findAdditionalStorages(manager) {
    const storages = []
    const mainStorage = manager.storage

    // Look for properties that look like storages
    for (const key of Object.keys(manager)) {
      // Skip private and known non-storage properties
      if (key.startsWith('_') || key === 'storage') continue

      const value = manager[key]
      if (!value || typeof value !== 'object') continue

      // Check if it looks like a storage (has list, get, create methods or endpoint)
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
   * @param {EntityManager} manager - Manager instance
   * @param {number} limit - Max items to return
   * @returns {Array} Cached items (limited)
   * @private
   */
  _getCacheItems(manager, limit = 50) {
    try {
      // Try different cache access methods
      if (manager._cache && Array.isArray(manager._cache)) {
        return manager._cache.slice(0, limit)
      }
      if (manager._cacheMap && manager._cacheMap instanceof Map) {
        return Array.from(manager._cacheMap.values()).slice(0, limit)
      }
      if (manager.cache && Array.isArray(manager.cache)) {
        return manager.cache.slice(0, limit)
      }
      // Try getAll if available and cache is valid
      if (manager.getCacheInfo?.()?.valid && manager._cachedItems) {
        return manager._cachedItems.slice(0, limit)
      }
      return []
    } catch (e) {
      return []
    }
  }

  /**
   * Force refresh a specific entity's cache
   * @param {string} entityName - Entity name
   * @param {boolean} [reload=false] - If true, reload cache after invalidation
   * @returns {Promise<boolean>} True if cache refreshed
   */
  async refreshCache(entityName, reload = false) {
    if (!this._orchestrator) return false
    try {
      const manager = this._orchestrator.get(entityName)
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
   * @param {string} entityName - Entity name
   */
  invalidateCache(entityName) {
    if (!this._orchestrator) return
    try {
      const manager = this._orchestrator.get(entityName)
      manager.invalidateCache()
    } catch (e) {
      console.error('[EntitiesCollector] Failed to invalidate cache:', e)
    }
  }

  /**
   * Mark all entities as seen (clear activity state)
   * Call this when the panel is viewed
   * Note: Does not call notifyChange() to avoid re-render loop
   */
  markSeen() {
    this._activeEntities.clear()
  }

  /**
   * Mark a specific entity as seen
   * @param {string} entityName - Entity name
   */
  markEntitySeen(entityName) {
    this._activeEntities.delete(entityName)
  }

  /**
   * Test fetch data from a specific entity
   * Used to test auth protection - will throw 401 if not authenticated
   * @param {string} entityName - Entity name
   * @returns {Promise<{success: boolean, count?: number, error?: string, status?: number}>}
   */
  async testFetch(entityName) {
    if (!this._orchestrator) {
      return { success: false, error: 'No orchestrator' }
    }
    try {
      const manager = this._orchestrator.get(entityName)
      const result = await manager.storage.list({ page: 1, page_size: 1 })
      return {
        success: true,
        count: result.total ?? result.items?.length ?? 0
      }
    } catch (e) {
      return {
        success: false,
        error: e.message,
        status: e.status
      }
    }
  }

  /**
   * Test fetch data from a specific storage of an entity
   * @param {string} entityName - Entity name
   * @param {string} storageName - Storage property name ('storage' for primary)
   * @returns {Promise<{success: boolean, count?: number, error?: string, status?: number}>}
   */
  async testStorageFetch(entityName, storageName) {
    if (!this._orchestrator) {
      return { success: false, error: 'No orchestrator' }
    }
    try {
      const manager = this._orchestrator.get(entityName)
      const storage = storageName === 'storage' ? manager.storage : manager[storageName]
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
        error: e.message,
        status: e.status
      }
    }
  }
}
