import { describe, it, expect, vi } from 'vitest'
import {
  parseStoragePattern,
  storageFactory,
  defaultStorageResolver,
  createStorageFactory,
  storageTypes
} from './factory.js'
import { IStorage } from './IStorage.js'
import { ApiStorage } from './ApiStorage.js'
import { LocalStorage } from './LocalStorage.js'
import { MemoryStorage } from './MemoryStorage.js'
import { MockApiStorage } from './MockApiStorage.js'

describe('parseStoragePattern', () => {
  it('parses api pattern with endpoint', () => {
    const result = parseStoragePattern('api:/api/bots')
    expect(result).toEqual({ type: 'api', endpoint: '/api/bots' })
  })

  it('parses local pattern with key', () => {
    const result = parseStoragePattern('local:myKey')
    expect(result).toEqual({ type: 'local', key: 'myKey' })
  })

  it('parses memory pattern with key', () => {
    const result = parseStoragePattern('memory:cache')
    expect(result).toEqual({ type: 'memory', key: 'cache' })
  })

  it('parses mock pattern with entityName', () => {
    const result = parseStoragePattern('mock:users')
    expect(result).toEqual({ type: 'mock', entityName: 'users' })
  })

  it('parses sdk pattern with endpoint', () => {
    const result = parseStoragePattern('sdk:users')
    expect(result).toEqual({ type: 'sdk', endpoint: 'users' })
  })

  it('treats bare path as api endpoint', () => {
    const result = parseStoragePattern('/api/tasks')
    expect(result).toEqual({ type: 'api', endpoint: '/api/tasks' })
  })

  it('returns null for invalid pattern', () => {
    const result = parseStoragePattern('invalid')
    expect(result).toBeNull()
  })
})

describe('defaultStorageResolver', () => {
  it('creates ApiStorage for api type', () => {
    const storage = defaultStorageResolver({ type: 'api', endpoint: '/api/bots' }, 'bots')
    expect(storage).toBeInstanceOf(ApiStorage)
    expect(storage.endpoint).toBe('/api/bots')
  })

  it('creates LocalStorage for local type', () => {
    const storage = defaultStorageResolver({ type: 'local', key: 'myKey' }, 'items')
    expect(storage).toBeInstanceOf(LocalStorage)
    expect(storage.key).toBe('myKey')
  })

  it('creates MemoryStorage for memory type', () => {
    const storage = defaultStorageResolver({ type: 'memory', key: 'cache' }, 'items')
    expect(storage).toBeInstanceOf(MemoryStorage)
  })

  it('creates MockApiStorage for mock type', () => {
    const storage = defaultStorageResolver({ type: 'mock', entityName: 'users' }, 'users')
    expect(storage).toBeInstanceOf(MockApiStorage)
  })

  it('throws for unknown type', () => {
    expect(() => defaultStorageResolver({ type: 'unknown' }, 'items'))
      .toThrow('Unknown storage type: "unknown"')
  })
})

describe('storageFactory', () => {
  it('returns IStorage instance directly', () => {
    const storage = new ApiStorage({ endpoint: '/api/test' })
    const result = storageFactory(storage, 'test')
    expect(result).toBe(storage)
  })

  it('returns duck-typed storage directly', () => {
    const duckStorage = {
      list: () => Promise.resolve({ items: [], total: 0 }),
      get: () => Promise.resolve(null)
    }
    const result = storageFactory(duckStorage, 'test')
    expect(result).toBe(duckStorage)
  })

  it('parses string pattern and creates storage', () => {
    const result = storageFactory('api:/api/bots', 'bots')
    expect(result).toBeInstanceOf(ApiStorage)
    expect(result.endpoint).toBe('/api/bots')
  })

  it('handles bare path as api endpoint', () => {
    const result = storageFactory('/api/tasks', 'tasks')
    expect(result).toBeInstanceOf(ApiStorage)
    expect(result.endpoint).toBe('/api/tasks')
  })

  it('handles config object with type', () => {
    const result = storageFactory({ type: 'memory', key: 'cache' }, 'items')
    expect(result).toBeInstanceOf(MemoryStorage)
  })

  it('handles config object with endpoint (infers api type)', () => {
    const result = storageFactory({ endpoint: '/api/items' }, 'items')
    expect(result).toBeInstanceOf(ApiStorage)
    expect(result.endpoint).toBe('/api/items')
  })

  it('uses custom resolver when provided', () => {
    const customResolver = vi.fn().mockReturnValue(new MemoryStorage())
    const result = storageFactory('api:/test', 'test', customResolver)
    expect(customResolver).toHaveBeenCalledWith(
      { type: 'api', endpoint: '/test' },
      'test'
    )
    expect(result).toBeInstanceOf(MemoryStorage)
  })

  it('throws for invalid config', () => {
    expect(() => storageFactory(123, 'test'))
      .toThrow('Invalid storage config')
  })

  it('throws for unparseable string', () => {
    expect(() => storageFactory('invalid', 'test'))
      .toThrow('Invalid storage pattern')
  })
})

describe('createStorageFactory', () => {
  it('creates factory with bound context', () => {
    const customResolver = vi.fn().mockReturnValue(new MemoryStorage())
    const factory = createStorageFactory(customResolver)

    const result = factory('api:/test', 'test')

    expect(customResolver).toHaveBeenCalled()
    expect(result).toBeInstanceOf(MemoryStorage)
  })
})

describe('storageTypes', () => {
  it('exports all storage type classes', () => {
    expect(storageTypes.api).toBe(ApiStorage)
    expect(storageTypes.local).toBe(LocalStorage)
    expect(storageTypes.memory).toBe(MemoryStorage)
    expect(storageTypes.mock).toBe(MockApiStorage)
  })
})
