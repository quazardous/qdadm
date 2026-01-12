/**
 * IStorage - Base class for storage adapters
 *
 * Provides instanceof checking for storageFactory.
 * All storage adapters should extend this class.
 *
 * Usage:
 * ```ts
 * class MyStorage extends IStorage<MyEntity> {
 *   static capabilities = { supportsTotal: true, ... }
 *   async list(params) { ... }
 *   async get(id) { ... }
 *   async create(data) { ... }
 *   async update(id, data) { ... }
 *   async delete(id) { ... }
 * }
 * ```
 */

import type { EntityRecord, ListParams, ListResult, StorageCapabilities } from '../../types'

/**
 * Abstract base class for storage adapters
 */
export abstract class IStorage<T extends EntityRecord = EntityRecord> {
  /**
   * Default capabilities - override in subclass
   */
  static capabilities: StorageCapabilities = {
    supportsTotal: false,
    supportsFilters: false,
    supportsPagination: false,
    supportsCaching: false,
  }

  /**
   * List entities with optional filtering/pagination
   * @param params - Query parameters
   * @param _context - Optional context (e.g., parent entity)
   * @returns Promise with items array and optional total count
   */
  async list(_params: ListParams = {}, _context?: unknown): Promise<ListResult<T>> {
    throw new Error('list() not implemented')
  }

  /**
   * Get single entity by ID
   * @param _id - Entity ID
   * @param _context - Optional context
   * @returns Promise with entity or null if not found
   */
  async get(_id: string | number, _context?: unknown): Promise<T | null> {
    throw new Error('get() not implemented')
  }

  /**
   * Create new entity
   * @param _data - Entity data
   * @returns Promise with created entity including ID
   */
  async create(_data: Partial<T>): Promise<T> {
    throw new Error('create() not implemented')
  }

  /**
   * Update entity by ID (full replacement)
   * @param _id - Entity ID
   * @param _data - Updated data
   * @returns Promise with updated entity
   */
  async update(_id: string | number, _data: Partial<T>): Promise<T> {
    throw new Error('update() not implemented')
  }

  /**
   * Patch entity by ID (partial update)
   * @param _id - Entity ID
   * @param _data - Partial data to merge
   * @returns Promise with updated entity
   */
  async patch(_id: string | number, _data: Partial<T>): Promise<T> {
    throw new Error('patch() not implemented')
  }

  /**
   * Delete entity by ID
   * @param _id - Entity ID
   * @returns Promise that resolves when deleted
   */
  async delete(_id: string | number): Promise<void> {
    throw new Error('delete() not implemented')
  }

  /**
   * Reset storage state (for testing/development)
   */
  reset(): void {
    // Default no-op, override if needed
  }
}
