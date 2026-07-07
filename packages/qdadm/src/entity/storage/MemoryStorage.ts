import { IStorage } from './IStorage'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'
import { StorageError } from './errors'
import { sortItems, filterItems, paginate, defaultGenerateId } from '../../query/clientFilter'

/**
 * MemoryStorage options
 */
export interface MemoryStorageOptions<T extends EntityRecord = EntityRecord> {
  idField?: string
  generateId?: () => string
  initialData?: T[]
}

// StorageError moved to ./errors (#1192); re-exported for back-compat.
export { StorageError } from './errors'

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

  readonly idField: string
  readonly generateId: () => string
  protected _data: Map<string, T>

  constructor(options: MemoryStorageOptions<T> = {}) {
    super()
    const {
      idField = 'id',
      generateId = defaultGenerateId,
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

    // Apply filters (shared pipeline, #1192 — legacy substring semantics)
    items = filterItems(items, filters, { stringMatch: 'includes' })

    const total = items.length

    // Apply sorting + pagination (shared pipeline, #1192)
    sortItems(items, sort_by, sort_order)
    items = paginate(items, page, page_size)

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
