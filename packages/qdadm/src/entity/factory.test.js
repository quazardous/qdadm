import { describe, it, expect, vi } from 'vitest'
import {
  managerFactory,
  defaultManagerResolver,
  createManagerFactory,
  createManagers
} from './factory'
import { EntityManager } from './EntityManager'
import { ApiStorage } from './storage/ApiStorage'
import { MemoryStorage } from './storage/MemoryStorage'

describe('defaultManagerResolver', () => {
  it('creates EntityManager with config', () => {
    const storage = new MemoryStorage()
    const config = { storage, label: 'Bot' }

    const manager = defaultManagerResolver(config, 'bots')

    expect(manager).toBeInstanceOf(EntityManager)
    expect(manager.name).toBe('bots')
    expect(manager.storage).toBe(storage)
  })

  it('uses registered manager class from registry', () => {
    class CustomManager extends EntityManager {}
    const storage = new MemoryStorage()
    const config = { storage }
    const context = { managerRegistry: { bots: CustomManager } }

    const manager = defaultManagerResolver(config, 'bots', context)

    expect(manager).toBeInstanceOf(CustomManager)
  })

  it('falls back to EntityManager when not in registry', () => {
    const storage = new MemoryStorage()
    const config = { storage }
    const context = { managerRegistry: { other: class extends EntityManager {} } }

    const manager = defaultManagerResolver(config, 'bots', context)

    expect(manager).toBeInstanceOf(EntityManager)
    expect(manager.constructor).toBe(EntityManager)
  })
})

describe('managerFactory', () => {
  it('returns EntityManager instance directly', () => {
    const manager = new EntityManager({ name: 'test', storage: new MemoryStorage() })
    const result = managerFactory(manager, 'test')
    expect(result).toBe(manager)
  })

  it('returns duck-typed manager directly', () => {
    const duckManager = {
      storage: new MemoryStorage(),
      list: () => Promise.resolve({ items: [], total: 0 }),
      get: () => Promise.resolve(null)
    }
    const result = managerFactory(duckManager, 'test')
    expect(result).toBe(duckManager)
  })

  it('creates manager from string pattern', () => {
    const result = managerFactory('api:/api/bots', 'bots')
    expect(result).toBeInstanceOf(EntityManager)
    expect(result.storage).toBeInstanceOf(ApiStorage)
    expect(result.storage.endpoint).toBe('/api/bots')
  })

  it('creates manager from config object with storage string', () => {
    const result = managerFactory({
      storage: 'api:/api/tasks',
      label: 'Task'
    }, 'tasks')

    expect(result).toBeInstanceOf(EntityManager)
    expect(result.storage).toBeInstanceOf(ApiStorage)
  })

  it('uses storage instance directly from config', () => {
    const storage = new MemoryStorage()
    const result = managerFactory({ storage }, 'items')

    expect(result).toBeInstanceOf(EntityManager)
    expect(result.storage).toBe(storage)
  })

  it('uses custom storageResolver', () => {
    const customStorage = new MemoryStorage()
    const storageResolver = vi.fn().mockReturnValue(customStorage)
    const context = { storageResolver }

    const result = managerFactory('api:/test', 'test', context)

    expect(storageResolver).toHaveBeenCalled()
    expect(result.storage).toBe(customStorage)
  })

  it('uses custom managerResolver', () => {
    class CustomManager extends EntityManager {}
    const managerResolver = vi.fn().mockImplementation((config, name) => {
      return new CustomManager({ name, ...config })
    })
    const context = { managerResolver }

    const result = managerFactory('api:/test', 'test', context)

    expect(managerResolver).toHaveBeenCalled()
    expect(result).toBeInstanceOf(CustomManager)
  })

  it('uses managerRegistry for generated classes', () => {
    class BotManager extends EntityManager {}
    const context = { managerRegistry: { bots: BotManager } }

    const result = managerFactory('api:/api/bots', 'bots', context)

    expect(result).toBeInstanceOf(BotManager)
  })

  it('throws for invalid config', () => {
    expect(() => managerFactory(123, 'test'))
      .toThrow('Invalid manager config')
  })
})

describe('createManagerFactory', () => {
  it('creates factory with bound context', () => {
    class CustomManager extends EntityManager {}
    const context = { managerRegistry: { bots: CustomManager } }
    const factory = createManagerFactory(context)

    const result = factory('api:/api/bots', 'bots')

    expect(result).toBeInstanceOf(CustomManager)
  })
})

describe('createManagers', () => {
  it('creates managers from config object', () => {
    const config = {
      bots: 'api:/api/bots',
      tasks: { storage: 'memory:tasks', label: 'Task' }
    }

    const managers = createManagers(config)

    expect(managers.bots).toBeInstanceOf(EntityManager)
    expect(managers.bots.storage).toBeInstanceOf(ApiStorage)
    expect(managers.tasks).toBeInstanceOf(EntityManager)
    expect(managers.tasks.storage).toBeInstanceOf(MemoryStorage)
  })

  it('uses context for all managers', () => {
    class BotManager extends EntityManager {}
    class TaskManager extends EntityManager {}
    const context = {
      managerRegistry: { bots: BotManager, tasks: TaskManager }
    }
    const config = {
      bots: 'api:/api/bots',
      tasks: 'api:/api/tasks'
    }

    const managers = createManagers(config, context)

    expect(managers.bots).toBeInstanceOf(BotManager)
    expect(managers.tasks).toBeInstanceOf(TaskManager)
  })

  it('passes through existing manager instances', () => {
    const existingManager = new EntityManager({ name: 'existing', storage: new MemoryStorage() })
    const config = {
      bots: 'api:/api/bots',
      existing: existingManager
    }

    const managers = createManagers(config)

    expect(managers.existing).toBe(existingManager)
    expect(managers.bots).toBeInstanceOf(EntityManager)
  })

  it('returns empty object for empty config', () => {
    const managers = createManagers({})
    expect(managers).toEqual({})
  })
})
