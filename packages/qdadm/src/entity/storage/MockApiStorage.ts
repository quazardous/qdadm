import { IStorage } from './IStorage'
import { StorageError } from './errors'
import { QueryExecutor } from '../../query'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'
import { sortItems, searchItems, paginate, defaultGenerateId } from '../../query/clientFilter'

/**
 * MockApiStorage options
 */
export interface MockApiStorageOptions<T extends EntityRecord = EntityRecord> {
  entityName: string
  idField?: string
  generateId?: () => string
  initialData?: T[] | null
  authCheck?: (() => boolean) | null
  /** Override the localStorage key (default `mockapi_${entityName}_data`).
   *  Needed when several apps sharing an origin use the same entity names
   *  (e.g. multiple demos on one GitHub Pages site) (#1382). */
  storageKey?: string
}

/**
 * MockApiStorage - In-memory storage with localStorage persistence
 *
 * Combines in-memory Map performance with localStorage persistence.
 * Designed for demos that need:
 * - Fast in-memory operations
 * - Data persistence across page reloads
 * - Optional initial data seeding
 *
 * localStorage key pattern: mockapi_${entityName}_data
 */
export class MockApiStorage<T extends EntityRecord = EntityRecord> extends IStorage<T> {
  static storageName = 'MockApiStorage'

  static capabilities: StorageCapabilities = {
    supportsTotal: true,
    supportsFilters: true,
    supportsPagination: true,
    supportsCaching: false,
  }

  /**
   * Instance capabilities getter.
   * Merges static capabilities with instance-specific ones like requiresAuth.
   */
  get capabilities(): StorageCapabilities & { requiresAuth: boolean } {
    return {
      ...MockApiStorage.capabilities,
      requiresAuth: !!this._authCheck,
    }
  }

  readonly entityName: string
  readonly idField: string
  readonly generateId: () => string

  protected _storageKey: string
  protected _data: Map<string, T>
  protected _authCheck: (() => boolean) | null

  constructor(options: MockApiStorageOptions<T>) {
    super()
    const {
      entityName,
      idField = 'id',
      generateId = defaultGenerateId,
      initialData = null,
      authCheck = null,
      storageKey = null,
    } = options

    if (!entityName) {
      throw new Error('MockApiStorage requires entityName option')
    }

    this.entityName = entityName
    this.idField = idField
    this.generateId = generateId
    this._storageKey = storageKey || `mockapi_${entityName}_data`
    this._data = new Map()
    this._authCheck = authCheck

    this._loadFromStorage(initialData)
  }

  protected _checkAuth(): void {
    if (this._authCheck && !this._authCheck()) {
      throw new StorageError(
        `Unauthorized: Authentication required to access ${this.entityName}`,
        401
      )
    }
  }

  protected _loadFromStorage(initialData: T[] | null): void {
    try {
      const stored = localStorage.getItem(this._storageKey)
      if (stored) {
        const items = JSON.parse(stored) as T[]
        for (const item of items) {
          const id = item[this.idField as keyof T]
          if (id !== undefined && id !== null) {
            this._data.set(String(id), { ...item })
          }
        }
      } else if (initialData && Array.isArray(initialData) && initialData.length > 0) {
        for (const item of initialData) {
          const id = item[this.idField as keyof T]
          if (id !== undefined && id !== null) {
            this._data.set(String(id), { ...item })
          }
        }
        this._persistToStorage()
      }
    } catch {
      if (initialData && Array.isArray(initialData)) {
        for (const item of initialData) {
          const id = item[this.idField as keyof T]
          if (id !== undefined && id !== null) {
            this._data.set(String(id), { ...item })
          }
        }
      }
    }
  }

  protected _persistToStorage(): void {
    try {
      const items = Array.from(this._data.values())
      localStorage.setItem(this._storageKey, JSON.stringify(items))
    } catch {
      // localStorage unavailable or quota exceeded, continue without persistence
    }
  }

  protected _getAll(): T[] {
    return Array.from(this._data.values())
  }

  async list(params: ListParams = {}): Promise<ListResult<T>> {
    this._checkAuth()
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {}, search } = params

    let items = this._getAll()

    // Apply filters using QueryExecutor (supports MongoDB-like operators)
    if (Object.keys(filters).length > 0) {
      items = QueryExecutor.execute(items, filters as Parameters<typeof QueryExecutor.execute>[1])
        .items as T[]
    }

    // Apply search (shared pipeline, #1192)
    items = searchItems(items, search as string | undefined)

    const total = items.length

    // Apply sorting + pagination (shared pipeline, #1192)
    sortItems(items, sort_by, sort_order)
    items = paginate(items, page, page_size)

    return { items, total }
  }

  async get(id: string | number): Promise<T> {
    this._checkAuth()
    const item = this._data.get(String(id))
    if (!item) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    return { ...item }
  }

  async getMany(ids: Array<string | number>): Promise<T[]> {
    this._checkAuth()
    if (!ids || ids.length === 0) return []
    const results: T[] = []
    for (const id of ids) {
      const item = this._data.get(String(id))
      if (item) {
        results.push({ ...item })
      }
    }
    return results
  }

  async distinct(field: string): Promise<unknown[]> {
    const values = new Set<unknown>()
    for (const item of this._data.values()) {
      const value = item[field as keyof T]
      if (value !== undefined && value !== null) {
        values.add(value)
      }
    }
    return Array.from(values).sort()
  }

  async distinctWithCount(field: string): Promise<Array<{ value: unknown; count: number }>> {
    const counts = new Map<unknown, number>()
    for (const item of this._data.values()) {
      const value = item[field as keyof T]
      if (value !== undefined && value !== null) {
        counts.set(value, (counts.get(value) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (a.value === null || a.value === undefined) return 1
        if (b.value === null || b.value === undefined) return -1
        if (a.value < b.value) return -1
        if (a.value > b.value) return 1
        return 0
      })
  }

  async create(data: Partial<T>): Promise<T> {
    this._checkAuth()
    const id =
      (data[this.idField as keyof T] as string | number | undefined) || this.generateId()
    const newItem = {
      ...data,
      [this.idField]: id,
      created_at: (data as Record<string, unknown>).created_at || new Date().toISOString(),
    } as unknown as T
    this._data.set(String(id), newItem)
    this._persistToStorage()
    return { ...newItem }
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    this._checkAuth()
    if (!this._data.has(String(id))) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    const updated = {
      ...data,
      [this.idField]: id,
      updated_at: new Date().toISOString(),
    } as unknown as T
    this._data.set(String(id), updated)
    this._persistToStorage()
    return { ...updated }
  }

  async patch(id: string | number, data: Partial<T>): Promise<T> {
    this._checkAuth()
    const existing = this._data.get(String(id))
    if (!existing) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    const updated = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    } as T
    this._data.set(String(id), updated)
    this._persistToStorage()
    return { ...updated }
  }

  async delete(id: string | number): Promise<void> {
    this._checkAuth()
    if (!this._data.has(String(id))) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    this._data.delete(String(id))
    this._persistToStorage()
  }

  async clear(): Promise<void> {
    this._data.clear()
    try {
      localStorage.removeItem(this._storageKey)
    } catch {
      // localStorage unavailable
    }
  }

  get size(): number {
    return this._data.size
  }

  get storageKey(): string {
    return this._storageKey
  }
}

/**
 * Factory function to create a MockApiStorage
 */
export function createMockApiStorage<T extends EntityRecord = EntityRecord>(
  options: MockApiStorageOptions<T>
): MockApiStorage<T> {
  return new MockApiStorage(options)
}
