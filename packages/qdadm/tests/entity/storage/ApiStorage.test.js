/**
 * Unit tests for ApiStorage capabilities
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  ApiStorage,
  createApiStorage,
  getStorageCapabilities,
  DEFAULT_STORAGE_CAPABILITIES
} from '../../../src/entity/storage/index'

describe('ApiStorage', () => {
  describe('static capabilities', () => {
    it('declares supportsTotal as true', () => {
      expect(ApiStorage.capabilities.supportsTotal).toBe(true)
    })

    it('declares supportsFilters as true', () => {
      expect(ApiStorage.capabilities.supportsFilters).toBe(true)
    })

    it('declares supportsPagination as true', () => {
      expect(ApiStorage.capabilities.supportsPagination).toBe(true)
    })

    it('declares supportsCaching as true', () => {
      expect(ApiStorage.capabilities.supportsCaching).toBe(true)
    })

    it('is accessible via constructor.capabilities from instance', () => {
      const storage = new ApiStorage({ endpoint: '/test' })
      expect(storage.constructor.capabilities).toBe(ApiStorage.capabilities)
    })

    it('exposes all four capability properties', () => {
      const caps = ApiStorage.capabilities
      expect(Object.keys(caps).sort()).toEqual([
        'supportsCaching',
        'supportsFilters',
        'supportsPagination',
        'supportsTotal'
      ])
    })
  })

  describe('instance supportsCaching getter (backward-compat)', () => {
    it('returns true (delegates to static capabilities)', () => {
      const storage = new ApiStorage({ endpoint: '/test' })
      expect(storage.supportsCaching).toBe(true)
    })

    it('reflects the static capability value', () => {
      const storage = new ApiStorage({ endpoint: '/users' })
      expect(storage.supportsCaching).toBe(ApiStorage.capabilities.supportsCaching)
    })
  })

  describe('getStorageCapabilities helper', () => {
    it('returns merged capabilities with defaults', () => {
      const storage = new ApiStorage({ endpoint: '/test' })
      const caps = getStorageCapabilities(storage)

      expect(caps.supportsTotal).toBe(true)
      expect(caps.supportsFilters).toBe(true)
      expect(caps.supportsPagination).toBe(true)
      expect(caps.supportsCaching).toBe(true)
    })

    it('falls back to defaults for storage without capabilities', () => {
      const customStorage = { list: async () => ({ items: [], total: 0 }) }
      const caps = getStorageCapabilities(customStorage)

      expect(caps).toEqual(DEFAULT_STORAGE_CAPABILITIES)
    })
  })
})

describe('createApiStorage', () => {
  it('returns an ApiStorage instance', () => {
    const storage = createApiStorage({ endpoint: '/users' })
    expect(storage).toBeInstanceOf(ApiStorage)
  })

  it('has capabilities accessible via constructor', () => {
    const storage = createApiStorage({ endpoint: '/users' })
    expect(storage.constructor.capabilities.supportsTotal).toBe(true)
  })
})
