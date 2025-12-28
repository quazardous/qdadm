/**
 * Unit tests for EntityManager canAccess method
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { EntityManager, createEntityManager } from '../../src/entity/EntityManager.js'
import {
  AuthAdapter,
  AuthActions,
  PermissiveAuthAdapter
} from '../../src/entity/auth/index.js'

/**
 * Test AuthAdapter that denies specific actions/records
 */
class RestrictiveAuthAdapter extends AuthAdapter {
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

        const presaveHooks = hooks.getInvokedHooks().filter(h => h.name.endsWith(':presave'))
        expect(presaveHooks.length).toBe(2)
        expect(presaveHooks[0].name).toBe('books:presave')
        expect(presaveHooks[1].name).toBe('entity:presave')
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

        const postsaveHooks = hooks.getInvokedHooks().filter(h => h.name.endsWith(':postsave'))
        expect(postsaveHooks.length).toBe(2)
        expect(postsaveHooks[0].name).toBe('books:postsave')
        expect(postsaveHooks[1].name).toBe('entity:postsave')
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

        const presaveHook = hooks.getInvokedHooks().find(h => h.name === 'books:presave')
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

        const postsaveHook = hooks.getInvokedHooks().find(h => h.name === 'books:postsave')
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

        // Register handler that modifies record
        hooks.register('books:presave', (context) => {
          context.record.updated_at = '2024-01-01'
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
        hooks.register('books:presave', () => {
          throw new Error('Validation failed')
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

        const presaveHook = hooks.getInvokedHooks().find(h => h.name === 'books:presave')
        expect(presaveHook.context.isNew).toBe(false)
        expect(presaveHook.context.id).toBe(1)
      })

      it('invokes both entity-specific and generic hooks', async () => {
        const hooks = new MockHookRegistry()
        const storage = new MockStorage()
        const manager = new EntityManager({
          name: 'books',
          storage
        })
        manager.setHooks(hooks)

        await manager.update(1, { title: 'Updated Book' })

        const hookNames = hooks.getInvokedHooks().map(h => h.name)
        expect(hookNames).toContain('books:presave')
        expect(hookNames).toContain('entity:presave')
        expect(hookNames).toContain('books:postsave')
        expect(hookNames).toContain('entity:postsave')
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
        expect(hookNames).toContain('books:presave')
        expect(hookNames).toContain('entity:presave')
        expect(hookNames).toContain('books:postsave')
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

        const presaveHook = hooks.getInvokedHooks().find(h => h.name === 'books:presave')
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

        const predeleteHooks = hooks.getInvokedHooks().filter(h => h.name.endsWith(':predelete'))
        expect(predeleteHooks.length).toBe(2)
        expect(predeleteHooks[0].name).toBe('books:predelete')
        expect(predeleteHooks[1].name).toBe('entity:predelete')
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

        const predeleteHook = hooks.getInvokedHooks().find(h => h.name === 'books:predelete')
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

        hooks.register('books:predelete', () => {
          throw new Error('Cannot delete: has dependencies')
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
            order.push(`signal:${entityName}:${action}`)
          }
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
        expect(order.indexOf('hook:books:presave')).toBeLessThan(order.indexOf('signal:books:created'))
        expect(order.indexOf('hook:books:postsave')).toBeLessThan(order.indexOf('signal:books:created'))
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
  })
})
