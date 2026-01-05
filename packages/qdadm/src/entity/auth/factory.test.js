/**
 * Tests for auth factory and CompositeAuthAdapter
 */
import { describe, it, expect } from 'vitest'
import { EntityAuthAdapter } from './EntityAuthAdapter.js'
import { PermissiveAuthAdapter } from './PermissiveAdapter.js'
import { CompositeAuthAdapter } from './CompositeAuthAdapter.js'
import { authFactory, parseAuthPattern, authTypes } from './factory.js'

// Test adapter for custom types
class TestAuthAdapter extends EntityAuthAdapter {
  constructor(options = {}) {
    super()
    this.options = options
  }
  canPerform() { return true }
  canAccessRecord() { return true }
  getCurrentUser() { return { id: 'test' } }
}

// Adapter that tracks which entity was checked
class TrackingAdapter extends EntityAuthAdapter {
  constructor(name) {
    super()
    this.name = name
    this.checkedEntities = []
  }
  canPerform(entity, action) {
    this.checkedEntities.push({ entity, action })
    return true
  }
  canAccessRecord() { return true }
  getCurrentUser() { return { name: this.name } }
}

describe('parseAuthPattern', () => {
  it('parses simple type', () => {
    expect(parseAuthPattern('jwt')).toEqual({ type: 'jwt' })
    expect(parseAuthPattern('permissive')).toEqual({ type: 'permissive' })
  })

  it('parses type with scope', () => {
    expect(parseAuthPattern('jwt:internal')).toEqual({ type: 'jwt', scope: 'internal' })
    expect(parseAuthPattern('apikey:external')).toEqual({ type: 'apikey', scope: 'external' })
  })

  it('returns null for invalid input', () => {
    expect(parseAuthPattern(null)).toBeNull()
    expect(parseAuthPattern(123)).toBeNull()
    expect(parseAuthPattern('')).toBeNull()
  })
})

describe('authFactory', () => {
  describe('instance passthrough', () => {
    it('returns EntityAuthAdapter instance as-is', () => {
      const adapter = new PermissiveAuthAdapter()
      const result = authFactory(adapter)
      expect(result).toBe(adapter)
    })

    it('returns duck-typed adapter as-is', () => {
      const duckAdapter = {
        canPerform: () => true,
        canAccessRecord: () => true,
        getCurrentUser: () => null
      }
      const result = authFactory(duckAdapter)
      expect(result).toBe(duckAdapter)
    })
  })

  describe('null/undefined', () => {
    it('returns PermissiveAuthAdapter for null', () => {
      const result = authFactory(null)
      expect(result).toBeInstanceOf(PermissiveAuthAdapter)
    })

    it('returns PermissiveAuthAdapter for undefined', () => {
      const result = authFactory(undefined)
      expect(result).toBeInstanceOf(PermissiveAuthAdapter)
    })
  })

  describe('string patterns', () => {
    it('resolves built-in types', () => {
      const result = authFactory('permissive')
      expect(result).toBeInstanceOf(PermissiveAuthAdapter)
    })

    it('resolves custom types from context', () => {
      const result = authFactory('test', {
        authTypes: { test: TestAuthAdapter }
      })
      expect(result).toBeInstanceOf(TestAuthAdapter)
    })

    it('throws for unknown type', () => {
      expect(() => authFactory('unknown')).toThrow(/Unknown auth type/)
    })
  })

  describe('config objects', () => {
    it('resolves config with type', () => {
      const result = authFactory(
        { type: 'test', foo: 'bar' },
        { authTypes: { test: TestAuthAdapter } }
      )
      expect(result).toBeInstanceOf(TestAuthAdapter)
      expect(result.options.foo).toBe('bar')
    })

    it('throws for config without type or default', () => {
      expect(() => authFactory({ foo: 'bar' })).toThrow(/requires either "type" or "default"/)
    })
  })

  describe('composite config', () => {
    it('creates CompositeAuthAdapter from config', () => {
      const defaultAdapter = new PermissiveAuthAdapter()
      const result = authFactory(
        { default: defaultAdapter },
        { CompositeAuthAdapter }
      )
      expect(result).toBeInstanceOf(CompositeAuthAdapter)
    })

    it('throws without CompositeAuthAdapter in context', () => {
      const defaultAdapter = new PermissiveAuthAdapter()
      expect(() => authFactory({ default: defaultAdapter })).toThrow(/CompositeAuthAdapter/)
    })
  })
})

