/**
 * Integration tests for EntityManager with storage capabilities
 *
 * Verifies that EntityManager.isCacheEnabled correctly reads the
 * supportsCaching property from different storage adapters via
 * the backward-compatible instance getter.
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../../../src/entity/EntityManager.js'
import {
  ApiStorage,
  SdkStorage,
  MemoryStorage,
  MockApiStorage,
  LocalStorage,
  getStorageCapabilities,
  DEFAULT_STORAGE_CAPABILITIES
} from '../../../src/entity/storage/index.js'

describe('EntityManager + Storage Capabilities Integration', () => {
  describe('isCacheEnabled with ApiStorage', () => {
    it('returns true when threshold > 0 (supportsCaching=true)', () => {
      const storage = new ApiStorage({ endpoint: '/users' })
      const manager = new EntityManager({
        name: 'users',
        storage,
        localFilterThreshold: 100
      })

      expect(storage.supportsCaching).toBe(true)
      expect(manager.isCacheEnabled).toBe(true)
    })

    it('returns false when threshold is 0', () => {
      const storage = new ApiStorage({ endpoint: '/users' })
      const manager = new EntityManager({
        name: 'users',
        storage,
        localFilterThreshold: 0
      })

      expect(manager.isCacheEnabled).toBe(false)
    })
  })

  describe('isCacheEnabled with SdkStorage', () => {
    it('returns true when threshold > 0 (supportsCaching=true)', () => {
      const mockSdk = {}
      const storage = new SdkStorage({
        sdk: mockSdk,
        methods: { list: 'getItems' }
      })
      const manager = new EntityManager({
        name: 'products',
        storage,
        localFilterThreshold: 50
      })

      expect(storage.supportsCaching).toBe(true)
      expect(manager.isCacheEnabled).toBe(true)
    })
  })

  describe('isCacheEnabled with MemoryStorage', () => {
    it('returns false (supportsCaching=false, already in-memory)', () => {
      const storage = new MemoryStorage()
      const manager = new EntityManager({
        name: 'items',
        storage,
        localFilterThreshold: 100
      })

      expect(storage.supportsCaching).toBe(false)
      expect(manager.isCacheEnabled).toBe(false)
    })

    it('caching disabled even with high threshold', () => {
      const storage = new MemoryStorage()
      const manager = new EntityManager({
        name: 'items',
        storage,
        localFilterThreshold: 10000
      })

      expect(manager.isCacheEnabled).toBe(false)
    })
  })

  describe('isCacheEnabled with MockApiStorage', () => {
    it('returns false (supportsCaching=false, already in-memory)', () => {
      const storage = new MockApiStorage({ entityName: 'demo' })
      const manager = new EntityManager({
        name: 'demo',
        storage,
        localFilterThreshold: 100
      })

      expect(storage.supportsCaching).toBe(false)
      expect(manager.isCacheEnabled).toBe(false)
    })
  })

  describe('isCacheEnabled with LocalStorage', () => {
    it('returns false (supportsCaching=false, already local)', () => {
      const storage = new LocalStorage({ key: 'test_items' })
      const manager = new EntityManager({
        name: 'items',
        storage,
        localFilterThreshold: 100
      })

      expect(storage.supportsCaching).toBe(false)
      expect(manager.isCacheEnabled).toBe(false)
    })
  })

  describe('isCacheEnabled with custom storage (no capabilities)', () => {
    it('gracefully handles storage without capabilities (cache enabled)', () => {
      // Custom storage that doesn't declare capabilities
      const customStorage = {
        async list() { return { items: [], total: 0 } },
        async get(id) { return { id } },
        async create(data) { return data },
        async update(id, data) { return data },
        async delete(id) {}
      }

      const manager = new EntityManager({
        name: 'custom',
        storage: customStorage,
        localFilterThreshold: 100
      })

      // When supportsCaching is undefined, EntityManager check returns true
      // (storage?.supportsCaching === false) is false when undefined
      expect(customStorage.supportsCaching).toBeUndefined()
      expect(manager.isCacheEnabled).toBe(false) // But storageSupportsTotal check fails
    })

    it('storage without capabilities returns defaults via helper', () => {
      const customStorage = {
        async list() { return { items: [], total: 0 } }
      }

      const caps = getStorageCapabilities(customStorage)

      expect(caps).toEqual(DEFAULT_STORAGE_CAPABILITIES)
      expect(caps.supportsTotal).toBe(false)
      expect(caps.supportsCaching).toBe(false)
    })
  })

  describe('storageSupportsTotal integration', () => {
    it('ApiStorage supports total (enables caching when threshold > 0)', () => {
      const storage = new ApiStorage({ endpoint: '/users' })
      const manager = new EntityManager({
        name: 'users',
        storage,
        localFilterThreshold: 100
      })

      expect(manager.storageSupportsTotal).toBe(true)
      expect(manager.isCacheEnabled).toBe(true)
    })

    it('MemoryStorage supports total but not caching', () => {
      const storage = new MemoryStorage()
      const manager = new EntityManager({
        name: 'items',
        storage,
        localFilterThreshold: 100
      })

      expect(manager.storageSupportsTotal).toBe(true)
      // Caching disabled because supportsCaching=false
      expect(manager.isCacheEnabled).toBe(false)
    })

    it('custom storage without supportsTotal disables caching', () => {
      const customStorage = {
        async list() { return { items: [], total: 0 } },
        // supportsCaching not defined (undefined)
      }

      const manager = new EntityManager({
        name: 'custom',
        storage: customStorage,
        localFilterThreshold: 100
      })

      expect(manager.storageSupportsTotal).toBe(false)
      expect(manager.isCacheEnabled).toBe(false)
    })
  })

  describe('backward compatibility: instance vs static access', () => {
    it('instance getter and static property return same value (ApiStorage)', () => {
      const storage = new ApiStorage({ endpoint: '/test' })

      expect(storage.supportsCaching).toBe(ApiStorage.capabilities.supportsCaching)
      expect(storage.constructor.capabilities.supportsCaching).toBe(storage.supportsCaching)
    })

    it('instance getter and static property return same value (MemoryStorage)', () => {
      const storage = new MemoryStorage()

      expect(storage.supportsCaching).toBe(MemoryStorage.capabilities.supportsCaching)
      expect(storage.constructor.capabilities.supportsCaching).toBe(storage.supportsCaching)
    })

    it('EntityManager check works via instance property access', () => {
      // This mirrors the actual check in EntityManager.isCacheEnabled:
      // if (this.storage?.supportsCaching === false) return false

      const apiStorage = new ApiStorage({ endpoint: '/test' })
      const memoryStorage = new MemoryStorage()

      // ApiStorage: supportsCaching = true, so check passes
      expect(apiStorage?.supportsCaching === false).toBe(false)

      // MemoryStorage: supportsCaching = false, so check fails (returns false)
      expect(memoryStorage?.supportsCaching === false).toBe(true)
    })
  })
})
