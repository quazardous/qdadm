import { IStorage } from './IStorage'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'

/**
 * MemoryStorage options
 */
export interface MemoryStorageOptions<T extends EntityRecord = EntityRecord> {
  idField?: string
  generateId?: () => string
  initialData?: T[]
}

/**
 * Storage error with HTTP-like status
 */
export class StorageError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'StorageError'
  }
}

/**
 * MemoryStorage - In-memory storage adapter
 *
 * Implements the storage interface using in-memory Map.
 * Useful for testing, ephemeral data, caching layer.
 */
export class MemoryStorage<T extends EntityRecord = EntityRecord> extends IStorage<T> {
  static storageName = 'MemoryStorage'

  static capabilities: StorageCapabilities = {
    supportsTotal: true,
    supportsFilters: true,
    supportsPagination: true,
    supportsCaching: false,
  }

  /** @deprecated Use static MemoryStorage.capabilities.supportsCaching instead */
  get supportsCaching(): boolean {
    return MemoryStorage.capabilities.supportsCaching
  }

  readonly idField: string
  readonly generateId: () => string
  protected _data: Map<string, T>

  constructor(options: MemoryStorageOptions<T> = {}) {
    super()
    const {
      idField = 'id',
      generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2),
      initialData = [],
    } = options

    this.idField = idField
    this.generateId = generateId
    this._data = new Map()

    // Initialize with initial data
    for (const item of initialData) {
      const id = item[idField as keyof T]
      if (id) {
        this._data.set(String(id), { ...item })
      }
    }
  }

  protected _getAll(): T[] {
    return Array.from(this._data.values())
  }

  async list(params: ListParams = {}): Promise<ListResult<T>> {
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {} } = params

    let items = this._getAll()

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      items = items.filter((item) => {
        const itemValue = item[key as keyof T]
        if (typeof value === 'string' && typeof itemValue === 'string') {
          return itemValue.toLowerCase().includes(value.toLowerCase())
        }
        return itemValue === value
      })
    }

    const total = items.length

    // Apply sorting
    if (sort_by) {
      items.sort((a, b) => {
        const aVal = a[sort_by as keyof T]
        const bVal = b[sort_by as keyof T]
        if (aVal === undefined || aVal === null) return 1
        if (bVal === undefined || bVal === null) return -1
        if (aVal < bVal) return sort_order === 'asc' ? -1 : 1
        if (aVal > bVal) return sort_order === 'asc' ? 1 : -1
        return 0
      })
    }

    // Apply pagination
    const start = (page - 1) * page_size
    items = items.slice(start, start + page_size)

    return { items, total }
  }

  async get(id: string | number): Promise<T> {
    const item = this._data.get(String(id))
    if (!item) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    return { ...item }
  }

  async create(data: Partial<T>): Promise<T> {
    const id = (data[this.idField as keyof T] as string | number) || this.generateId()
    const newItem = {
      ...data,
      [this.idField]: id,
      created_at: (data as Record<string, unknown>).created_at || new Date().toISOString(),
    } as unknown as T
    this._data.set(String(id), newItem)
    return { ...newItem }
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    if (!this._data.has(String(id))) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    const updated = {
      ...data,
      [this.idField]: id,
      updated_at: new Date().toISOString(),
    } as unknown as T
    this._data.set(String(id), updated)
    return { ...updated }
  }

  async patch(id: string | number, data: Partial<T>): Promise<T> {
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
    return { ...updated }
  }

  async delete(id: string | number): Promise<void> {
    if (!this._data.has(String(id))) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    this._data.delete(String(id))
  }

  async clear(): Promise<void> {
    this._data.clear()
  }

  get size(): number {
    return this._data.size
  }

  reset(): void {
    this._data.clear()
  }
}

export function createMemoryStorage<T extends EntityRecord = EntityRecord>(
  options?: MemoryStorageOptions<T>
): MemoryStorage<T> {
  return new MemoryStorage(options)
}