describe('CompositeAuthAdapter', () => {
  describe('routing', () => {
    it('uses default adapter for unmatched entities', () => {
      const defaultAdapter = new TrackingAdapter('default')
      const composite = new CompositeAuthAdapter({ default: defaultAdapter })

      composite.canPerform('books', 'read')
      composite.canPerform('users', 'create')

      expect(defaultAdapter.checkedEntities).toEqual([
        { entity: 'books', action: 'read' },
        { entity: 'users', action: 'create' }
      ])
    })

    it('routes exact matches to mapped adapter', () => {
      const defaultAdapter = new TrackingAdapter('default')
      const productsAdapter = new TrackingAdapter('products')

      const composite = new CompositeAuthAdapter({
        default: defaultAdapter,
        mapping: { products: productsAdapter }
      })

      composite.canPerform('books', 'read')
      composite.canPerform('products', 'read')

      expect(defaultAdapter.checkedEntities).toHaveLength(1)
      expect(defaultAdapter.checkedEntities[0].entity).toBe('books')

      expect(productsAdapter.checkedEntities).toHaveLength(1)
      expect(productsAdapter.checkedEntities[0].entity).toBe('products')
    })

    it('routes glob patterns to mapped adapter', () => {
      const defaultAdapter = new TrackingAdapter('default')
      const externalAdapter = new TrackingAdapter('external')

      const composite = new CompositeAuthAdapter({
        default: defaultAdapter,
        mapping: { 'external-*': externalAdapter }
      })

      composite.canPerform('books', 'read')
      composite.canPerform('external-products', 'read')
      composite.canPerform('external-orders', 'list')

      expect(defaultAdapter.checkedEntities).toHaveLength(1)
      expect(externalAdapter.checkedEntities).toHaveLength(2)
    })

    it('supports suffix glob patterns', () => {
      const defaultAdapter = new TrackingAdapter('default')
      const readonlyAdapter = new TrackingAdapter('readonly')

      const composite = new CompositeAuthAdapter({
        default: defaultAdapter,
        mapping: { '*-readonly': readonlyAdapter }
      })

      composite.canPerform('products-readonly', 'read')
      composite.canPerform('products', 'read')

      expect(readonlyAdapter.checkedEntities).toHaveLength(1)
      expect(defaultAdapter.checkedEntities).toHaveLength(1)
    })
  })

  describe('getCurrentUser', () => {
    it('returns user from default adapter', () => {
      const defaultAdapter = new TrackingAdapter('admin')
      const externalAdapter = new TrackingAdapter('service')

      const composite = new CompositeAuthAdapter({
        default: defaultAdapter,
        mapping: { 'external-*': externalAdapter }
      })

      expect(composite.getCurrentUser()).toEqual({ name: 'admin' })
    })
  })

  describe('factory integration', () => {
    it('resolves adapters in mapping via factory', () => {
      const defaultAdapter = new PermissiveAuthAdapter()

      const composite = new CompositeAuthAdapter(
        {
          default: defaultAdapter,
          mapping: {
            products: { type: 'test' }
          }
        },
        { authTypes: { test: TestAuthAdapter } }
      )

      // Products should use TestAuthAdapter
      expect(composite._getAdapter('products')).toBeInstanceOf(TestAuthAdapter)
      // Others use default
      expect(composite._getAdapter('books')).toBe(defaultAdapter)
    })
  })

  describe('getAdapterInfo', () => {
    it('returns debug info about adapters', () => {
      const composite = new CompositeAuthAdapter({
        default: new PermissiveAuthAdapter(),
        mapping: {
          products: new TestAuthAdapter(),
          'external-*': new TrackingAdapter('ext')
        }
      })

      const info = composite.getAdapterInfo()

      expect(info.default).toBe('PermissiveAuthAdapter')
      expect(info.exactMatches.products).toBe('TestAuthAdapter')
      expect(info.patterns).toHaveLength(1)
      expect(info.patterns[0].pattern).toBe('external-*')
      expect(info.patterns[0].adapter).toBe('TrackingAdapter')
    })
  })
})
