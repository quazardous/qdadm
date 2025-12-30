/**
 * Unit tests for SdkStorage capabilities
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { SdkStorage, createSdkStorage } from '../../../src/entity/storage/SdkStorage.js'
import { getStorageCapabilities, DEFAULT_STORAGE_CAPABILITIES } from '../../../src/entity/storage/index.js'

describe('SdkStorage', () => {
  describe('static capabilities', () => {
    it('exposes static capabilities object', () => {
      expect(SdkStorage.capabilities).toBeDefined()
      expect(typeof SdkStorage.capabilities).toBe('object')
    })

    it('declares supportsTotal: true', () => {
      expect(SdkStorage.capabilities.supportsTotal).toBe(true)
    })

    it('declares supportsFilters: true', () => {
      expect(SdkStorage.capabilities.supportsFilters).toBe(true)
    })

    it('declares supportsPagination: true', () => {
      expect(SdkStorage.capabilities.supportsPagination).toBe(true)
    })

    it('declares supportsCaching: true', () => {
      expect(SdkStorage.capabilities.supportsCaching).toBe(true)
    })
  })

  describe('capabilities via constructor', () => {
    it('can access capabilities via instance.constructor.capabilities', () => {
      const storage = new SdkStorage({ sdk: {}, methods: {} })
      expect(storage.constructor.capabilities).toBe(SdkStorage.capabilities)
    })

    it('capabilities are identical for all instances', () => {
      const storage1 = new SdkStorage({ sdk: {}, methods: {} })
      const storage2 = new SdkStorage({ sdk: {}, methods: {} })
      expect(storage1.constructor.capabilities).toBe(storage2.constructor.capabilities)
    })
  })

  describe('getStorageCapabilities helper', () => {
    it('returns merged capabilities for SdkStorage instance', () => {
      const storage = new SdkStorage({ sdk: {}, methods: {} })
      const caps = getStorageCapabilities(storage)

      expect(caps.supportsTotal).toBe(true)
      expect(caps.supportsFilters).toBe(true)
      expect(caps.supportsPagination).toBe(true)
      expect(caps.supportsCaching).toBe(true)
    })

    it('returns SdkStorage capabilities matching static declaration', () => {
      const storage = new SdkStorage({ sdk: {}, methods: {} })
      const caps = getStorageCapabilities(storage)

      expect(caps).toEqual({
        ...DEFAULT_STORAGE_CAPABILITIES,
        ...SdkStorage.capabilities
      })
    })
  })

  describe('backward-compat instance getter', () => {
    it('supportsCaching instance getter returns true', () => {
      const storage = new SdkStorage({ sdk: {}, methods: {} })
      expect(storage.supportsCaching).toBe(true)
    })

    it('supportsCaching getter delegates to static capabilities', () => {
      const storage = new SdkStorage({ sdk: {}, methods: {} })
      expect(storage.supportsCaching).toBe(SdkStorage.capabilities.supportsCaching)
    })
  })

  describe('createSdkStorage factory', () => {
    it('returns instance with accessible capabilities', () => {
      const storage = createSdkStorage({ sdk: {}, methods: {} })
      expect(storage.constructor.capabilities).toBe(SdkStorage.capabilities)
    })
  })
})
