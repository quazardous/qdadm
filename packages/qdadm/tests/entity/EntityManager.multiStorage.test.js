/**
 * Unit tests for EntityManager multi-storage / context-aware routing
 *
 * Tests the ability for EntityManager to route to different storages
 * based on calling context (e.g., parent entity).
 *
 * Topologies tested:
 * 1. Simple case - single storage (no change in behavior)
 * 2. Parent context - /bots/:id/commands
 * 3. Nested parents - /users/:id/posts/:postId/comments
 * 4. Mixed endpoints with different param mappings
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EntityManager } from '../../src/entity/EntityManager.js'
import { MemoryStorage } from '../../src/entity/storage/MemoryStorage.js'

/**
 * Mock storage that tracks calls for testing
 */
class MockStorage extends MemoryStorage {
  constructor(options = {}) {
    super()
    this.name = options.name || 'default'
    this.endpoint = options.endpoint || '/api/items'
    this.calls = []
  }

  async list(params = {}) {
    this.calls.push({ method: 'list', params })
    return super.list(params)
  }

  async get(id) {
    this.calls.push({ method: 'get', id })
    return super.get(id)
  }

  async create(data) {
    this.calls.push({ method: 'create', data })
    return super.create(data)
  }

  async update(id, data) {
    this.calls.push({ method: 'update', id, data })
    return super.update(id, data)
  }

  async delete(id) {
    this.calls.push({ method: 'delete', id })
    return super.delete(id)
  }

  async request(method, path, options = {}) {
    this.calls.push({ method: 'request', httpMethod: method, path, options })
    // Simulate request behavior - call MemoryStorage directly to avoid double-tracking
    if (method === 'POST') {
      return super.create(options.data)
    }
    if (method === 'GET') {
      return super.list(options.params || {})
    }
    return { success: true }
  }

  reset() {
    this.calls = []
  }
}

