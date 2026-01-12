/**
 * Unit tests for EntityManager canAccess method and auto-cache behavior
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EntityManager, createEntityManager } from '../../src/entity/EntityManager.js'
import {
  EntityAuthAdapter,
  AuthActions,
  PermissiveAuthAdapter
} from '../../src/entity/auth'
import { MemoryStorage } from '../../src/entity/storage/MemoryStorage'

/**
 * Test AuthAdapter that denies specific actions/records
 */
class RestrictiveAuthAdapter extends EntityAuthAdapter {
  constructor(options = {}) {
    super()
    this.allowedActions = options.allowedActions || []
    this.allowedRecordIds = options.allowedRecordIds || []
    this.user = options.user || null
  }

  canPerform(entity, action) {
    return this.allowedActions.includes(action)
  }

  canAccessRecord(entity, record) {
    if (!record) return true
    return this.allowedRecordIds.includes(record.id)
  }

  getCurrentUser() {
    return this.user
  }
}

describe('EntityManager', () => {
  describe('authAdapter property', () => {
    it('returns PermissiveAuthAdapter when no adapter is set', () => {
      const manager = new EntityManager({ name: 'users' })
      expect(manager.authAdapter).toBeInstanceOf(PermissiveAuthAdapter)
    })

    it('returns the same adapter instance on multiple accesses', () => {
      const manager = new EntityManager({ name: 'users' })
      const adapter1 = manager.authAdapter
      const adapter2 = manager.authAdapter
      expect(adapter1).toBe(adapter2)
    })

    it('uses provided authAdapter from constructor', () => {
      const customAdapter = new RestrictiveAuthAdapter({ allowedActions: ['read'] })
      const manager = new EntityManager({
        name: 'users',
        authAdapter: customAdapter
      })
      expect(manager.authAdapter).toBe(customAdapter)
    })

    it('can set authAdapter after construction', () => {
      const manager = new EntityManager({ name: 'users' })
      const customAdapter = new RestrictiveAuthAdapter({ allowedActions: ['read'] })
      manager.authAdapter = customAdapter
      expect(manager.authAdapter).toBe(customAdapter)
    })

    it('can reset authAdapter to null (reverts to permissive)', () => {
      const customAdapter = new RestrictiveAuthAdapter({ allowedActions: ['read'] })
      const manager = new EntityManager({
        name: 'users',
        authAdapter: customAdapter
      })
      manager.authAdapter = null
      expect(manager.authAdapter).toBeInstanceOf(PermissiveAuthAdapter)
    })
  })

  describe('canAccess', () => {
    describe('without AuthAdapter (permissive mode)', () => {
      it('allows all actions by default', () => {
        const manager = new EntityManager({ name: 'users' })
        expect(manager.canAccess('read')).toBe(true)
        expect(manager.canAccess('create')).toBe(true)
        expect(manager.canAccess('update')).toBe(true)
        expect(manager.canAccess('delete')).toBe(true)
        expect(manager.canAccess('list')).toBe(true)
      })

      it('allows access to any record', () => {
        const manager = new EntityManager({ name: 'users' })
        const record = { id: 123, name: 'Test' }
        expect(manager.canAccess('read', record)).toBe(true)
        expect(manager.canAccess('update', record)).toBe(true)
        expect(manager.canAccess('delete', record)).toBe(true)
      })
    })

    describe('with readOnly flag', () => {
      it('allows read action when readOnly', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canAccess('read')).toBe(true)
      })

      it('allows list action when readOnly', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canAccess('list')).toBe(true)
      })

      it('denies create action when readOnly', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canAccess('create')).toBe(false)
      })

      it('denies update action when readOnly', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canAccess('update')).toBe(false)
      })

      it('denies delete action when readOnly', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canAccess('delete')).toBe(false)
      })

      it('denies update on specific record when readOnly', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        const record = { id: 1 }
        expect(manager.canAccess('update', record)).toBe(false)
      })
    })

    describe('with custom AuthAdapter', () => {
      it('respects adapter scope check (canPerform)', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read', 'list']
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })

        expect(manager.canAccess('read')).toBe(true)
        expect(manager.canAccess('list')).toBe(true)
        expect(manager.canAccess('create')).toBe(false)
        expect(manager.canAccess('update')).toBe(false)
        expect(manager.canAccess('delete')).toBe(false)
      })

      it('respects adapter silo check (canAccessRecord)', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read', 'update', 'delete'],
          allowedRecordIds: [1, 2]
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })

        // Allowed records
        expect(manager.canAccess('read', { id: 1 })).toBe(true)
        expect(manager.canAccess('update', { id: 2 })).toBe(true)

        // Denied records
        expect(manager.canAccess('read', { id: 3 })).toBe(false)
        expect(manager.canAccess('delete', { id: 999 })).toBe(false)
      })

      it('requires both scope and silo checks to pass', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read'], // Only read allowed
          allowedRecordIds: [1]     // Only record 1 allowed
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })

        // Scope denied, record allowed
        expect(manager.canAccess('update', { id: 1 })).toBe(false)

        // Scope allowed, record denied
        expect(manager.canAccess('read', { id: 2 })).toBe(false)

        // Both allowed
        expect(manager.canAccess('read', { id: 1 })).toBe(true)
      })

      it('skips silo check when no record provided', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read'],
          allowedRecordIds: [] // No records allowed
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })

        // Scope-only check passes
        expect(manager.canAccess('read')).toBe(true)

        // With record, silo check fails
        expect(manager.canAccess('read', { id: 1 })).toBe(false)
      })
    })

    describe('readOnly combined with AuthAdapter', () => {
      it('readOnly takes precedence over adapter for write actions', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read', 'create', 'update', 'delete']
        })
        const manager = new EntityManager({
          name: 'users',
          readOnly: true,
          authAdapter: adapter
        })

        // readOnly blocks write actions even if adapter allows
        expect(manager.canAccess('create')).toBe(false)
        expect(manager.canAccess('update')).toBe(false)
        expect(manager.canAccess('delete')).toBe(false)

        // Read still works
        expect(manager.canAccess('read')).toBe(true)
      })
    })
  })

  describe('legacy permission methods', () => {
    describe('canRead', () => {
      it('delegates to canAccess with read action', () => {
        const manager = new EntityManager({ name: 'users' })
        expect(manager.canRead()).toBe(true)
      })

      it('passes entity to canAccess', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read'],
          allowedRecordIds: [1]
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })

        expect(manager.canRead({ id: 1 })).toBe(true)
        expect(manager.canRead({ id: 2 })).toBe(false)
      })
    })

    describe('canCreate', () => {
      it('delegates to canAccess with create action', () => {
        const manager = new EntityManager({ name: 'users' })
        expect(manager.canCreate()).toBe(true)
      })

      it('respects readOnly flag', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canCreate()).toBe(false)
      })

      it('respects adapter scope check', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read'] // create not allowed
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })
        expect(manager.canCreate()).toBe(false)
      })
    })

    describe('canUpdate', () => {
      it('delegates to canAccess with update action', () => {
        const manager = new EntityManager({ name: 'users' })
        expect(manager.canUpdate()).toBe(true)
      })

      it('passes entity to canAccess', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['update'],
          allowedRecordIds: [5]
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })

        expect(manager.canUpdate({ id: 5 })).toBe(true)
        expect(manager.canUpdate({ id: 6 })).toBe(false)
      })

      it('respects readOnly flag', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canUpdate()).toBe(false)
        expect(manager.canUpdate({ id: 1 })).toBe(false)
      })
    })

    describe('canDelete', () => {
      it('delegates to canAccess with delete action', () => {
        const manager = new EntityManager({ name: 'users' })
        expect(manager.canDelete()).toBe(true)
      })

      it('passes entity to canAccess', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['delete'],
          allowedRecordIds: [10]
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })

        expect(manager.canDelete({ id: 10 })).toBe(true)
        expect(manager.canDelete({ id: 11 })).toBe(false)
      })

      it('respects readOnly flag', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canDelete()).toBe(false)
        expect(manager.canDelete({ id: 1 })).toBe(false)
      })
    })

    describe('canList', () => {
      it('delegates to canAccess with list action', () => {
        const manager = new EntityManager({ name: 'users' })
        expect(manager.canList()).toBe(true)
      })

      it('is allowed when readOnly', () => {
        const manager = new EntityManager({ name: 'users', readOnly: true })
        expect(manager.canList()).toBe(true)
      })

      it('respects adapter scope check', () => {
        const adapter = new RestrictiveAuthAdapter({
          allowedActions: ['read'] // list not allowed
        })
        const manager = new EntityManager({
          name: 'users',
          authAdapter: adapter
        })
        expect(manager.canList()).toBe(false)
      })
    })
  })

  describe('createEntityManager factory', () => {
    it('creates EntityManager with authAdapter option', () => {
      const adapter = new RestrictiveAuthAdapter({ allowedActions: ['read'] })
      const manager = createEntityManager({
        name: 'products',
        authAdapter: adapter
      })

      expect(manager).toBeInstanceOf(EntityManager)
      expect(manager.authAdapter).toBe(adapter)
      expect(manager.canAccess('read')).toBe(true)
      expect(manager.canAccess('create')).toBe(false)
    })
  })

  describe('lifecycle hooks', () => {
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
    }

    /**
     * Mock HookRegistry for testing
     */
    class MockHookRegistry {
      constructor() {
        this.invokedHooks = []
        this.handlers = new Map()
      }

      register(name, handler) {
        if (!this.handlers.has(name)) {
          this.handlers.set(name, [])
        }
        this.handlers.get(name).push(handler)
        return () => {
          const handlers = this.handlers.get(name)
          const idx = handlers.indexOf(handler)
          if (idx !== -1) handlers.splice(idx, 1)
        }
      }

      async invoke(name, context) {
        this.invokedHooks.push({ name, context: { ...context } })
        const handlers = this.handlers.get(name) || []
        for (const handler of handlers) {
          await handler(context)
        }
      }

      getInvokedHooks() {
        return this.invokedHooks
      }

      reset() {
        this.invokedHooks = []
      }
    }

    describe('create()', () => {
      it('invokes presave hook before storage.create', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.create({ title: 'Test Book' })

        const presaveHooks = hooks.getInvokedHooks().filter(h => h.name === 'entity:presave')
        expect(presaveHooks.length).toBe(1)
        expect(presaveHooks[0].context.entity).toBe('books')
      })

      it('invokes postsave hook after storage.create', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.create({ title: 'Test Book' })

        const postsaveHooks = hooks.getInvokedHooks().filter(h => h.name === 'entity:postsave')
        expect(postsaveHooks.length).toBe(1)
        expect(postsaveHooks[0].context.entity).toBe('books')
      })

      it('presave context includes entity, record, isNew=true, manager', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.create({ title: 'Test Book' })

        const presaveHook = hooks.getInvokedHooks().find(h => h.name === 'entity:presave')
        expect(presaveHook.context.entity).toBe('books')
        expect(presaveHook.context.record.title).toBe('Test Book')
        expect(presaveHook.context.isNew).toBe(true)
        expect(presaveHook.context.manager).toBe(manager)
      })

      it('postsave context includes result', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.create({ title: 'Test Book' })

        const postsaveHook = hooks.getInvokedHooks().find(h => h.name === 'entity:postsave')
        expect(postsaveHook.context.result).toBeDefined()
        expect(postsaveHook.context.result.id).toBe(1)
        expect(postsaveHook.context.result.title).toBe('Test Book')
      })

      it('presave handler can modify record data', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        // Register handler that modifies record (filter by entity)
        hooks.register('entity:presave', (context) => {
          if (context.entity === 'books') {
            context.record.updated_at = '2024-01-01'
          }
        })

        const result = await manager.create({ title: 'Test Book' })

        expect(result.updated_at).toBe('2024-01-01')
      })

      it('presave handler can abort by throwing', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        // Register handler that throws
        hooks.register('entity:presave', (context) => {
          if (context.entity === 'books') {
            throw new Error('Validation failed')
          }
        })

        await expect(manager.create({ title: 'Test' })).rejects.toThrow('Validation failed')
        expect(storage.items.size).toBe(0) // Storage should not have been called
      })
    })

    describe('update()', () => {
      it('invokes presave hook with isNew=false', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.update(1, { title: 'Updated Book' })

        const presaveHook = hooks.getInvokedHooks().find(h => h.name === 'entity:presave')
        expect(presaveHook.context.isNew).toBe(false)
        expect(presaveHook.context.id).toBe(1)
      })

      it('invokes generic hooks with entity name in context', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.update(1, { title: 'Updated Book' })

        const hookNames = hooks.getInvokedHooks().map(h => h.name)
        expect(hookNames).toContain('entity:presave')
        expect(hookNames).toContain('entity:postsave')
        expect(hookNames).not.toContain('books:presave')
        expect(hookNames).not.toContain('books:postsave')
      })
    })

    describe('patch()', () => {
      it('invokes presave and postsave hooks', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.patch(1, { title: 'Patched Book' })

        const hookNames = hooks.getInvokedHooks().map(h => h.name)
        expect(hookNames).toContain('entity:presave')
        expect(hookNames).toContain('entity:postsave')
      })

      it('presave context has isNew=false', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.patch(5, { title: 'Patched' })

        const presaveHook = hooks.getInvokedHooks().find(h => h.name === 'entity:presave')
        expect(presaveHook.context.isNew).toBe(false)
        expect(presaveHook.context.id).toBe(5)
      })
    })

    describe('delete()', () => {
      it('invokes predelete hook before deletion', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        storage.items.set(1, { id: 1, title: 'Book to delete' })
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.delete(1)

        const predeleteHooks = hooks.getInvokedHooks().filter(h => h.name === 'entity:predelete')
        expect(predeleteHooks.length).toBe(1)
        expect(predeleteHooks[0].context.entity).toBe('books')
      })

      it('predelete context includes entity, id, manager', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        storage.items.set(1, { id: 1 })
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.delete(1)

        const predeleteHook = hooks.getInvokedHooks().find(h => h.name === 'entity:predelete')
        expect(predeleteHook.context.entity).toBe('books')
        expect(predeleteHook.context.id).toBe(1)
        expect(predeleteHook.context.manager).toBe(manager)
      })

      it('predelete handler can abort by throwing', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        storage.items.set(1, { id: 1 })
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        hooks.register('entity:predelete', (context) => {
          if (context.entity === 'books') {
            throw new Error('Cannot delete: has dependencies')
          }
        })

        await expect(manager.delete(1)).rejects.toThrow('Cannot delete: has dependencies')
        expect(storage.items.has(1)).toBe(true) // Item should still exist
      })
    })

    describe('without hooks', () => {
      it('create works normally without hooks', async () => {
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })

        const result = await manager.create({ title: 'No Hooks Book' })

        expect(result.id).toBe(1)
        expect(result.title).toBe('No Hooks Book')
      })

      it('update works normally without hooks', async () => {
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })

        const result = await manager.update(1, { title: 'Updated' })

        expect(result.title).toBe('Updated')
      })

      it('delete works normally without hooks', async () => {
        const storage = new MockStorage()
        storage.items.set(1, { id: 1 })
        const manager = new EntityManager({
          name: 'books',
          storage
        })

        await manager.delete(1)

        expect(storage.items.has(1)).toBe(false)
      })
    })
  })

  describe('signal emission', () => {
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
    }

    /**
     * Mock SignalBus for testing signal emission
     */
    class MockSignalBus {
      constructor() {
        this.emittedSignals = []
      }

      async emitEntity(entityName, action, data) {
        this.emittedSignals.push({ entityName, action, data })
      }

      // Stub for entity:data-invalidate signal
      async emit(signal, payload) {
        // Just stub - tests focus on entity signals
      }

      // Stub for cache listener setup
      on() {
        return () => {} // Return cleanup function
      }

      getEmittedSignals() {
        return this.emittedSignals
      }

      reset() {
        this.emittedSignals = []
      }
    }

    describe('create()', () => {
      it('emits created signal after storage.create', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.create({ title: 'Test Book' })

        const emitted = signals.getEmittedSignals()
        expect(emitted.length).toBe(1)
        expect(emitted[0].entityName).toBe('books')
        expect(emitted[0].action).toBe('created')
      })

      it('signal payload contains entity, manager name, and id', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.create({ title: 'Test Book' })

        const emitted = signals.getEmittedSignals()[0]
        expect(emitted.data.entity.id).toBe(1)
        expect(emitted.data.entity.title).toBe('Test Book')
        expect(emitted.data.manager).toBe('books')
        expect(emitted.data.id).toBe(1)
      })

      it('does not emit signal when signals not set', async () => {
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })

        // Should not throw when signals not set
        await expect(manager.create({ title: 'Test' })).resolves.toBeDefined()
      })
    })

    describe('update()', () => {
      it('emits updated signal after storage.update', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.update(1, { title: 'Updated Book' })

        const emitted = signals.getEmittedSignals()
        expect(emitted.length).toBe(1)
        expect(emitted[0].entityName).toBe('books')
        expect(emitted[0].action).toBe('updated')
      })

      it('signal payload contains id from update call', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.update(42, { title: 'Updated Book' })

        const emitted = signals.getEmittedSignals()[0]
        expect(emitted.data.id).toBe(42)
        expect(emitted.data.manager).toBe('books')
      })
    })

    describe('patch()', () => {
      it('emits updated signal after storage.patch', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.patch(1, { title: 'Patched Book' })

        const emitted = signals.getEmittedSignals()
        expect(emitted.length).toBe(1)
        expect(emitted[0].entityName).toBe('books')
        expect(emitted[0].action).toBe('updated')
      })

      it('patch uses updated action (not patched)', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.patch(1, { title: 'Patched' })

        const emitted = signals.getEmittedSignals()[0]
        expect(emitted.action).toBe('updated')
      })
    })

    describe('delete()', () => {
      it('emits deleted signal after storage.delete', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        storage.items.set(1, { id: 1, title: 'To Delete' })
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.delete(1)

        const emitted = signals.getEmittedSignals()
        expect(emitted.length).toBe(1)
        expect(emitted[0].entityName).toBe('books')
        expect(emitted[0].action).toBe('deleted')
      })

      it('delete signal payload contains id and manager', async () => {
        const signals = new MockSignalBus()
        const storage = new MockStorage()
        storage.items.set(99, { id: 99 })
        const manager = new EntityManager({
          name: 'users',
          storage
        })
        manager.setSignals(signals)

        await manager.delete(99)

        const emitted = signals.getEmittedSignals()[0]
        expect(emitted.data.id).toBe(99)
        expect(emitted.data.manager).toBe('users')
        expect(emitted.data.entity).toBeUndefined() // No entity data on delete
      })
    })

    describe('signal emission order', () => {
      it('hooks are invoked before signal emission', async () => {
        const order = []

        class MockHookRegistry {
          async invoke(name, context) {
            order.push(`hook:${name}`)
          }
        }

        class TrackingSignalBus {
          async emitEntity(entityName, action, data) {
            order.push(`signal:entity:${action}`)
          }
          async emit() {} // Stub for entity:data-invalidate signal
          on() { return () => {} }
        }

        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(new MockHookRegistry())
        manager.setSignals(new TrackingSignalBus())

        await manager.create({ title: 'Test' })

        // Hooks should be called before signal emission
        expect(order.indexOf('hook:entity:presave')).toBeLessThan(order.indexOf('signal:entity:created'))
        expect(order.indexOf('hook:entity:postsave')).toBeLessThan(order.indexOf('signal:entity:created'))
      })
    })

    describe('multiple entities', () => {
      it('each manager emits signals with its own entity name', async () => {
        const signals = new MockSignalBus()

        const booksStorage = new MockStorage()
        const booksManager = new EntityManager({
          name: 'books',
          storage: booksStorage
        })
        booksManager.setSignals(signals)

        const usersStorage = new MockStorage()
        const usersManager = new EntityManager({
          name: 'users',
          storage: usersStorage
        })
        usersManager.setSignals(signals)

        await booksManager.create({ title: 'Book' })
        await usersManager.create({ name: 'User' })

        const emitted = signals.getEmittedSignals()
        expect(emitted.length).toBe(2)
        expect(emitted[0].entityName).toBe('books')
        expect(emitted[1].entityName).toBe('users')
      })
    })

    describe('entity:data-invalidate signal', () => {
      /**
       * Mock SignalBus that tracks both emitEntity and emit calls
       */
      class DataInvalidateSignalBus {
        constructor() {
          this.emittedSignals = []
          this.emittedDataSignals = []
        }

        async emitEntity(entityName, action, data) {
          this.emittedSignals.push({ entityName, action, data })
        }

        async emit(signal, payload) {
          this.emittedDataSignals.push({ signal, payload })
        }

        // Stub for cache listener setup
        on() {
          return () => {} // Return cleanup function
        }

        getDataSignals() {
          return this.emittedDataSignals.filter(s => s.signal === 'entity:data-invalidate')
        }

        reset() {
          this.emittedSignals = []
          this.emittedDataSignals = []
        }
      }

      it('emits entity:data-invalidate on create', async () => {
        const signals = new DataInvalidateSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        await manager.create({ title: 'New Book' })

        const dataSignals = signals.getDataSignals()
        expect(dataSignals.length).toBe(1)
        expect(dataSignals[0].payload.entity).toBe('books')
        expect(dataSignals[0].payload.action).toBe('created')
      })

      it('emits entity:data-invalidate on update', async () => {
        const signals = new DataInvalidateSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        // Create a book first
        const created = await manager.create({ title: 'Book' })
        signals.reset()

        // Update it
        await manager.update(created.id, { title: 'Updated Book' })

        const dataSignals = signals.getDataSignals()
        expect(dataSignals.length).toBe(1)
        expect(dataSignals[0].payload.entity).toBe('books')
        expect(dataSignals[0].payload.action).toBe('updated')
        expect(dataSignals[0].payload.id).toBe(created.id)
      })

      it('emits entity:data-invalidate on delete', async () => {
        const signals = new DataInvalidateSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        // Create a book first
        const created = await manager.create({ title: 'Book' })
        signals.reset()

        // Delete it
        await manager.delete(created.id)

        const dataSignals = signals.getDataSignals()
        expect(dataSignals.length).toBe(1)
        expect(dataSignals[0].payload.entity).toBe('books')
        expect(dataSignals[0].payload.action).toBe('deleted')
        expect(dataSignals[0].payload.id).toBe(created.id)
      })

      it('does not emit signal when signals not set', async () => {
        const manager = new EntityManager({
          name: 'books',
          storage: new MockStorage()
        })

        // Should not throw when signals not set
        await expect(manager.create({ title: 'Book' })).resolves.toBeDefined()
      })

      it('emits signal regardless of cache state', async () => {
        const signals = new DataInvalidateSignalBus()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setSignals(signals)

        // Cache starts invalid (default state)
        expect(manager._cache.valid).toBe(false)

        // Create should still emit signal (cache state doesn't matter)
        await manager.create({ title: 'Book 1' })

        const dataSignals = signals.getDataSignals()
        expect(dataSignals.length).toBe(1)
        expect(dataSignals[0].payload.action).toBe('created')
      })
    })
  })

  describe('auto-cache behavior', () => {
    /**
     * CacheableStorage - MemoryStorage that supports caching
     *
     * MemoryStorage has supportsCaching=false by design (already in-memory).
     * For testing EntityManager's auto-cache, we need a storage that:
     * 1. Has supportsTotal=true (so threshold comparison works)
     * 2. Has supportsCaching=true (so EntityManager enables caching)
     */
    class CacheableStorage extends MemoryStorage {
      static capabilities = {
        supportsTotal: true,
        supportsFilters: true,
        supportsPagination: true,
        supportsCaching: true  // Enable caching for tests
      }

      get supportsCaching() {
        return CacheableStorage.capabilities.supportsCaching
      }
    }

    /**
     * Helper: create CacheableStorage with N items
     */
    function createStorageWithItems(count, options = {}) {
      const items = []
      for (let i = 1; i <= count; i++) {
        items.push({
          id: i,
          name: `Item ${i}`,
          status: i % 2 === 0 ? 'active' : 'inactive',
          price: i * 10
        })
      }
      return new CacheableStorage({ initialData: items, ...options })
    }

    /**
     * Storage without supportsTotal capability
     */
    class NoTotalStorage extends MemoryStorage {
      static capabilities = {
        supportsTotal: false,
        supportsFilters: true,
        supportsPagination: true,
        supportsCaching: true
      }

      get supportsCaching() {
        return NoTotalStorage.capabilities.supportsCaching
      }
    }

    /**
     * Mock SignalBus for cache invalidation signals
     */
    class MockSignalBus {
      constructor() {
        this.signals = []
      }

      async emit(signal, payload) {
        this.signals.push({ signal, payload })
      }

      async emitEntity(entityName, action, data) {
        this.signals.push({ entityName, action, data })
      }

      // Stub for cache listener setup
      on() {
        return () => {} // Return cleanup function
      }

      getSignals() {
        return this.signals
      }

      reset() {
        this.signals = []
      }
    }

    describe('auto-cache trigger (within threshold)', () => {
      it('caches items from first list() response when total <= threshold', async () => {
        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Note: Cache is only populated when ALL items are received
        // Request all items to trigger caching
        const result = await manager.list({ page_size: 100 })

        expect(result.items.length).toBe(50) // All items
        expect(result.total).toBe(50)
        expect(result.fromCache).toBe(false) // First call is from storage

        // Verify cache is populated with all items
        const cacheInfo = manager.getCacheInfo()
        expect(cacheInfo.valid).toBe(true)
        expect(cacheInfo.itemCount).toBe(50)
        expect(cacheInfo.total).toBe(50)
      })

      it('caches ALL items when requesting with page_size >= total', async () => {
        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Request all items explicitly
        const result = await manager.list({ page_size: 100 })

        expect(result.items.length).toBe(50)
        expect(result.total).toBe(50)

        // Cache should have all 50 items
        const cacheInfo = manager.getCacheInfo()
        expect(cacheInfo.valid).toBe(true)
        expect(cacheInfo.itemCount).toBe(50)
        expect(cacheInfo.total).toBe(50)
      })

      it('second list() returns fromCache=true', async () => {
        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // First list populates cache (request all to trigger caching)
        await manager.list({ page_size: 100 })

        // Second list should use cache
        const result = await manager.list()

        expect(result.fromCache).toBe(true)
        // Total reflects cached total, items are filtered from cache
        expect(result.total).toBe(50) // All 50 cached items
      })

      it('uses default threshold of 100 when not specified', async () => {
        const storage = createStorageWithItems(80)
        const manager = new EntityManager({
          name: 'products',
          storage
          // No localFilterThreshold specified
        })

        // Request all items to trigger caching
        await manager.list({ page_size: 100 })

        expect(manager.effectiveThreshold).toBe(100)
        expect(manager.getCacheInfo().valid).toBe(true)
      })
    })

    describe('no-cache trigger (exceeds threshold)', () => {
      it('does NOT cache when total > threshold', async () => {
        const storage = createStorageWithItems(150)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        await manager.list()

        const cacheInfo = manager.getCacheInfo()
        expect(cacheInfo.valid).toBe(false)
        expect(cacheInfo.itemCount).toBe(0)
      })

      it('subsequent list() calls still return fromCache=false', async () => {
        const storage = createStorageWithItems(150)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        await manager.list()
        const result = await manager.list()

        expect(result.fromCache).toBe(false)
      })

      it('threshold=0 disables caching', async () => {
        const storage = createStorageWithItems(10)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 0
        })

        expect(manager.isCacheEnabled).toBe(false)

        await manager.list()

        expect(manager.getCacheInfo().valid).toBe(false)
      })
    })

    describe('storage without supportsTotal', () => {
      it('isCacheEnabled returns false when storage lacks supportsTotal', async () => {
        const storage = new NoTotalStorage({ initialData: [{ id: 1, name: 'Test' }] })
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        expect(manager.storageSupportsTotal).toBe(false)
        expect(manager.isCacheEnabled).toBe(false)
      })

      it('list() does not attempt caching', async () => {
        const storage = new NoTotalStorage({
          initialData: [{ id: 1, name: 'Test' }, { id: 2, name: 'Test2' }]
        })
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        await manager.list()

        expect(manager.getCacheInfo().valid).toBe(false)
        expect(manager.getCacheInfo().enabled).toBe(false)
      })
    })

    describe('cache invalidation on mutations', () => {
      it('invalidates cache on create()', async () => {
        const storage = createStorageWithItems(10)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Populate cache
        await manager.list()
        expect(manager.getCacheInfo().valid).toBe(true)

        // Create invalidates cache
        await manager.create({ name: 'New Product' })

        expect(manager.getCacheInfo().valid).toBe(false)
      })

      it('invalidates cache on update()', async () => {
        const storage = createStorageWithItems(10)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        await manager.list()
        expect(manager.getCacheInfo().valid).toBe(true)

        await manager.update(1, { name: 'Updated Product' })

        expect(manager.getCacheInfo().valid).toBe(false)
      })

      it('invalidates cache on patch()', async () => {
        const storage = createStorageWithItems(10)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        await manager.list()
        expect(manager.getCacheInfo().valid).toBe(true)

        await manager.patch(1, { status: 'updated' })

        expect(manager.getCacheInfo().valid).toBe(false)
      })

      it('invalidates cache on delete()', async () => {
        const storage = createStorageWithItems(10)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        await manager.list()
        expect(manager.getCacheInfo().valid).toBe(true)

        await manager.delete(1)

        expect(manager.getCacheInfo().valid).toBe(false)
      })
    })

    describe('entity:data-invalidate signal on CRUD', () => {
      it('emits entity:data-invalidate on create (regardless of cache state)', async () => {
        const storage = createStorageWithItems(10)
        const signals = new MockSignalBus()
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })
        manager.setSignals(signals)

        // Populate cache
        await manager.list()
        expect(manager.getCacheInfo().valid).toBe(true)

        // Create emits entity:data-invalidate
        await manager.create({ name: 'New Product' })

        const dataSignals = signals.getSignals().filter(s => s.signal === 'entity:data-invalidate')
        expect(dataSignals.length).toBe(1)
        expect(dataSignals[0].payload.entity).toBe('products')
        expect(dataSignals[0].payload.action).toBe('created')
      })

      it('emits signal even when cache was never valid', async () => {
        const storage = createStorageWithItems(150) // Exceeds threshold
        const signals = new MockSignalBus()
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })
        manager.setSignals(signals)

        // list() won't cache because total > threshold
        await manager.list()
        expect(manager.getCacheInfo().valid).toBe(false)

        // Create still emits entity:data-invalidate (signal is about data change, not cache)
        await manager.create({ name: 'New Product' })

        const dataSignals = signals.getSignals().filter(s => s.signal === 'entity:data-invalidate')
        expect(dataSignals.length).toBe(1)
        expect(dataSignals[0].payload.action).toBe('created')
      })
    })

    describe('filtered query on cached data', () => {
      it('list() with filters does NOT use cache by default', async () => {
        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Populate cache with ALL items
        await manager.list({ page_size: 100 })
        expect(manager.getCacheInfo().valid).toBe(true)

        // list() with filters goes to API (not cache) for fresh results
        const result = await manager.list({ filters: { status: 'active' } })

        // Design: list() with filters fetches from storage, not cache
        expect(result.fromCache).toBe(false)
      })

      it('list() with filters and cacheSafe=true uses cache', async () => {
        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Populate cache with ALL items
        await manager.list({ page_size: 100 })

        // With cacheSafe=true, list() uses cache for filtering
        const result = await manager.list({ filters: { status: 'active' }, cacheSafe: true })

        expect(result.fromCache).toBe(true)
        // 25 out of 50 items have status='active' (even IDs)
        expect(result.total).toBe(25)
        expect(result.items.every(item => item.status === 'active')).toBe(true)
      })

      it('query() applies filters locally when cache is loaded', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Populate cache with ALL items
        await manager.list({ page_size: 100 })

        // query() uses cache for filtered queries
        const result = await manager.query({ filters: { status: 'active' } })

        expect(result.fromCache).toBe(true)
        // 25 out of 50 items have status='active' (even IDs)
        expect(result.total).toBe(25)
        expect(result.items.every(item => item.status === 'active')).toBe(true)

        consoleSpy.mockRestore()
      })

      it('query() applies search filter locally', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache
        await manager.list({ page_size: 100 })

        const result = await manager.query({ search: 'Item 1' })

        expect(result.fromCache).toBe(true)
        // "Item 1", "Item 10", "Item 11", ... "Item 19" = 11 items
        expect(result.total).toBe(11)

        consoleSpy.mockRestore()
      })

      it('applies pagination locally', async () => {
        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache first
        await manager.list({ page_size: 100 })

        const result = await manager.list({ page: 2, page_size: 10 })

        expect(result.fromCache).toBe(true)
        expect(result.items.length).toBe(10)
        expect(result.items[0].id).toBe(11) // Second page starts at item 11
      })

      it('applies sorting locally', async () => {
        const storage = createStorageWithItems(20)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items
        await manager.list({ page_size: 100 })

        const result = await manager.list({ sort_by: 'id', sort_order: 'desc', page_size: 5 })

        expect(result.fromCache).toBe(true)
        expect(result.items[0].id).toBe(20)
        expect(result.items[4].id).toBe(16)
      })
    })

    describe('QueryExecutor integration', () => {
      // Note: QueryExecutor filters are used via query() method which uses cache
      // list() with filters fetches from API unless cacheSafe=true

      it('filters with $gt operator via query()', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(20)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache
        await manager.list({ page_size: 100 })

        // Price > 100 means items with price 110, 120, ..., 200 (10 items)
        const result = await manager.query({ filters: { price: { $gt: 100 } } })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(10)
        expect(result.items.every(item => item.price > 100)).toBe(true)

        consoleSpy.mockRestore()
      })

      it('filters with $in operator via query()', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(20)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache
        await manager.list({ page_size: 100 })

        const result = await manager.query({ filters: { id: { $in: [1, 5, 10] } } })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(3)
        expect(result.items.map(i => i.id).sort((a, b) => a - b)).toEqual([1, 5, 10])

        consoleSpy.mockRestore()
      })

      it('filters with $lte operator via query()', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(20)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache
        await manager.list({ page_size: 100 })

        // Price <= 50 means items with price 10, 20, 30, 40, 50 (5 items)
        const result = await manager.query({ filters: { price: { $lte: 50 } } })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(5)
        expect(result.items.every(item => item.price <= 50)).toBe(true)

        consoleSpy.mockRestore()
      })

      it('combines multiple filter operators via query()', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache
        await manager.list({ page_size: 100 })

        // Active items with price > 100
        const result = await manager.query({
          filters: {
            status: 'active',
            price: { $gt: 100 }
          }
        })

        expect(result.fromCache).toBe(true)
        // Active items (even IDs) with price > 100 (IDs 12, 14, ..., 50)
        expect(result.items.every(item =>
          item.status === 'active' && item.price > 100
        )).toBe(true)

        consoleSpy.mockRestore()
      })

      it('uses implicit $eq for simple values via list() with cacheSafe', async () => {
        const storage = createStorageWithItems(20)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache
        await manager.list({ page_size: 100 })

        const result = await manager.list({ filters: { id: 5 }, cacheSafe: true })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(1)
        expect(result.items[0].id).toBe(5)
      })

      it('uses implicit $in for array values via list() with cacheSafe', async () => {
        const storage = createStorageWithItems(20)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items into cache
        await manager.list({ page_size: 100 })

        // Array values are treated as implicit $in
        const result = await manager.list({ filters: { status: ['active', 'inactive'] }, cacheSafe: true })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(20) // All items match
      })
    })

    describe('getCacheInfo() method', () => {
      it('returns correct structure', async () => {
        const storage = createStorageWithItems(30)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 50
        })

        await manager.list()

        const info = manager.getCacheInfo()

        expect(info).toHaveProperty('enabled')
        expect(info).toHaveProperty('storageSupportsTotal')
        expect(info).toHaveProperty('threshold')
        expect(info).toHaveProperty('valid')
        expect(info).toHaveProperty('overflow')
        expect(info).toHaveProperty('itemCount')
        expect(info).toHaveProperty('total')
        expect(info).toHaveProperty('loadedAt')
      })

      it('shows enabled=true when caching conditions are met', async () => {
        const storage = createStorageWithItems(10)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        const info = manager.getCacheInfo()

        expect(info.enabled).toBe(true)
        expect(info.storageSupportsTotal).toBe(true)
        expect(info.threshold).toBe(100)
      })

      it('shows valid=true and correct counts after caching', async () => {
        const storage = createStorageWithItems(25)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items to fully populate cache
        await manager.list({ page_size: 100 })

        const info = manager.getCacheInfo()

        expect(info.valid).toBe(true)
        expect(info.itemCount).toBe(25)
        expect(info.total).toBe(25)
        expect(info.overflow).toBe(false)
        expect(info.loadedAt).not.toBeNull()
      })

      it('shows overflow=true when cached items < total', async () => {
        const storage = createStorageWithItems(10)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Manually simulate overflow state (cache has fewer items than total)
        manager._cache.valid = true
        manager._cache.items = [{ id: 1 }]
        manager._cache.total = 10

        const info = manager.getCacheInfo()

        expect(info.overflow).toBe(true)
      })
    })

    describe('query() method', () => {
      it('uses cache for filtered queries when cache is fully loaded', async () => {
        const storage = createStorageWithItems(30)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Fill cache with all items
        await manager.list({ page_size: 100 })

        const result = await manager.query({ filters: { status: 'active' } })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(15) // Half of 30 are active
      })

      it('query() auto-fills cache before filtering', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(50)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Call query directly without filling cache first
        // query() should auto-fill cache with page_size: threshold
        const result = await manager.query({ filters: { status: 'active' } })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(25) // Half of 50 are active

        consoleSpy.mockRestore()
      })

      it('handles total > threshold case', async () => {
        // Suppress console.log during test
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        const storage = createStorageWithItems(150)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        const result = await manager.query({ filters: { status: 'active' } })

        // Note: When total > threshold, query() first calls list({ page_size: threshold })
        // which doesn't populate cache (because total > threshold check in list()).
        // Then query() filters locally on empty cache (current behavior).
        // This results in fromCache: true but with filtered results from the attempted
        // first list() call, then falling through to local filtering.

        // Verify the cache wasn't populated because total > threshold
        expect(manager.getCacheInfo().valid).toBe(false)
        expect(manager.getCacheInfo().itemCount).toBe(0)

        consoleSpy.mockRestore()
      })
    })

    describe('cacheSafe filter option', () => {
      it('allows caching even with filters when cacheSafe=true', async () => {
        const storage = createStorageWithItems(30)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // First call with cacheSafe filter
        await manager.list({ filters: { user_id: 1 }, cacheSafe: true })

        // Cache should be populated
        expect(manager.getCacheInfo().valid).toBe(true)

        // Second call should use cache
        const result = await manager.list({ cacheSafe: true })
        expect(result.fromCache).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('handles empty storage', async () => {
        const storage = new CacheableStorage({ initialData: [] })
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        const result = await manager.list()

        expect(result.items).toEqual([])
        expect(result.total).toBe(0)
        expect(manager.getCacheInfo().valid).toBe(true)
        expect(manager.getCacheInfo().itemCount).toBe(0)
      })

      it('handles exactly threshold items', async () => {
        const storage = createStorageWithItems(100)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all 100 items (exactly at threshold)
        await manager.list({ page_size: 100 })

        expect(manager.getCacheInfo().valid).toBe(true)
        expect(manager.getCacheInfo().itemCount).toBe(100)
      })

      it('null/empty filter values are skipped', async () => {
        const storage = createStorageWithItems(20)
        const manager = new EntityManager({
          name: 'products',
          storage,
          localFilterThreshold: 100
        })

        // Load all items
        await manager.list({ page_size: 100 })

        // Filters with null/empty values should be ignored
        // Use cacheSafe to test cache filtering
        const result = await manager.list({
          filters: {
            status: null,
            name: '',
            id: undefined
          },
          cacheSafe: true
        })

        expect(result.fromCache).toBe(true)
        expect(result.total).toBe(20) // All items returned
      })
    })
  })

  describe('searchFields capability (PRD-009)', () => {
    /**
     * Storage with searchFields capability
     * Note: Fully define capabilities to avoid spread issues with static properties
     */
    class SearchableStorage extends MemoryStorage {
      static capabilities = {
        supportsTotal: true,
        supportsFilters: true,
        supportsPagination: true,
        supportsCaching: true,
        searchFields: ['title', 'author']
      }

      get supportsCaching() {
        return SearchableStorage.capabilities.supportsCaching
      }
    }

    /**
     * Storage without searchFields (backward compat)
     */
    class NoSearchFieldsStorage extends MemoryStorage {
      static capabilities = {
        supportsTotal: true,
        supportsFilters: true,
        supportsPagination: true,
        supportsCaching: true
        // no searchFields declared
      }

      get supportsCaching() {
        return NoSearchFieldsStorage.capabilities.supportsCaching
      }
    }

    /**
     * Storage with parent field in searchFields (for M1 test)
     */
    class ParentFieldStorage extends MemoryStorage {
      static capabilities = {
        supportsTotal: true,
        supportsFilters: true,
        supportsPagination: true,
        supportsCaching: true,
        searchFields: ['title', 'book.author']
      }

      get supportsCaching() {
        return ParentFieldStorage.capabilities.supportsCaching
      }
    }

    /**
     * Storage with numeric field in searchFields
     */
    class NumericSearchStorage extends MemoryStorage {
      static capabilities = {
        supportsTotal: true,
        supportsFilters: true,
        supportsPagination: true,
        supportsCaching: true,
        searchFields: ['title', 'year']
      }

      get supportsCaching() {
        return NumericSearchStorage.capabilities.supportsCaching
      }
    }

    const testItems = [
      { id: 1, title: 'The Great Gatsby', author: 'Fitzgerald', genre: 'fiction', year: 1925 },
      { id: 2, title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'fiction', year: 1960 },
      { id: 3, title: '1984', author: 'George Orwell', genre: 'dystopia', year: 1949 },
      { id: 4, title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'romance', year: 1813 }
    ]

    describe('storageSearchFields getter', () => {
      it('returns searchFields from storage capabilities', () => {
        const storage = new SearchableStorage()
        const manager = new EntityManager({ name: 'books', storage })

        expect(manager.storageSearchFields).toEqual(['title', 'author'])
      })

      it('returns undefined when storage has no searchFields', () => {
        const storage = new NoSearchFieldsStorage()
        const manager = new EntityManager({ name: 'books', storage })

        expect(manager.storageSearchFields).toBeUndefined()
      })

      it('returns undefined when storage has no capabilities', () => {
        const storage = new MemoryStorage()
        delete storage.constructor.capabilities
        const manager = new EntityManager({ name: 'books', storage })

        expect(manager.storageSearchFields).toBeUndefined()
      })
    })

    describe('_filterLocally with searchFields', () => {
      it('searches only in declared fields when searchFields is defined', async () => {
        const storage = new SearchableStorage()
        for (const item of testItems) {
          await storage.create(item)
        }

        const manager = new EntityManager({
          name: 'books',
          storage,
          localFilterThreshold: 100
        })

        // Load into cache
        await manager.list({ page_size: 100 })

        // Search for 'fiction' - should NOT match because genre is not in searchFields
        const result = await manager.list({ search: 'fiction', cacheSafe: true })
        expect(result.total).toBe(0)
      })

      it('finds matches in declared searchFields', async () => {
        const storage = new SearchableStorage()
        for (const item of testItems) {
          await storage.create(item)
        }

        const manager = new EntityManager({
          name: 'books',
          storage,
          localFilterThreshold: 100
        })

        // Load into cache
        await manager.list({ page_size: 100 })

        // Search for 'gatsby' - should match title
        const result = await manager.list({ search: 'gatsby', cacheSafe: true })
        expect(result.total).toBe(1)
        expect(result.items[0].title).toBe('The Great Gatsby')
      })

      it('searches in author field (declared in searchFields)', async () => {
        const storage = new SearchableStorage()
        for (const item of testItems) {
          await storage.create(item)
        }

        const manager = new EntityManager({
          name: 'books',
          storage,
          localFilterThreshold: 100
        })

        // Load into cache
        await manager.list({ page_size: 100 })

        // Search for 'orwell' - should match author
        const result = await manager.list({ search: 'orwell', cacheSafe: true })
        expect(result.total).toBe(1)
        expect(result.items[0].author).toBe('George Orwell')
      })

      it('searches all string fields when searchFields not declared', async () => {
        const storage = new NoSearchFieldsStorage()
        for (const item of testItems) {
          await storage.create(item)
        }

        const manager = new EntityManager({
          name: 'books',
          storage,
          localFilterThreshold: 100
        })

        // Load into cache
        await manager.list({ page_size: 100 })

        // Search for 'fiction' - should match genre (all fields searched)
        const result = await manager.list({ search: 'fiction', cacheSafe: true })
        expect(result.total).toBe(2) // Gatsby and Mockingbird
      })

      it('ignores parent fields (dot notation) in M1', async () => {
        const storage = new ParentFieldStorage()
        await storage.create({ id: 1, title: 'Test', book_id: 'b1' })

        const manager = new EntityManager({
          name: 'loans',
          storage,
          localFilterThreshold: 100
        })

        // Load into cache
        await manager.list({ page_size: 100 })

        // Search should only check 'title', skip 'book.author' (M2 feature)
        const result = await manager.list({ search: 'test', cacheSafe: true })
        expect(result.total).toBe(1)
      })

      it('handles numeric fields in searchFields', async () => {
        const storage = new NumericSearchStorage()
        for (const item of testItems) {
          await storage.create(item)
        }

        const manager = new EntityManager({
          name: 'books',
          storage,
          localFilterThreshold: 100
        })

        // Load into cache
        await manager.list({ page_size: 100 })

        // Search for year
        const result = await manager.list({ search: '1925', cacheSafe: true })
        expect(result.total).toBe(1)
        expect(result.items[0].year).toBe(1925)
      })
    })
  })

  describe('parents config and field resolution (PRD-009 M2)', () => {
    describe('parents config', () => {
      it('stores parents config in _parents property', () => {
        const manager = new EntityManager({
          name: 'loans',
          parents: {
            book: { entity: 'books', foreignKey: 'book_id' },
            user: { entity: 'users', foreignKey: 'user_id' }
          }
        })

        expect(manager._parents).toEqual({
          book: { entity: 'books', foreignKey: 'book_id' },
          user: { entity: 'users', foreignKey: 'user_id' }
        })
      })

      it('has empty _parents when not configured', () => {
        const manager = new EntityManager({ name: 'books' })
        expect(manager._parents).toEqual({})
      })
    })

    describe('_parseSearchFields', () => {
      class ParentSearchStorage extends MemoryStorage {
        static capabilities = {
          supportsTotal: true,
          supportsFilters: true,
          supportsPagination: true,
          supportsCaching: true,
          searchFields: ['title', 'book.title', 'user.username']
        }

        get supportsCaching() {
          return ParentSearchStorage.capabilities.supportsCaching
        }
      }

      it('separates own fields from parent fields', () => {
        const storage = new ParentSearchStorage()
        const manager = new EntityManager({
          name: 'loans',
          storage,
          parents: {
            book: { entity: 'books', foreignKey: 'book_id' },
            user: { entity: 'users', foreignKey: 'user_id' }
          }
        })

        const { ownFields, parentFields } = manager._parseSearchFields()

        expect(ownFields).toEqual(['title'])
        expect(parentFields).toEqual({
          book: ['title'],
          user: ['username']
        })
      })

      it('groups multiple fields per parent', () => {
        class MultiFieldStorage extends MemoryStorage {
          static capabilities = {
            supportsTotal: true,
            supportsFilters: true,
            supportsPagination: true,
            supportsCaching: true,
            searchFields: ['book.title', 'book.author', 'book.isbn']
          }

          get supportsCaching() {
            return MultiFieldStorage.capabilities.supportsCaching
          }
        }

        const storage = new MultiFieldStorage()
        const manager = new EntityManager({
          name: 'loans',
          storage,
          parents: {
            book: { entity: 'books', foreignKey: 'book_id' }
          }
        })

        const { ownFields, parentFields } = manager._parseSearchFields()

        expect(ownFields).toEqual([])
        expect(parentFields).toEqual({
          book: ['title', 'author', 'isbn']
        })
      })

      it('skips unknown parent keys with warning', () => {
        class UnknownParentStorage extends MemoryStorage {
          static capabilities = {
            supportsTotal: true,
            supportsFilters: true,
            supportsPagination: true,
            supportsCaching: true,
            searchFields: ['unknown.field']
          }

          get supportsCaching() {
            return UnknownParentStorage.capabilities.supportsCaching
          }
        }

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const storage = new UnknownParentStorage()
        const manager = new EntityManager({
          name: 'loans',
          storage,
          parents: {
            book: { entity: 'books', foreignKey: 'book_id' }
          }
        })

        const { ownFields, parentFields } = manager._parseSearchFields()

        expect(ownFields).toEqual([])
        expect(parentFields).toEqual({})
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Unknown parent 'unknown'")
        )

        warnSpy.mockRestore()
      })

      it('returns empty arrays when no searchFields', () => {
        const storage = new MemoryStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })

        const { ownFields, parentFields } = manager._parseSearchFields()

        expect(ownFields).toEqual([])
        expect(parentFields).toEqual({})
      })
    })

    describe('non-enumerable _search property', () => {
      it('_search is not included in JSON.stringify', () => {
        const item = { id: 1, title: 'Test' }

        Object.defineProperty(item, '_search', {
          value: { 'book.title': 'Gatsby' },
          enumerable: false,
          writable: true,
          configurable: true
        })

        const json = JSON.stringify(item)
        expect(json).toBe('{"id":1,"title":"Test"}')
        expect(json).not.toContain('_search')
      })

      it('_search is not included in Object.keys', () => {
        const item = { id: 1, title: 'Test' }

        Object.defineProperty(item, '_search', {
          value: { 'book.title': 'Gatsby' },
          enumerable: false,
          writable: true,
          configurable: true
        })

        expect(Object.keys(item)).toEqual(['id', 'title'])
      })

      it('_search is not included in for...in loop', () => {
        const item = { id: 1, title: 'Test' }

        Object.defineProperty(item, '_search', {
          value: { 'book.title': 'Gatsby' },
          enumerable: false,
          writable: true,
          configurable: true
        })

        const keys = []
        for (const key in item) {
          keys.push(key)
        }

        expect(keys).toEqual(['id', 'title'])
      })

      it('_search is accessible for reading/writing', () => {
        const item = { id: 1, title: 'Test' }

        Object.defineProperty(item, '_search', {
          value: {},
          enumerable: false,
          writable: true,
          configurable: true
        })

        item._search['book.title'] = 'Gatsby'
        expect(item._search['book.title']).toBe('Gatsby')
      })
    })
  })
})
