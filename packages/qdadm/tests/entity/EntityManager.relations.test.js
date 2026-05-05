/**
 * EntityManager — relations methods (children, parent, sub-managers).
 *
 * Covers the prototype-patched methods in EntityManager.relations.ts that
 * were previously only exercised indirectly through the demo modules.
 */
import { describe, it, expect, vi } from 'vitest'

import { EntityManager } from '../../src/entity/EntityManager'

function makeStorage(handlers = {}) {
  return {
    request: vi.fn(async (method, path, opts) => {
      const fn = handlers[method]
      return fn ? fn(path, opts) : undefined
    }),
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

describe('EntityManager — relations config getters', () => {
  it('getChildNames lists every declared child relation', () => {
    const manager = new EntityManager({
      name: 'books',
      children: {
        loans: { entity: 'loans', foreignKey: 'book_id' },
        reviews: { entity: 'reviews', foreignKey: 'book_id' },
      },
    })
    expect(new Set(manager.getChildNames())).toEqual(new Set(['loans', 'reviews']))
  })

  it('getChildConfig returns the named relation, or undefined', () => {
    const manager = new EntityManager({
      name: 'books',
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    expect(manager.getChildConfig('loans')).toEqual({
      entity: 'loans',
      foreignKey: 'book_id',
    })
    expect(manager.getChildConfig('does-not-exist')).toBeUndefined()
  })

  it('getParentConfig returns the parent (or null)', () => {
    const orphan = new EntityManager({ name: 'books' })
    expect(orphan.getParentConfig()).toBeNull()

    const child = new EntityManager({
      name: 'loans',
      parent: { entity: 'books', param: 'bookId', foreignKey: 'book_id' },
    })
    expect(child.getParentConfig()).toEqual({
      entity: 'books',
      param: 'bookId',
      foreignKey: 'book_id',
    })
  })
})

describe('EntityManager — listChildren', () => {
  it('delegates to storage.request with the conventional endpoint', async () => {
    const storage = makeStorage({
      GET: async (path) => ({ items: [{ id: 1, book_id: 7 }], total: 1, _path: path }),
    })
    const manager = new EntityManager({
      name: 'books',
      storage,
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })

    const out = await manager.listChildren(7, 'loans', { page: 1 })
    expect(out.total).toBe(1)
    expect(storage.request).toHaveBeenCalledWith('GET', '7/loans', {
      params: { page: 1 },
    })
  })

  it('uses the configured endpoint when provided', async () => {
    const storage = makeStorage({ GET: async () => ({ items: [], total: 0 }) })
    const manager = new EntityManager({
      name: 'books',
      storage,
      children: {
        loans: { entity: 'loans', foreignKey: 'book_id', endpoint: '/api/loans' },
      },
    })

    await manager.listChildren(7, 'loans')
    expect(storage.request).toHaveBeenCalledWith('GET', '/api/loans', { params: {} })
  })

  it('throws on an unknown child name', async () => {
    const manager = new EntityManager({
      name: 'books',
      storage: makeStorage(),
      children: {},
    })
    await expect(manager.listChildren(1, 'loans')).rejects.toThrow(/Unknown child relation "loans"/)
  })

  it('throws when storage has no request() method', async () => {
    const manager = new EntityManager({
      name: 'books',
      storage: { list: vi.fn() }, // no request
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    await expect(manager.listChildren(1, 'loans')).rejects.toThrow(
      /listChildren\(\) requires storage with request\(\)/
    )
  })
})

describe('EntityManager — getChild / createChild / deleteChild', () => {
  it('getChild GETs `<endpoint>/<childId>`', async () => {
    const storage = makeStorage({
      GET: async (path) => ({ id: 9, book_id: 7, _path: path }),
    })
    const manager = new EntityManager({
      name: 'books',
      storage,
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    const out = await manager.getChild(7, 'loans', 9)
    expect(out.id).toBe(9)
    expect(storage.request).toHaveBeenCalledWith('GET', '7/loans/9')
  })

  it('createChild POSTs to the child endpoint with payload', async () => {
    const storage = makeStorage({
      POST: async (path, opts) => ({ id: 99, ...opts.data, _path: path }),
    })
    const manager = new EntityManager({
      name: 'books',
      storage,
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    const out = await manager.createChild(7, 'loans', { user_id: 3 })
    expect(out.id).toBe(99)
    expect(storage.request).toHaveBeenCalledWith('POST', '7/loans', {
      data: { user_id: 3 },
    })
  })

  it('deleteChild DELETEs `<endpoint>/<childId>` and resolves void', async () => {
    const storage = makeStorage({ DELETE: async () => undefined })
    const manager = new EntityManager({
      name: 'books',
      storage,
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    await expect(manager.deleteChild(7, 'loans', 9)).resolves.toBeUndefined()
    expect(storage.request).toHaveBeenCalledWith('DELETE', '7/loans/9')
  })

  it('all three reject with "Unknown child relation" for an unknown name', async () => {
    const manager = new EntityManager({
      name: 'books',
      storage: makeStorage(),
      children: {},
    })
    await expect(manager.getChild(1, 'x', 1)).rejects.toThrow(/Unknown child relation "x"/)
    await expect(manager.createChild(1, 'x', {})).rejects.toThrow(/Unknown child relation "x"/)
    await expect(manager.deleteChild(1, 'x', 1)).rejects.toThrow(/Unknown child relation "x"/)
  })

  it('all three throw when storage has no request()', async () => {
    const manager = new EntityManager({
      name: 'books',
      storage: { list: vi.fn() },
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    await expect(manager.getChild(1, 'loans', 1)).rejects.toThrow(
      /getChild\(\) requires storage with request\(\)/
    )
    await expect(manager.createChild(1, 'loans', {})).rejects.toThrow(
      /createChild\(\) requires storage with request\(\)/
    )
    await expect(manager.deleteChild(1, 'loans', 1)).rejects.toThrow(
      /deleteChild\(\) requires storage with request\(\)/
    )
  })
})

describe('EntityManager — getParentManager / getChildManager', () => {
  it('getParentManager returns null without an orchestrator', () => {
    const manager = new EntityManager({
      name: 'loans',
      parent: { entity: 'books', param: 'bookId', foreignKey: 'book_id' },
    })
    expect(manager.getParentManager()).toBeNull()
  })

  it('getParentManager fetches the parent from the orchestrator after onRegister', () => {
    const parentMgr = new EntityManager({ name: 'books' })
    const orchestrator = { get: vi.fn((name) => (name === 'books' ? parentMgr : null)) }

    const manager = new EntityManager({
      name: 'loans',
      parent: { entity: 'books', param: 'bookId', foreignKey: 'book_id' },
    })
    manager.onRegister(orchestrator)

    expect(manager.getParentManager()).toBe(parentMgr)
    expect(orchestrator.get).toHaveBeenCalledWith('books')
  })

  it('getParentManager returns null when there is no parent config at all', () => {
    const orchestrator = { get: vi.fn() }
    const manager = new EntityManager({ name: 'books' })
    manager.onRegister(orchestrator)
    expect(manager.getParentManager()).toBeNull()
    expect(orchestrator.get).not.toHaveBeenCalled()
  })

  it('getChildManager fetches the child entity manager from the orchestrator', () => {
    const childMgr = new EntityManager({ name: 'loans' })
    const orchestrator = { get: vi.fn((name) => (name === 'loans' ? childMgr : null)) }

    const manager = new EntityManager({
      name: 'books',
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    manager.onRegister(orchestrator)
    expect(manager.getChildManager('loans')).toBe(childMgr)
  })

  it('getChildManager returns null for unknown child names', () => {
    const orchestrator = { get: vi.fn() }
    const manager = new EntityManager({
      name: 'books',
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    manager.onRegister(orchestrator)
    expect(manager.getChildManager('does-not-exist')).toBeNull()
    expect(orchestrator.get).not.toHaveBeenCalled()
  })

  it('getChildManager returns null without an orchestrator', () => {
    const manager = new EntityManager({
      name: 'books',
      children: { loans: { entity: 'loans', foreignKey: 'book_id' } },
    })
    expect(manager.getChildManager('loans')).toBeNull()
  })
})
