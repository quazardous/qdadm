/**
 * Unit tests for LocalStorage capabilities
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  LocalStorage,
  createLocalStorage,
  getStorageCapabilities
} from '../../../src/entity/storage/index'

describe('LocalStorage', () => {
  describe('static capabilities', () => {
    it('declares supportsTotal as true', () => {
      expect(LocalStorage.capabilities.supportsTotal).toBe(true)
    })

    it('declares supportsFilters as true', () => {
      expect(LocalStorage.capabilities.supportsFilters).toBe(true)
    })

    it('declares supportsPagination as true', () => {
      expect(LocalStorage.capabilities.supportsPagination).toBe(true)
    })

    it('declares supportsCaching as false (already local)', () => {
      expect(LocalStorage.capabilities.supportsCaching).toBe(false)
    })

    it('is accessible via constructor.capabilities from instance', () => {
      const storage = new LocalStorage({ key: 'test' })
      expect(storage.constructor.capabilities).toBe(LocalStorage.capabilities)
    })

    it('exposes all four capability properties', () => {
      const caps = LocalStorage.capabilities
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
      const storage = new LocalStorage({ key: 'test' })
      expect(storage.supportsCaching).toBe(false)
    })

    it('reflects the static capability value', () => {
      const storage = new LocalStorage({ key: 'test' })
      expect(storage.supportsCaching).toBe(LocalStorage.capabilities.supportsCaching)
    })
  })

  describe('getStorageCapabilities helper', () => {
    it('returns merged capabilities with defaults', () => {
      const storage = new LocalStorage({ key: 'test' })
      const caps = getStorageCapabilities(storage)

      expect(caps.supportsTotal).toBe(true)
      expect(caps.supportsFilters).toBe(true)
      expect(caps.supportsPagination).toBe(true)
      expect(caps.supportsCaching).toBe(false)
    })
  })
})

describe('createLocalStorage', () => {
  it('returns a LocalStorage instance', () => {
    const storage = createLocalStorage({ key: 'test' })
    expect(storage).toBeInstanceOf(LocalStorage)
  })

  it('has capabilities accessible via constructor', () => {
    const storage = createLocalStorage({ key: 'test' })
    expect(storage.constructor.capabilities.supportsTotal).toBe(true)
    expect(storage.constructor.capabilities.supportsCaching).toBe(false)
  })
})
