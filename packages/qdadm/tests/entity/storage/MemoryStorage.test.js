/**
 * Unit tests for MemoryStorage capabilities
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  MemoryStorage,
  createMemoryStorage,
  getStorageCapabilities,
  DEFAULT_STORAGE_CAPABILITIES
} from '../../../src/entity/storage/index'

describe('MemoryStorage', () => {
  describe('static capabilities', () => {
    it('declares supportsTotal as true', () => {
      expect(MemoryStorage.capabilities.supportsTotal).toBe(true)
    })

    it('declares supportsFilters as true', () => {
      expect(MemoryStorage.capabilities.supportsFilters).toBe(true)
    })

    it('declares supportsPagination as true', () => {
      expect(MemoryStorage.capabilities.supportsPagination).toBe(true)
    })

    it('declares supportsCaching as false (already in-memory)', () => {
      expect(MemoryStorage.capabilities.supportsCaching).toBe(false)
    })

    it('is accessible via constructor.capabilities from instance', () => {
      const storage = new MemoryStorage()
      expect(storage.constructor.capabilities).toBe(MemoryStorage.capabilities)
    })

    it('exposes all four capability properties', () => {
      const caps = MemoryStorage.capabilities
      expect(Object.keys(caps).sort()).toEqual([
        'supportsCaching',
        'supportsFilters',
        'supportsPagination',
        'supportsTotal'
      ])
    })
  })

  describe('instance supportsCaching getter (backward-compat)', () => {
    it('returns false (delegates to static capabilities)', () => {
      const storage = new MemoryStorage()
      expect(storage.supportsCaching).toBe(false)
    })

    it('reflects the static capability value', () => {
      const storage = new MemoryStorage()
      expect(storage.supportsCaching).toBe(MemoryStorage.capabilities.supportsCaching)
    })
  })

  describe('getStorageCapabilities helper', () => {
    it('returns merged capabilities with defaults', () => {
      const storage = new MemoryStorage()
      const caps = getStorageCapabilities(storage)

      expect(caps.supportsTotal).toBe(true)
      expect(caps.supportsFilters).toBe(true)
      expect(caps.supportsPagination).toBe(true)
      expect(caps.supportsCaching).toBe(false)
    })
  })
})

describe('createMemoryStorage', () => {
  it('returns a MemoryStorage instance', () => {
    const storage = createMemoryStorage()
    expect(storage).toBeInstanceOf(MemoryStorage)
  })

  it('has capabilities accessible via constructor', () => {
    const storage = createMemoryStorage()
    expect(storage.constructor.capabilities.supportsTotal).toBe(true)
    expect(storage.constructor.capabilities.supportsCaching).toBe(false)
  })
})
