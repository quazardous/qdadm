/**
 * Unit tests for Orchestrator entityAuthAdapter injection
 *
 * Run: npm test
 */
import { describe, it, expect } from 'vitest'
import { Orchestrator } from '../../src/orchestrator/Orchestrator.js'
import { EntityManager } from '../../src/entity/EntityManager.js'
import { AuthAdapter, PermissiveAuthAdapter } from '../../src/entity/auth/index.js'

/**
 * Test AuthAdapter that tracks which entity/action was checked
 */
class TrackerAuthAdapter extends AuthAdapter {
  constructor() {
    super()
    this.calls = []
  }

  canPerform(entity, action) {
    this.calls.push({ method: 'canPerform', entity, action })
    return true
  }

  canAccessRecord(entity, record) {
    this.calls.push({ method: 'canAccessRecord', entity, record })
    return true
  }

  getCurrentUser() {
    return { id: 1, role: 'test' }
  }
}

/**
 * Restrictive adapter for testing denials
 */
class RestrictiveAuthAdapter extends AuthAdapter {
  canPerform(entity, action) {
    return action === 'read'
  }

  canAccessRecord(entity, record) {
    return true
  }

  getCurrentUser() {
    return { id: 1 }
  }
}

describe('Orchestrator', () => {
  describe('entityAuthAdapter injection', () => {
    it('injects entityAuthAdapter into managers during registration', () => {
      const adapter = new TrackerAuthAdapter()
      const manager = new EntityManager({ name: 'users' })

      const orchestrator = new Orchestrator({
        managers: { users: manager },
        entityAuthAdapter: adapter
      })

      expect(manager.authAdapter).toBe(adapter)
    })

    it('stores entityAuthAdapter reference', () => {
      const adapter = new TrackerAuthAdapter()
      const orchestrator = new Orchestrator({
        entityAuthAdapter: adapter
      })

      expect(orchestrator.entityAuthAdapter).toBe(adapter)
    })

    it('respects manager own adapter (no override)', () => {
      const globalAdapter = new TrackerAuthAdapter()
      const managerAdapter = new RestrictiveAuthAdapter()
      const manager = new EntityManager({
        name: 'users',
        authAdapter: managerAdapter
      })

      const orchestrator = new Orchestrator({
        managers: { users: manager },
        entityAuthAdapter: globalAdapter
      })

      // Manager should keep its own adapter
      expect(manager.authAdapter).toBe(managerAdapter)
      expect(manager.authAdapter).not.toBe(globalAdapter)
    })

    it('injects adapter into managers registered later', () => {
      const adapter = new TrackerAuthAdapter()
      const orchestrator = new Orchestrator({
        entityAuthAdapter: adapter
      })

      const manager = new EntityManager({ name: 'books' })
      orchestrator.register('books', manager)

      expect(manager.authAdapter).toBe(adapter)
    })

    it('allows setting entityAuthAdapter after construction', () => {
      const adapter = new TrackerAuthAdapter()
      const orchestrator = new Orchestrator()

      orchestrator.setEntityAuthAdapter(adapter)
      expect(orchestrator.entityAuthAdapter).toBe(adapter)

      // Now register a manager
      const manager = new EntityManager({ name: 'products' })
      orchestrator.register('products', manager)

      expect(manager.authAdapter).toBe(adapter)
    })

    it('uses PermissiveAuthAdapter when no adapter injected', () => {
      const manager = new EntityManager({ name: 'users' })
      const orchestrator = new Orchestrator({
        managers: { users: manager }
      })

      // Manager uses lazy-initialized PermissiveAuthAdapter
      expect(manager.authAdapter).toBeInstanceOf(PermissiveAuthAdapter)
    })

    it('injected adapter affects canAccess checks', () => {
      const adapter = new RestrictiveAuthAdapter()
      const manager = new EntityManager({ name: 'users' })

      const orchestrator = new Orchestrator({
        managers: { users: manager },
        entityAuthAdapter: adapter
      })

      // RestrictiveAuthAdapter only allows 'read'
      expect(manager.canAccess('read')).toBe(true)
      expect(manager.canAccess('create')).toBe(false)
      expect(manager.canAccess('update')).toBe(false)
      expect(manager.canAccess('delete')).toBe(false)
    })

    it('injected adapter is used by multiple managers', () => {
      const adapter = new TrackerAuthAdapter()
      const usersManager = new EntityManager({ name: 'users' })
      const booksManager = new EntityManager({ name: 'books' })

      const orchestrator = new Orchestrator({
        managers: { users: usersManager, books: booksManager },
        entityAuthAdapter: adapter
      })

      // Both managers share the same adapter
      expect(usersManager.authAdapter).toBe(adapter)
      expect(booksManager.authAdapter).toBe(adapter)

      // Calls are tracked on the shared adapter
      usersManager.canAccess('read')
      booksManager.canAccess('create')

      expect(adapter.calls).toHaveLength(2)
      expect(adapter.calls[0]).toEqual({ method: 'canPerform', entity: 'users', action: 'read' })
      expect(adapter.calls[1]).toEqual({ method: 'canPerform', entity: 'books', action: 'create' })
    })

    it('allows mixed adapters (global + per-manager)', () => {
      const globalAdapter = new TrackerAuthAdapter()
      const customAdapter = new RestrictiveAuthAdapter()

      const usersManager = new EntityManager({
        name: 'users',
        authAdapter: customAdapter  // Custom adapter for users
      })
      const booksManager = new EntityManager({ name: 'books' })  // No adapter

      const orchestrator = new Orchestrator({
        managers: { users: usersManager, books: booksManager },
        entityAuthAdapter: globalAdapter
      })

      // Users has its custom adapter
      expect(usersManager.authAdapter).toBe(customAdapter)
      expect(usersManager.canAccess('create')).toBe(false) // RestrictiveAuthAdapter

      // Books uses the global adapter
      expect(booksManager.authAdapter).toBe(globalAdapter)
      expect(booksManager.canAccess('create')).toBe(true) // TrackerAuthAdapter
    })
  })
})
