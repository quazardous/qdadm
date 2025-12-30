/**
 * Unit tests for MockApiStorage capabilities
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  MockApiStorage,
  createMockApiStorage,
  getStorageCapabilities
} from '../../../src/entity/storage/index.js'

describe('MockApiStorage', () => {
  describe('static capabilities', () => {
    it('declares supportsTotal as true', () => {
      expect(MockApiStorage.capabilities.supportsTotal).toBe(true)
    })

    it('declares supportsFilters as true', () => {
      expect(MockApiStorage.capabilities.supportsFilters).toBe(true)
    })

    it('declares supportsPagination as true', () => {
      expect(MockApiStorage.capabilities.supportsPagination).toBe(true)
    })

    it('declares supportsCaching as false (already in-memory)', () => {
      expect(MockApiStorage.capabilities.supportsCaching).toBe(false)
    })

    it('is accessible via constructor.capabilities from instance', () => {
      const storage = new MockApiStorage({ entityName: 'test' })
      expect(storage.constructor.capabilities).toBe(MockApiStorage.capabilities)
    })

    it('exposes all four capability properties', () => {
      const caps = MockApiStorage.capabilities
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
      const storage = new MockApiStorage({ entityName: 'test' })
      expect(storage.supportsCaching).toBe(false)
    })

    it('reflects the static capability value', () => {
      const storage = new MockApiStorage({ entityName: 'test' })
      expect(storage.supportsCaching).toBe(MockApiStorage.capabilities.supportsCaching)
    })
  })

  describe('getStorageCapabilities helper', () => {
    it('returns merged capabilities with defaults', () => {
      const storage = new MockApiStorage({ entityName: 'test' })
      const caps = getStorageCapabilities(storage)

      expect(caps.supportsTotal).toBe(true)
      expect(caps.supportsFilters).toBe(true)
      expect(caps.supportsPagination).toBe(true)
      expect(caps.supportsCaching).toBe(false)
    })
  })
})

describe('createMockApiStorage', () => {
  it('returns a MockApiStorage instance', () => {
    const storage = createMockApiStorage({ entityName: 'test' })
    expect(storage).toBeInstanceOf(MockApiStorage)
  })

  it('has capabilities accessible via constructor', () => {
    const storage = createMockApiStorage({ entityName: 'test' })
    expect(storage.constructor.capabilities.supportsTotal).toBe(true)
    expect(storage.constructor.capabilities.supportsCaching).toBe(false)
  })
})