describe('EntityManager Multi-Storage', () => {
  describe('Single storage (default behavior)', () => {
    let manager
    let storage

    beforeEach(() => {
      storage = new MockStorage({ name: 'default', endpoint: '/api/items' })
      manager = new EntityManager({
        name: 'items',
        storage
      })
    })

    it('uses default storage for list()', async () => {
      await manager.list()
      expect(storage.calls).toHaveLength(1)
      expect(storage.calls[0].method).toBe('list')
    })

    it('uses default storage for create()', async () => {
      await manager.create({ name: 'Test' })
      expect(storage.calls).toHaveLength(1)
      expect(storage.calls[0].method).toBe('create')
    })

    it('uses default storage for get()', async () => {
      await storage.create({ id: '1', name: 'Test' })
      storage.reset()

      await manager.get('1')
      expect(storage.calls).toHaveLength(1)
      expect(storage.calls[0].method).toBe('get')
    })

    it('uses default storage for update()', async () => {
      await storage.create({ id: '1', name: 'Test' })
      storage.reset()

      await manager.update('1', { name: 'Updated' })
      expect(storage.calls).toHaveLength(1)
      expect(storage.calls[0].method).toBe('update')
    })

    it('uses default storage for delete()', async () => {
      await storage.create({ id: '1', name: 'Test' })
      storage.reset()

      await manager.delete('1')
      expect(storage.calls).toHaveLength(1)
      expect(storage.calls[0].method).toBe('delete')
    })

    it('resolveStorage returns default storage without context', () => {
      const result = manager.resolveStorage('list')
      expect(result.storage).toBe(storage)
      expect(result.path).toBeUndefined()
    })

    it('resolveStorage returns default storage with empty context', () => {
      const result = manager.resolveStorage('list', {})
      expect(result.storage).toBe(storage)
    })
  })

  describe('Parent context routing - Bots/Commands topology', () => {
    let manager
    let globalStorage
    let botStorage

    /**
     * CommandsManager - routes to different storage based on parent context
     *
     * Without context: GET /api/admin/commands
     * With bot parent: GET /api/admin/bots/:id/commands
     */
    class CommandsManager extends EntityManager {
      constructor() {
        const global = new MockStorage({ name: 'global', endpoint: '/api/admin/commands' })
        super({
          name: 'commands',
          storage: global
        })
        this.globalStorage = global
        this.botStorage = new MockStorage({ name: 'forBot', endpoint: '/api/admin/bots' })
      }

      resolveStorage(method, context) {
        const parent = context?.parentChain?.at(-1)
        if (parent?.entity === 'bots') {
          return {
            storage: this.botStorage,
            path: `/${parent.id}/commands`
          }
        }
        return { storage: this.storage }
      }

      // Override methods to use context-aware routing
      async list(params = {}, context) {
        const { storage, path } = this.resolveStorage('list', context)
        if (path) {
          return storage.request('GET', path, { params })
        }
        return storage.list(params)
      }

      async create(data, context) {
        const { storage, path } = this.resolveStorage('create', context)
        if (path) {
          return storage.request('POST', path, { data })
        }
        return storage.create(data)
      }
    }

    beforeEach(() => {
      manager = new CommandsManager()
      globalStorage = manager.globalStorage
      botStorage = manager.botStorage
    })

    it('uses global storage without context', async () => {
      await manager.list()

      expect(globalStorage.calls).toHaveLength(1)
      expect(globalStorage.calls[0].method).toBe('list')
      expect(botStorage.calls).toHaveLength(0)
    })

    it('uses bot storage with parent context', async () => {
      const context = { parentChain: [{ entity: 'bots', id: 'bot-123' }] }
      await manager.list({}, context)

      expect(botStorage.calls).toHaveLength(1)
      expect(botStorage.calls[0].method).toBe('request')
      expect(botStorage.calls[0].path).toBe('/bot-123/commands')
      expect(globalStorage.calls).toHaveLength(0)
    })

    it('routes create to bot storage with parent context', async () => {
      const context = { parentChain: [{ entity: 'bots', id: 'bot-456' }] }
      await manager.create({ command: 'restart' }, context)

      expect(botStorage.calls).toHaveLength(1)
      expect(botStorage.calls[0].method).toBe('request')
      expect(botStorage.calls[0].httpMethod).toBe('POST')
      expect(botStorage.calls[0].path).toBe('/bot-456/commands')
      expect(botStorage.calls[0].options.data).toEqual({ command: 'restart' })
    })

    it('routes create to global storage without context', async () => {
      await manager.create({ command: 'restart', filter: { tags: ['prod'] } })

      expect(globalStorage.calls).toHaveLength(1)
      expect(globalStorage.calls[0].method).toBe('create')
      expect(botStorage.calls).toHaveLength(0)
    })

    it('resolveStorage returns correct storage and path', () => {
      const context = { parentChain: [{ entity: 'bots', id: 'bot-789' }] }
      const result = manager.resolveStorage('list', context)

      expect(result.storage).toBe(botStorage)
      expect(result.path).toBe('/bot-789/commands')
    })
  })

  describe('Nested parent context - Users/Posts/Comments topology', () => {
    let manager
    let globalStorage
    let postStorage
    let userPostStorage

    /**
     * CommentsManager - supports multiple parent contexts
     *
     * Global: GET /api/comments
     * Under post: GET /api/posts/:postId/comments
     * Under user's post: GET /api/users/:userId/posts/:postId/comments
     */
    class CommentsManager extends EntityManager {
      constructor() {
        const global = new MockStorage({ name: 'global', endpoint: '/api/comments' })
        super({
          name: 'comments',
          storage: global
        })
        this.globalStorage = global
        this.postStorage = new MockStorage({ name: 'forPost', endpoint: '/api/posts' })
        this.userPostStorage = new MockStorage({ name: 'forUserPost', endpoint: '/api/users' })
      }

      resolveStorage(method, context) {
        const chain = context?.parentChain || []
        const parent = chain.at(-1)  // Direct parent (last in chain)

        // Check for nested parent chain: user -> post -> comment
        if (chain.length === 2 && chain[0].entity === 'users' && chain[1].entity === 'posts') {
          return {
            storage: this.userPostStorage,
            path: `/${chain[0].id}/posts/${chain[1].id}/comments`
          }
        }

        // Check for single parent: post -> comment
        if (parent?.entity === 'posts') {
          return {
            storage: this.postStorage,
            path: `/${parent.id}/comments`
          }
        }

        return { storage: this.storage }
      }

      async list(params = {}, context) {
        const { storage, path } = this.resolveStorage('list', context)
        if (path) {
          return storage.request('GET', path, { params })
        }
        return storage.list(params)
      }
    }

    beforeEach(() => {
      manager = new CommentsManager()
      globalStorage = manager.globalStorage
      postStorage = manager.postStorage
      userPostStorage = manager.userPostStorage
    })

    it('uses global storage without context', async () => {
      await manager.list()

      expect(globalStorage.calls).toHaveLength(1)
      expect(postStorage.calls).toHaveLength(0)
      expect(userPostStorage.calls).toHaveLength(0)
    })

    it('uses post storage with post parent', async () => {
      const context = { parentChain: [{ entity: 'posts', id: 'post-123' }] }
      await manager.list({}, context)

      expect(postStorage.calls).toHaveLength(1)
      expect(postStorage.calls[0].path).toBe('/post-123/comments')
      expect(globalStorage.calls).toHaveLength(0)
      expect(userPostStorage.calls).toHaveLength(0)
    })

    it('uses userPost storage with nested parents', async () => {
      const context = {
        parentChain: [
          { entity: 'users', id: 'user-789' },
          { entity: 'posts', id: 'post-456' }
        ]
      }
      await manager.list({}, context)

      expect(userPostStorage.calls).toHaveLength(1)
      expect(userPostStorage.calls[0].path).toBe('/user-789/posts/post-456/comments')
      expect(globalStorage.calls).toHaveLength(0)
      expect(postStorage.calls).toHaveLength(0)
    })
  })

  describe('Different param mappings per storage', () => {
    let manager

    /**
     * OrdersManager - different param mappings for different contexts
     *
     * Global: status filter uses 'orderStatus'
     * Under customer: status filter uses 'status' (simpler API)
     */
    class OrdersManager extends EntityManager {
      constructor() {
        const global = new MockStorage({ name: 'global', endpoint: '/api/orders' })
        super({
          name: 'orders',
          storage: global
        })
        this.globalStorage = global
        this.customerStorage = new MockStorage({ name: 'forCustomer', endpoint: '/api/customers' })

        // Different mappings per storage
        this.paramMappings = {
          global: { status: 'orderStatus', type: 'orderType' },
          customer: { status: 'status' }  // simpler mapping
        }
      }

      applyParamMapping(params, mappingKey) {
        const mapping = this.paramMappings[mappingKey] || {}
        const result = {}
        for (const [key, value] of Object.entries(params)) {
          const mappedKey = mapping[key] || key
          result[mappedKey] = value
        }
        return result
      }

      resolveStorage(method, context) {
        const parent = context?.parentChain?.at(-1)
        if (parent?.entity === 'customers') {
          return {
            storage: this.customerStorage,
            path: `/${parent.id}/orders`,
            mappingKey: 'customer'
          }
        }
        return { storage: this.storage, mappingKey: 'global' }
      }

      async list(params = {}, context) {
        const { storage, path, mappingKey } = this.resolveStorage('list', context)
        const mappedParams = this.applyParamMapping(params, mappingKey)

        if (path) {
          return storage.request('GET', path, { params: mappedParams })
        }
        return storage.list(mappedParams)
      }
    }

    beforeEach(() => {
      manager = new OrdersManager()
    })

    it('applies global mapping without context', async () => {
      await manager.list({ status: 'pending', type: 'subscription' })

      const call = manager.globalStorage.calls[0]
      expect(call.params).toEqual({ orderStatus: 'pending', orderType: 'subscription' })
    })

    it('applies customer mapping with parent context', async () => {
      const context = { parentChain: [{ entity: 'customers', id: 'cust-123' }] }
      await manager.list({ status: 'pending', type: 'subscription' }, context)

      const call = manager.customerStorage.calls[0]
      expect(call.options.params).toEqual({ status: 'pending', type: 'subscription' })
    })
  })

  describe('Lazy storage initialization', () => {
    let manager
    let storageCreationCount

    /**
     * Manager that creates storages lazily on first use
     */
    class LazyManager extends EntityManager {
      constructor() {
        super({
          name: 'items',
          storage: new MockStorage({ name: 'default' })
        })
        this._parentStorage = null
        this.storageCreationCount = 0
      }

      get parentStorage() {
        if (!this._parentStorage) {
          this.storageCreationCount++
          this._parentStorage = new MockStorage({ name: 'parent' })
        }
        return this._parentStorage
      }

      resolveStorage(method, context) {
        const parent = context?.parentChain?.at(-1)
        if (parent) {
          return {
            storage: this.parentStorage,
            path: `/${parent.id}/items`
          }
        }
        return { storage: this.storage }
      }

      async list(params = {}, context) {
        const { storage, path } = this.resolveStorage('list', context)
        if (path) {
          return storage.request('GET', path, { params })
        }
        return storage.list(params)
      }
    }

    beforeEach(() => {
      manager = new LazyManager()
    })

    it('does not create parent storage until needed', () => {
      expect(manager.storageCreationCount).toBe(0)
    })

    it('creates parent storage on first parent context call', async () => {
      await manager.list({}, { parentChain: [{ entity: 'parents', id: '1' }] })
      expect(manager.storageCreationCount).toBe(1)
    })

    it('reuses parent storage on subsequent calls', async () => {
      await manager.list({}, { parentChain: [{ entity: 'parents', id: '1' }] })
      await manager.list({}, { parentChain: [{ entity: 'parents', id: '2' }] })
      await manager.list({}, { parentChain: [{ entity: 'parents', id: '3' }] })
      expect(manager.storageCreationCount).toBe(1)
    })
  })

  describe('Context passed through standard methods', () => {
    let manager
    let storage

    beforeEach(() => {
      storage = new MockStorage({ name: 'default' })
      manager = new EntityManager({
        name: 'items',
        storage
      })
    })

    it('list accepts context as second parameter', async () => {
      const spy = vi.spyOn(manager, 'resolveStorage')
      const context = { parentChain: [{ entity: 'parents', id: '1' }] }

      await manager.list({}, context)

      expect(spy).toHaveBeenCalledWith('list', context)
    })

    it('create accepts context as second parameter', async () => {
      const spy = vi.spyOn(manager, 'resolveStorage')
      const context = { parentChain: [{ entity: 'parents', id: '1' }] }

      await manager.create({ name: 'Test' }, context)

      expect(spy).toHaveBeenCalledWith('create', context)
    })

    it('get accepts context as second parameter', async () => {
      await storage.create({ id: '1', name: 'Test' })
      const spy = vi.spyOn(manager, 'resolveStorage')
      const context = { parentChain: [{ entity: 'parents', id: '1' }] }

      await manager.get('1', context)

      expect(spy).toHaveBeenCalledWith('get', context)
    })

    it('update accepts context as third parameter', async () => {
      await storage.create({ id: '1', name: 'Test' })
      const spy = vi.spyOn(manager, 'resolveStorage')
      const context = { parentChain: [{ entity: 'parents', id: '1' }] }

      await manager.update('1', { name: 'Updated' }, context)

      expect(spy).toHaveBeenCalledWith('update', context)
    })

    it('delete accepts context as second parameter', async () => {
      await storage.create({ id: '1', name: 'Test' })
      const spy = vi.spyOn(manager, 'resolveStorage')
      const context = { parentChain: [{ entity: 'parents', id: '1' }] }

      await manager.delete('1', context)

      expect(spy).toHaveBeenCalledWith('delete', context)
    })
  })
})
