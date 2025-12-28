/**
 * Unit tests for EntityManager decorator utilities
 *
 * Tests createDecoratedManager and decorator factories:
 * - withAuditLog
 * - withSoftDelete
 * - withTimestamps
 * - withValidation
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createDecoratedManager,
  withAuditLog,
  withSoftDelete,
  withTimestamps,
  withValidation,
} from '../../src/core/decorator.js'

/**
 * Mock storage for testing CRUD operations
 */
class MockStorage {
  constructor() {
    this.items = new Map()
    this.nextId = 1
  }

  async create(data) {
    const id = this.nextId++
    const item = { id, ...data }
    this.items.set(id, item)
    return item
  }

  async update(id, data) {
    const item = { id, ...data }
    this.items.set(id, item)
    return item
  }

  async patch(id, data) {
    const existing = this.items.get(id) || { id }
    const item = { ...existing, ...data }
    this.items.set(id, item)
    return item
  }

  async delete(id) {
    this.items.delete(id)
  }

  async list() {
    return { items: Array.from(this.items.values()), total: this.items.size }
  }
}

/**
 * Create a mock EntityManager for testing
 */
function createMockManager(name = 'books') {
  const storage = new MockStorage()
  return {
    name,
    idField: 'id',
    storage,

    async list(params = {}) {
      return storage.list(params)
    },

    async get(id) {
      return storage.items.get(id)
    },

    async create(data) {
      return storage.create(data)
    },

    async update(id, data) {
      return storage.update(id, data)
    },

    async patch(id, data) {
      return storage.patch(id, data)
    },

    async delete(id) {
      return storage.delete(id)
    }
  }
}

describe('createDecoratedManager', () => {
  describe('validation', () => {
    it('throws when manager is missing', () => {
      expect(() => createDecoratedManager(null, [])).toThrow('[createDecoratedManager] Manager is required')
    })

    it('throws when decorators is not an array', () => {
      const manager = createMockManager()
      expect(() => createDecoratedManager(manager, 'not-array')).toThrow('[createDecoratedManager] Decorators must be an array')
    })

    it('throws when decorator is not a function', () => {
      const manager = createMockManager()
      expect(() => createDecoratedManager(manager, ['not-a-function'])).toThrow('[createDecoratedManager] Each decorator must be a function')
    })
  })

  describe('no decorators', () => {
    it('returns the original manager when no decorators provided', () => {
      const manager = createMockManager()
      const result = createDecoratedManager(manager, [])
      expect(result).toBe(manager)
    })
  })

  describe('single decorator', () => {
    it('applies a single decorator', async () => {
      const manager = createMockManager()
      const calls = []

      const trackingDecorator = (m) => ({
        ...m,
        async create(data) {
          calls.push('before')
          const result = await m.create(data)
          calls.push('after')
          return result
        }
      })

      const decorated = createDecoratedManager(manager, [trackingDecorator])
      await decorated.create({ title: 'Test' })

      expect(calls).toEqual(['before', 'after'])
    })
  })

  describe('stacked decorators', () => {
    it('applies decorators in order (first wraps base, last is outermost)', async () => {
      const manager = createMockManager()
      const order = []

      const decoratorA = (m) => ({
        ...m,
        async create(data) {
          order.push('A-before')
          const result = await m.create(data)
          order.push('A-after')
          return result
        }
      })

      const decoratorB = (m) => ({
        ...m,
        async create(data) {
          order.push('B-before')
          const result = await m.create(data)
          order.push('B-after')
          return result
        }
      })

      // B wraps A wraps manager
      const decorated = createDecoratedManager(manager, [decoratorA, decoratorB])
      await decorated.create({ title: 'Test' })

      // B is outermost, so executes first
      expect(order).toEqual(['B-before', 'A-before', 'A-after', 'B-after'])
    })

    it('preserves manager name through decorators', () => {
      const manager = createMockManager('books')

      const decorator = (m) => ({
        ...m,
        get name() { return m.name }
      })

      const decorated = createDecoratedManager(manager, [decorator, decorator])
      expect(decorated.name).toBe('books')
    })
  })
})

