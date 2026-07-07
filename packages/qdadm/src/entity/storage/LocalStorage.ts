import { IStorage } from './IStorage'
import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'
import { StorageError } from './errors'
import { sortItems, filterItems, searchItems, paginate, defaultGenerateId } from '../../query/clientFilter'

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

  readonly key: string
  readonly idField: string
  readonly generateId: () => string

  constructor(options: LocalStorageOptions) {
    super()
    const {
      key,
      idField = 'id',
      generateId = defaultGenerateId,
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

    // Apply filters (shared pipeline, #1192 — legacy exact-match semantics)
    items = filterItems(items, filters, { stringMatch: 'exact' })

    // Apply search (shared pipeline, #1192)
    items = searchItems(items, search as string | undefined)

    const total = items.length

    // Apply sorting + pagination (shared pipeline, #1192)
    sortItems(items, sort_by, sort_order)
    items = paginate(items, page, page_size)

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
