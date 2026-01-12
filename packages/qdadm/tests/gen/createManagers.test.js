import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createManagers } from '../../src/gen/createManagers'
import { ManualConnector } from '../../src/gen/connectors/ManualConnector'
import { MemoryStorage } from '../../src/entity/storage/MemoryStorage'
import { EntityManager } from '../../src/entity/EntityManager'

/**
 * Sample config fixture - reusable test configuration
 */
function createSampleConfig() {
  const connector = new ManualConnector()
  const schemas = connector.parse([
    {
      name: 'users',
      endpoint: '/api/users',
      label: 'User',
      labelPlural: 'Users',
      labelField: 'name',
      idField: 'id',
      fields: {
        id: { name: 'id', type: 'number', readOnly: true },
        name: { name: 'name', type: 'text', required: true },
        email: { name: 'email', type: 'email', required: true },
        role: { name: 'role', type: 'text', enum: ['admin', 'user', 'guest'] },
        active: { name: 'active', type: 'boolean', default: true }
      }
    },
    {
      name: 'posts',
      endpoint: '/api/posts',
      label: 'Post',
      labelPlural: 'Posts',
      labelField: 'title',
      fields: {
        id: { name: 'id', type: 'number', readOnly: true },
        title: { name: 'title', type: 'text', required: true },
        content: { name: 'content', type: 'text' },
        author_id: { name: 'author_id', type: 'number', reference: { entity: 'users', field: 'id' } },
        status: { name: 'status', type: 'text', enum: ['draft', 'published', 'archived'] }
      }
    }
  ])

  // Storage profile factory using MemoryStorage
  const memoryProfile = (endpoint, options = {}) => {
    return new MemoryStorage({
      idField: 'id',
      initialData: []
    })
  }

  return {
    schemas: { api: schemas },
    storages: { memory: memoryProfile },
    entities: {
      users: { schema: 'api', storage: 'memory', endpoint: '/api/users' },
      posts: { schema: 'api', storage: 'memory', endpoint: '/api/posts' }
    }
  }
}