describe('withAuditLog', () => {
  describe('validation', () => {
    it('throws when logger is not a function', () => {
      expect(() => withAuditLog('not-a-function')).toThrow('[withAuditLog] Logger must be a function')
    })
  })

  describe('create', () => {
    it('logs create action with entity name and id', async () => {
      const logs = []
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withAuditLog((action, details) => logs.push({ action, ...details }))
      ])

      await decorated.create({ title: 'Test Book' })

      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('create')
      expect(logs[0].entity).toBe('books')
      expect(logs[0].id).toBe(1)
      expect(logs[0].timestamp).toBeDefined()
    })

    it('includes data when includeData option is true', async () => {
      const logs = []
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withAuditLog((action, details) => logs.push({ action, ...details }), { includeData: true })
      ])

      await decorated.create({ title: 'Test Book' })

      expect(logs[0].data).toEqual({ title: 'Test Book' })
    })
  })

  describe('update', () => {
    it('logs update action', async () => {
      const logs = []
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withAuditLog((action, details) => logs.push({ action, ...details }))
      ])

      await decorated.update(5, { title: 'Updated' })

      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('update')
      expect(logs[0].id).toBe(5)
    })
  })

  describe('patch', () => {
    it('logs patch action', async () => {
      const logs = []
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withAuditLog((action, details) => logs.push({ action, ...details }))
      ])

      await decorated.patch(3, { title: 'Patched' })

      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('patch')
      expect(logs[0].id).toBe(3)
    })
  })

  describe('delete', () => {
    it('logs delete action', async () => {
      const logs = []
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withAuditLog((action, details) => logs.push({ action, ...details }))
      ])

      await decorated.delete(7)

      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('delete')
      expect(logs[0].id).toBe(7)
    })
  })
})

describe('withSoftDelete', () => {
  describe('delete', () => {
    it('converts delete to patch with deleted_at timestamp', async () => {
      const manager = createMockManager('books')
      // Pre-create a record
      await manager.create({ title: 'Test' })

      const decorated = createDecoratedManager(manager, [
        withSoftDelete()
      ])

      await decorated.delete(1)

      const record = manager.storage.items.get(1)
      expect(record).toBeDefined()
      expect(record.deleted_at).toBeDefined()
    })

    it('uses custom field name', async () => {
      const manager = createMockManager('books')
      await manager.create({ title: 'Test' })

      const decorated = createDecoratedManager(manager, [
        withSoftDelete({ field: 'removed_at' })
      ])

      await decorated.delete(1)

      const record = manager.storage.items.get(1)
      expect(record.removed_at).toBeDefined()
      expect(record.deleted_at).toBeUndefined()
    })

    it('uses custom timestamp function', async () => {
      const manager = createMockManager('books')
      await manager.create({ title: 'Test' })

      const decorated = createDecoratedManager(manager, [
        withSoftDelete({ timestamp: () => 12345 })
      ])

      await decorated.delete(1)

      const record = manager.storage.items.get(1)
      expect(record.deleted_at).toBe(12345)
    })
  })
})

describe('withTimestamps', () => {
  describe('create', () => {
    it('adds created_at and updated_at on create', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withTimestamps()
      ])

      const result = await decorated.create({ title: 'Test' })

      expect(result.created_at).toBeDefined()
      expect(result.updated_at).toBeDefined()
    })

    it('uses custom field names', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withTimestamps({
          createdAtField: 'createdOn',
          updatedAtField: 'modifiedOn'
        })
      ])

      const result = await decorated.create({ title: 'Test' })

      expect(result.createdOn).toBeDefined()
      expect(result.modifiedOn).toBeDefined()
      expect(result.created_at).toBeUndefined()
    })

    it('uses custom timestamp function', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withTimestamps({ timestamp: () => 'fixed-time' })
      ])

      const result = await decorated.create({ title: 'Test' })

      expect(result.created_at).toBe('fixed-time')
      expect(result.updated_at).toBe('fixed-time')
    })
  })

  describe('update', () => {
    it('adds updated_at on update', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withTimestamps({ timestamp: () => 'update-time' })
      ])

      const result = await decorated.update(1, { title: 'Updated' })

      expect(result.updated_at).toBe('update-time')
      expect(result.created_at).toBeUndefined() // Not added on update
    })
  })

  describe('patch', () => {
    it('adds updated_at on patch', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withTimestamps({ timestamp: () => 'patch-time' })
      ])

      const result = await decorated.patch(1, { title: 'Patched' })

      expect(result.updated_at).toBe('patch-time')
    })
  })
})

