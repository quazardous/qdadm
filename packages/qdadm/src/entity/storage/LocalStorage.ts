import { IStorage } from './IStorage'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'
import { StorageError } from './MemoryStorage'

/**
 * LocalStorage options
 */
export interface LocalStorageOptions {
  key: string
  idField?: string
  generateId?: () => string
}

/**
 * LocalStorage - Browser localStorage storage adapter
 *
 * Implements the storage interface using browser localStorage.
 * Useful for offline-first applications, user preferences, draft saving.
 */
export class LocalStorage<T extends EntityRecord = EntityRecord> extends IStorage<T> {
  static storageName = 'LocalStorage'

  static capabilities: StorageCapabilities = {
    supportsTotal: true,
    supportsFilters: true,
    supportsPagination: true,
    supportsCaching: false,
  }

  /** @deprecated Use static LocalStorage.capabilities.supportsCaching instead */
  get supportsCaching(): boolean {
    return LocalStorage.capabilities.supportsCaching
  }

  readonly key: string
  readonly idField: string
  readonly generateId: () => string

  constructor(options: LocalStorageOptions) {
    super()
    const {
      key,
      idField = 'id',
      generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    } = options

    this.key = key
    this.idField = idField
    this.generateId = generateId
  }

  protected _getAll(): T[] {
    try {
      const stored = localStorage.getItem(this.key)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  protected _saveAll(items: T[]): void {
    localStorage.setItem(this.key, JSON.stringify(items))
  }

  async list(params: ListParams = {}): Promise<ListResult<T>> {
    const { page = 1, page_size = 20, sort_by, sort_order = 'asc', filters = {}, search } = params

    let items = this._getAll()

    // Apply filters (exact match for dropdown filters)
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue
      items = items.filter((item) => {
        const itemValue = item[key as keyof T]
        if (typeof value === 'string' && typeof itemValue === 'string') {
          return itemValue.toLowerCase() === value.toLowerCase()
        }
        return itemValue === value
      })
    }

    // Apply search (substring match on all string fields)
    if (search && typeof search === 'string' && search.trim()) {
      const query = search.toLowerCase().trim()
      items = items.filter((item) => {
        for (const value of Object.values(item)) {
          if (typeof value === 'string' && value.toLowerCase().includes(query)) {
            return true
          }
        }
        return false
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
    const items = this._getAll()
    const item = items.find((i) => i[this.idField as keyof T] === id)
    if (!item) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    return item
  }

  async getMany(ids: Array<string | number>): Promise<T[]> {
    if (!ids || ids.length === 0) return []
    const items = this._getAll()
    const idSet = new Set(ids)
    return items.filter((i) => idSet.has(i[this.idField as keyof T] as string | number))
  }

  async create(data: Partial<T>): Promise<T> {
    const items = this._getAll()
    const newItem = {
      ...data,
      [this.idField]: (data[this.idField as keyof T] as string | number) || this.generateId(),
      created_at: (data as Record<string, unknown>).created_at || new Date().toISOString(),
    } as unknown as T
    items.push(newItem)
    this._saveAll(items)
    return newItem
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    const items = this._getAll()
    const index = items.findIndex((i) => i[this.idField as keyof T] === id)
    if (index === -1) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    const updated = {
      ...data,
      [this.idField]: id,
      updated_at: new Date().toISOString(),
    } as unknown as T
    items[index] = updated
    this._saveAll(items)
    return updated
  }

  async patch(id: string | number, data: Partial<T>): Promise<T> {
    const items = this._getAll()
    const index = items.findIndex((i) => i[this.idField as keyof T] === id)
    if (index === -1) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    const updated = {
      ...items[index],
      ...data,
      updated_at: new Date().toISOString(),
    } as unknown as T
    items[index] = updated
    this._saveAll(items)
    return updated
  }

  async delete(id: string | number): Promise<void> {
    const items = this._getAll()
    const index = items.findIndex((i) => i[this.idField as keyof T] === id)
    if (index === -1) {
      throw new StorageError(`Entity not found: ${id}`, 404)
    }
    items.splice(index, 1)
    this._saveAll(items)
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key)
  }

  reset(): void {
    localStorage.removeItem(this.key)
  }
}

export function createLocalStorage<T extends EntityRecord = EntityRecord>(
  options: LocalStorageOptions
): LocalStorage<T> {
  return new LocalStorage(options)
}