describe('createManagers', () => {
  describe('config validation', () => {
    it('throws if config is missing', () => {
      expect(() => createManagers()).toThrow('config is required')
    })

    it('throws if config is not an object', () => {
      expect(() => createManagers('invalid')).toThrow('config is required')
      expect(() => createManagers(null)).toThrow('config is required')
      expect(() => createManagers(123)).toThrow('config is required')
    })

    it('throws if schemas is missing', () => {
      expect(() => createManagers({})).toThrow('config.schemas is required')
    })

    it('throws if storages is missing', () => {
      expect(() => createManagers({ schemas: {} })).toThrow('config.storages is required')
    })

    it('throws if entities is missing', () => {
      expect(() => createManagers({ schemas: {}, storages: {} })).toThrow('config.entities is required')
    })

    it('throws if entity config is not an object', () => {
      expect(() => createManagers({
        schemas: {},
        storages: {},
        entities: { users: null }
      })).toThrow("entity 'users' config must be an object")
    })

    it('throws if entity schema property is missing', () => {
      expect(() => createManagers({
        schemas: {},
        storages: {},
        entities: { users: { storage: 'api', endpoint: '/users' } }
      })).toThrow("entity 'users' requires 'schema' property")
    })

    it('throws if entity storage property is missing', () => {
      expect(() => createManagers({
        schemas: { api: [] },
        storages: {},
        entities: { users: { schema: 'api', endpoint: '/users' } }
      })).toThrow("entity 'users' requires 'storage' property")
    })

    it('throws if entity endpoint property is missing', () => {
      expect(() => createManagers({
        schemas: { api: [] },
        storages: { memory: () => new MemoryStorage() },
        entities: { users: { schema: 'api', storage: 'memory' } }
      })).toThrow("entity 'users' requires 'endpoint' property")
    })

    it('throws if entity references unknown schema', () => {
      expect(() => createManagers({
        schemas: { api: [] },
        storages: { memory: () => new MemoryStorage() },
        entities: { users: { schema: 'unknown', storage: 'memory', endpoint: '/users' } }
      })).toThrow("entity 'users' references unknown schema 'unknown'")
    })

    it('throws if entity references unknown storage', () => {
      expect(() => createManagers({
        schemas: { api: [] },
        storages: { memory: () => new MemoryStorage() },
        entities: { users: { schema: 'api', storage: 'unknown', endpoint: '/users' } }
      })).toThrow("entity 'users' references unknown storage 'unknown'")
    })

    it('throws if storage factory is not a function', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'users', endpoint: '/users', fields: {} }
      ])

      expect(() => createManagers({
        schemas: { api: schemas },
        storages: { memory: 'not-a-function' },
        entities: { users: { schema: 'api', storage: 'memory', endpoint: '/users' } }
      })).toThrow("storage 'memory' must be a factory function")
    })

    it('throws if schema source is not an array', () => {
      expect(() => createManagers({
        schemas: { api: 'not-an-array' },
        storages: { memory: () => new MemoryStorage() },
        entities: { users: { schema: 'api', storage: 'memory', endpoint: '/users' } }
      })).toThrow("schema source 'api' must be an array")
    })

    it('throws if schema source is empty', () => {
      expect(() => createManagers({
        schemas: { api: [] },
        storages: { memory: () => new MemoryStorage() },
        entities: { users: { schema: 'api', storage: 'memory', endpoint: '/users' } }
      })).toThrow("schema source 'api' is empty")
    })
  })

  describe('manager creation with real connectors', () => {
    it('creates managers from ManualConnector schemas', () => {
      const config = createSampleConfig()
      const managers = createManagers(config)

      expect(managers).toBeInstanceOf(Map)
      expect(managers.size).toBe(2)
      expect(managers.has('users')).toBe(true)
      expect(managers.has('posts')).toBe(true)
    })

    it('created managers are EntityManager instances', () => {
      const config = createSampleConfig()
      const managers = createManagers(config)

      const usersManager = managers.get('users')
      const postsManager = managers.get('posts')

      expect(usersManager).toBeInstanceOf(EntityManager)
      expect(postsManager).toBeInstanceOf(EntityManager)
    })

    it('managers have correct name from schema', () => {
      const config = createSampleConfig()
      const managers = createManagers(config)

      expect(managers.get('users').name).toBe('users')
      expect(managers.get('posts').name).toBe('posts')
    })

    it('managers have correct metadata from schema', () => {
      const config = createSampleConfig()
      const managers = createManagers(config)

      const usersManager = managers.get('users')
      expect(usersManager.label).toBe('User')
      expect(usersManager.labelPlural).toBe('Users')
      expect(usersManager.idField).toBe('id')
    })

    it('managers have storage from profile factory', () => {
      const config = createSampleConfig()
      const managers = createManagers(config)

      const usersManager = managers.get('users')
      expect(usersManager.storage).toBeInstanceOf(MemoryStorage)
    })

    it('managers have fields from schema', () => {
      const config = createSampleConfig()
      const managers = createManagers(config)

      const usersManager = managers.get('users')
      const fields = usersManager.fields

      expect(fields).toBeDefined()
      expect(fields.id).toBeDefined()
      expect(fields.name).toBeDefined()
      expect(fields.email).toBeDefined()
      expect(fields.role).toBeDefined()
      expect(fields.active).toBeDefined()

      expect(fields.id.type).toBe('number')
      expect(fields.id.readOnly).toBe(true)
      expect(fields.email.type).toBe('email')
      expect(fields.email.required).toBe(true)
    })

    it('storage factory receives endpoint and entity options', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'users', endpoint: '/api/users', fields: {} }
      ])

      const factorySpy = vi.fn().mockReturnValue(new MemoryStorage())

      const managers = createManagers({
        schemas: { api: schemas },
        storages: { memory: factorySpy },
        entities: {
          users: {
            schema: 'api',
            storage: 'memory',
            endpoint: '/api/users',
            options: { timeout: 5000 }
          }
        }
      })

      expect(factorySpy).toHaveBeenCalledWith('/api/users', {
        entity: 'users',
        timeout: 5000
      })
    })

    it('uses single schema from source when only one available', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'singleEntity', endpoint: '/api/single', fields: {} }
      ])

      const managers = createManagers({
        schemas: { api: schemas },
        storages: { memory: () => new MemoryStorage() },
        entities: {
          // Entity name doesn't match schema name, but only one schema available
          myEntity: { schema: 'api', storage: 'memory', endpoint: '/api/single' }
        }
      })

      expect(managers.get('myEntity')).toBeInstanceOf(EntityManager)
      expect(managers.get('myEntity').name).toBe('singleEntity')
    })

    it('throws when entity not found in multi-schema source', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'users', endpoint: '/api/users', fields: {} },
        { name: 'posts', endpoint: '/api/posts', fields: {} }
      ])

      expect(() => createManagers({
        schemas: { api: schemas },
        storages: { memory: () => new MemoryStorage() },
        entities: {
          comments: { schema: 'api', storage: 'memory', endpoint: '/api/comments' }
        }
      })).toThrow("entity 'comments' not found in schema source 'api'. Available: users, posts")
    })
  })

  describe('decorator integration', () => {
    it('applies field decorators to schema', () => {
      const config = createSampleConfig()
      config.decorators = {
        users: {
          fields: {
            email: { hidden: true },
            name: { label: 'Full Name' }
          }
        }
      }

      const managers = createManagers(config)
      const usersManager = managers.get('users')

      expect(usersManager.fields.email.hidden).toBe(true)
      expect(usersManager.fields.name.label).toBe('Full Name')
    })

    it('preserves original schema properties with decorators', () => {
      const config = createSampleConfig()
      config.decorators = {
        users: {
          fields: {
            email: { label: 'Email Address' }
          }
        }
      }

      const managers = createManagers(config)
      const usersManager = managers.get('users')

      // Original properties preserved
      expect(usersManager.fields.email.type).toBe('email')
      expect(usersManager.fields.email.required).toBe(true)
      // Decorator applied
      expect(usersManager.fields.email.label).toBe('Email Address')
    })

    it('does not apply decorators when not defined for entity', () => {
      const config = createSampleConfig()
      config.decorators = {
        users: {
          fields: {
            email: { hidden: true }
          }
        }
        // No decorators for posts
      }

      const managers = createManagers(config)
      const postsManager = managers.get('posts')

      // Posts should have original schema without modifications
      expect(postsManager.fields.title.hidden).toBeUndefined()
    })

    it('applies readOnly decorator', () => {
      const config = createSampleConfig()
      config.decorators = {
        users: {
          fields: {
            name: { readOnly: true }
          }
        }
      }

      const managers = createManagers(config)
      const usersManager = managers.get('users')

      expect(usersManager.fields.name.readOnly).toBe(true)
    })

    it('applies order decorator', () => {
      const config = createSampleConfig()
      config.decorators = {
        users: {
          fields: {
            name: { order: 1 },
            email: { order: 2 },
            role: { order: 3 }
          }
        }
      }

      const managers = createManagers(config)
      const usersManager = managers.get('users')

      expect(usersManager.fields.name.order).toBe(1)
      expect(usersManager.fields.email.order).toBe(2)
      expect(usersManager.fields.role.order).toBe(3)
    })
  })

  describe('multiple storage profiles', () => {
    it('supports multiple storage profiles for different entities', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'users', endpoint: '/api/users', fields: {} },
        { name: 'settings', endpoint: '/settings', fields: {} }
      ])

      const apiProfile = vi.fn().mockReturnValue(new MemoryStorage())
      const localProfile = vi.fn().mockReturnValue(new MemoryStorage())

      const managers = createManagers({
        schemas: { api: schemas },
        storages: {
          api: apiProfile,
          local: localProfile
        },
        entities: {
          users: { schema: 'api', storage: 'api', endpoint: '/api/users' },
          settings: { schema: 'api', storage: 'local', endpoint: '/settings' }
        }
      })

      expect(apiProfile).toHaveBeenCalledWith('/api/users', { entity: 'users' })
      expect(localProfile).toHaveBeenCalledWith('/settings', { entity: 'settings' })
    })
  })

  describe('multiple schema sources', () => {
    it('supports multiple schema sources', () => {
      const connector = new ManualConnector()
      const apiSchemas = connector.parse([
        { name: 'users', endpoint: '/api/users', fields: {} }
      ])
      const internalSchemas = connector.parse([
        { name: 'settings', endpoint: '/internal/settings', fields: {} }
      ])

      const managers = createManagers({
        schemas: {
          api: apiSchemas,
          internal: internalSchemas
        },
        storages: { memory: () => new MemoryStorage() },
        entities: {
          users: { schema: 'api', storage: 'memory', endpoint: '/api/users' },
          settings: { schema: 'internal', storage: 'memory', endpoint: '/internal/settings' }
        }
      })

      expect(managers.size).toBe(2)
      expect(managers.get('users').name).toBe('users')
      expect(managers.get('settings').name).toBe('settings')
    })
  })

  describe('CRUD operations via created managers', () => {
    it('managers can perform CRUD operations', async () => {
      const config = createSampleConfig()
      const managers = createManagers(config)
      const usersManager = managers.get('users')

      // Create
      const created = await usersManager.create({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        active: true
      })
      expect(created.name).toBe('John Doe')
      expect(created.email).toBe('john@example.com')

      // Read
      const found = await usersManager.get(created.id)
      expect(found.name).toBe('John Doe')

      // Update
      const updated = await usersManager.update(created.id, {
        ...found,
        name: 'Jane Doe'
      })
      expect(updated.name).toBe('Jane Doe')

      // List
      const { items, total } = await usersManager.list()
      expect(items.length).toBe(1)
      expect(total).toBe(1)

      // Delete
      await usersManager.delete(created.id)
      const { items: afterDelete } = await usersManager.list()
      expect(afterDelete.length).toBe(0)
    })
  })

  describe('readOnly schema property', () => {
    it('passes readOnly property from schema to manager', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'logs', endpoint: '/api/logs', readOnly: true, fields: {} }
      ])

      const managers = createManagers({
        schemas: { api: schemas },
        storages: { memory: () => new MemoryStorage() },
        entities: {
          logs: { schema: 'api', storage: 'memory', endpoint: '/api/logs' }
        }
      })

      const logsManager = managers.get('logs')
      expect(logsManager.readOnly).toBe(true)
    })
  })

  describe('optional schema properties', () => {
    it('handles schema with routePrefix', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'users', endpoint: '/api/users', routePrefix: 'user', fields: {} }
      ])

      const managers = createManagers({
        schemas: { api: schemas },
        storages: { memory: () => new MemoryStorage() },
        entities: {
          users: { schema: 'api', storage: 'memory', endpoint: '/api/users' }
        }
      })

      const usersManager = managers.get('users')
      expect(usersManager.routePrefix).toBe('user')
    })

    it('handles schema with custom idField', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'users', endpoint: '/api/users', idField: 'uuid', fields: {} }
      ])

      const managers = createManagers({
        schemas: { api: schemas },
        storages: { memory: () => new MemoryStorage() },
        entities: {
          users: { schema: 'api', storage: 'memory', endpoint: '/api/users' }
        }
      })

      const usersManager = managers.get('users')
      expect(usersManager.idField).toBe('uuid')
    })

    it('defaults idField to id when not specified', () => {
      const connector = new ManualConnector()
      const schemas = connector.parse([
        { name: 'users', endpoint: '/api/users', fields: {} }
      ])

      const managers = createManagers({
        schemas: { api: schemas },
        storages: { memory: () => new MemoryStorage() },
        entities: {
          users: { schema: 'api', storage: 'memory', endpoint: '/api/users' }
        }
      })

      const usersManager = managers.get('users')
      expect(usersManager.idField).toBe('id')
    })
  })
})