describe('withValidation', () => {
  describe('validation', () => {
    it('throws when validator is not a function', () => {
      expect(() => withValidation('not-a-function')).toThrow('[withValidation] Validator must be a function')
    })
  })

  describe('create', () => {
    it('calls validator on create', async () => {
      const manager = createMockManager('books')
      const validator = vi.fn().mockReturnValue(null)
      const decorated = createDecoratedManager(manager, [
        withValidation(validator)
      ])

      await decorated.create({ title: 'Test' })

      expect(validator).toHaveBeenCalledWith(
        { title: 'Test' },
        expect.objectContaining({ action: 'create' })
      )
    })

    it('throws ValidationError when validation fails', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withValidation(() => ({ title: 'Title is required' }))
      ])

      await expect(decorated.create({})).rejects.toMatchObject({
        name: 'ValidationError',
        errors: { title: 'Title is required' }
      })
    })

    it('passes when validator returns null', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withValidation(() => null)
      ])

      const result = await decorated.create({ title: 'Valid' })
      expect(result.title).toBe('Valid')
    })

    it('passes when validator returns empty object', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withValidation(() => ({}))
      ])

      const result = await decorated.create({ title: 'Valid' })
      expect(result.title).toBe('Valid')
    })
  })

  describe('update', () => {
    it('validates on update by default', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withValidation(() => ({ error: 'Invalid' }))
      ])

      await expect(decorated.update(1, {})).rejects.toMatchObject({
        name: 'ValidationError'
      })
    })

    it('skips validation when onUpdate is false', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withValidation(() => ({ error: 'Invalid' }), { onUpdate: false })
      ])

      const result = await decorated.update(1, { title: 'Test' })
      expect(result.title).toBe('Test')
    })
  })

  describe('patch', () => {
    it('validates on patch by default', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withValidation(() => ({ error: 'Invalid' }))
      ])

      await expect(decorated.patch(1, {})).rejects.toMatchObject({
        name: 'ValidationError'
      })
    })

    it('skips validation when onPatch is false', async () => {
      const manager = createMockManager('books')
      const decorated = createDecoratedManager(manager, [
        withValidation(() => ({ error: 'Invalid' }), { onPatch: false })
      ])

      const result = await decorated.patch(1, { title: 'Test' })
      expect(result.title).toBe('Test')
    })
  })
})

describe('decorator composition', () => {
  it('combines multiple decorators correctly', async () => {
    const logs = []
    const manager = createMockManager('books')

    const decorated = createDecoratedManager(manager, [
      withTimestamps({ timestamp: () => '2024-01-01' }),
      withValidation((data) => data.title ? null : { title: 'Required' }),
      withAuditLog((action, details) => logs.push({ action, ...details }))
    ])

    const result = await decorated.create({ title: 'Composed' })

    // Timestamps added
    expect(result.created_at).toBe('2024-01-01')
    expect(result.updated_at).toBe('2024-01-01')

    // Audit logged
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('create')
  })

  it('validation runs before storage (early exit)', async () => {
    const manager = createMockManager('books')
    const storageCreateSpy = vi.spyOn(manager.storage, 'create')

    const decorated = createDecoratedManager(manager, [
      withValidation(() => ({ error: 'Always fails' }))
    ])

    await expect(decorated.create({})).rejects.toThrow()

    // Storage should never be called
    expect(storageCreateSpy).not.toHaveBeenCalled()
  })
})
