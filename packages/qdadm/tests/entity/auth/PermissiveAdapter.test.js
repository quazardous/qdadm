/**
 * Unit tests for PermissiveAuthAdapter
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import {
  PermissiveAuthAdapter,
  createPermissiveAdapter,
  EntityAuthAdapter,
  AuthActions
} from '../../../src/entity/auth/index.js'

describe('PermissiveAuthAdapter', () => {
  describe('inheritance', () => {
    it('extends EntityAuthAdapter', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter).toBeInstanceOf(EntityAuthAdapter)
    })
  })

  describe('canPerform', () => {
    it('returns true for read action', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canPerform('users', AuthActions.READ)).toBe(true)
    })

    it('returns true for create action', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canPerform('invoices', AuthActions.CREATE)).toBe(true)
    })

    it('returns true for update action', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canPerform('products', AuthActions.UPDATE)).toBe(true)
    })

    it('returns true for delete action', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canPerform('users', AuthActions.DELETE)).toBe(true)
    })

    it('returns true for list action', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canPerform('orders', AuthActions.LIST)).toBe(true)
    })

    it('returns true for any entity name', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canPerform('any_entity', 'any_action')).toBe(true)
      expect(adapter.canPerform('', '')).toBe(true)
      expect(adapter.canPerform(null, null)).toBe(true)
    })
  })

  describe('canAccessRecord', () => {
    it('returns true for any record', () => {
      const adapter = new PermissiveAuthAdapter()
      const record = { id: 123, owner_id: 456, secret: true }
      expect(adapter.canAccessRecord('invoices', record)).toBe(true)
    })

    it('returns true for empty record', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canAccessRecord('users', {})).toBe(true)
    })

    it('returns true for null record', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canAccessRecord('users', null)).toBe(true)
    })

    it('returns true regardless of entity type', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.canAccessRecord('', { id: 1 })).toBe(true)
      expect(adapter.canAccessRecord(null, { id: 1 })).toBe(true)
    })
  })

  describe('getCurrentUser', () => {
    it('returns null', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.getCurrentUser()).toBeNull()
    })

    it('always returns null on repeated calls', () => {
      const adapter = new PermissiveAuthAdapter()
      expect(adapter.getCurrentUser()).toBeNull()
      expect(adapter.getCurrentUser()).toBeNull()
    })
  })
})

describe('createPermissiveAdapter', () => {
  it('returns a PermissiveAuthAdapter instance', () => {
    const adapter = createPermissiveAdapter()
    expect(adapter).toBeInstanceOf(PermissiveAuthAdapter)
  })

  it('returns a new instance each time', () => {
    const adapter1 = createPermissiveAdapter()
    const adapter2 = createPermissiveAdapter()
    expect(adapter1).not.toBe(adapter2)
  })
})

describe('EntityAuthAdapter base class', () => {
  it('canPerform delegates to isGranted when no SecurityChecker (permissive)', () => {
    const adapter = new EntityAuthAdapter()
    // Without SecurityChecker, isGranted returns true (permissive)
    expect(adapter.canPerform('users', 'read')).toBe(true)
    expect(adapter.canPerform('users', 'delete')).toBe(true)
  })

  it('canAccessRecord delegates to isGranted when no SecurityChecker (permissive)', () => {
    const adapter = new EntityAuthAdapter()
    // Without SecurityChecker, isGranted returns true (permissive)
    expect(adapter.canAccessRecord('users', { id: 1 })).toBe(true)
  })

  it('getCurrentUser returns null when no callback provided', () => {
    const adapter = new EntityAuthAdapter()
    expect(adapter.getCurrentUser()).toBeNull()
  })

  it('getCurrentUser uses callback when provided', () => {
    const user = { id: 1, name: 'Test User' }
    const adapter = new EntityAuthAdapter({
      getCurrentUser: () => user
    })
    expect(adapter.getCurrentUser()).toBe(user)
  })

  it('getCurrentUser callback can return null', () => {
    const adapter = new EntityAuthAdapter({
      getCurrentUser: () => null
    })
    expect(adapter.getCurrentUser()).toBeNull()
  })
})

describe('AuthActions enum', () => {
  it('contains expected actions', () => {
    expect(AuthActions.READ).toBe('read')
    expect(AuthActions.CREATE).toBe('create')
    expect(AuthActions.UPDATE).toBe('update')
    expect(AuthActions.DELETE).toBe('delete')
    expect(AuthActions.LIST).toBe('list')
  })

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(AuthActions)).toBe(true)
  })

  it('cannot be modified', () => {
    expect(() => {
      AuthActions.CUSTOM = 'custom'
    }).toThrow()
  })
})
