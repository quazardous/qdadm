/**
 * Hook Bundle Pattern Test Suite
 *
 * Tests for the hook bundle infrastructure and built-in bundles.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createHookBundle,
  applyBundle,
  applyBundles,
  withSoftDelete,
  withTimestamps,
  withVersioning,
  withAuditLog,
} from '../../src/core/bundles.js'
import { createHookRegistry, HOOK_PRIORITY } from '../../src/hooks/index'

describe('createHookBundle', () => {
  it('creates a bundle factory function', () => {
    const factory = createHookBundle('test', () => {})
    expect(typeof factory).toBe('function')
  })

  it('factory returns bundle instance with name and options', () => {
    const factory = createHookBundle('myBundle', () => {})
    const bundle = factory({ option1: 'value1' })

    expect(bundle.name).toBe('myBundle')
    expect(bundle.options.option1).toBe('value1')
    expect(typeof bundle.setup).toBe('function')
  })

  it('factory uses empty options by default', () => {
    const factory = createHookBundle('myBundle', () => {})
    const bundle = factory()

    expect(bundle.options).toEqual({})
  })

  it('throws if name is not a string', () => {
    expect(() => createHookBundle(null, () => {}))
      .toThrow('[createHookBundle] Bundle name must be a non-empty string')

    expect(() => createHookBundle('', () => {}))
      .toThrow('[createHookBundle] Bundle name must be a non-empty string')

    expect(() => createHookBundle(123, () => {}))
      .toThrow('[createHookBundle] Bundle name must be a non-empty string')
  })

  it('throws if setup is not a function', () => {
    expect(() => createHookBundle('test', 'not a function'))
      .toThrow('[createHookBundle] Setup must be a function')

    expect(() => createHookBundle('test', null))
      .toThrow('[createHookBundle] Setup must be a function')
  })
})

describe('applyBundle', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('applies bundle and returns cleanup function', () => {
    const bundle = createHookBundle('test', (register) => {
      register('test:hook', () => {})
    })()

    const cleanup = applyBundle(hooks, bundle)

    expect(typeof cleanup).toBe('function')
    expect(hooks.hasHook('test:hook')).toBe(true)
  })

  it('cleanup function removes all bundle hooks', () => {
    const bundle = createHookBundle('test', (register) => {
      register('test:hook1', () => {})
      register('test:hook2', () => {})
      register('test:hook3', () => {})
    })()

    const cleanup = applyBundle(hooks, bundle)
    expect(hooks.getHandlerCount()).toBe(3)

    cleanup()
    expect(hooks.getHandlerCount()).toBe(0)
  })

  it('passes context to bundle setup', () => {
    let receivedContext = null
    const bundle = createHookBundle('test', (register, context) => {
      receivedContext = context
    })({ myOption: 'value' })

    applyBundle(hooks, bundle, { target: 'books' })

    expect(receivedContext.target).toBe('books')
    expect(receivedContext.options.myOption).toBe('value')
    expect(receivedContext.hooks).toBe(hooks)
  })

  it('uses default target "*" when not specified', () => {
    let receivedContext = null
    const bundle = createHookBundle('test', (register, context) => {
      receivedContext = context
    })()

    applyBundle(hooks, bundle)

    expect(receivedContext.target).toBe('*')
  })

  it('prefixes handler IDs with bundle name', async () => {
    const callOrder = []
    const bundle = createHookBundle('myBundle', (register) => {
      register('test:hook', () => callOrder.push('handler'), { id: 'myHandler' })
    })()

    applyBundle(hooks, bundle)

    // Check that the handler was registered with prefixed ID
    const registered = hooks._hooks.get('test:hook')
    expect(registered[0].id).toBe('myBundle:myHandler')
  })

  it('generates unique IDs when not specified', () => {
    const bundle = createHookBundle('myBundle', (register) => {
      register('entity:presave', () => {})
      register('entity:postsave', () => {})
    })()

    applyBundle(hooks, bundle)

    const presaveHook = hooks._hooks.get('entity:presave')
    const postsaveHook = hooks._hooks.get('entity:postsave')

    expect(presaveHook[0].id).toBe('myBundle:entity-presave')
    expect(postsaveHook[0].id).toBe('myBundle:entity-postsave')
  })

  it('throws if hooks is not a HookRegistry', () => {
    const bundle = createHookBundle('test', () => {})()

    expect(() => applyBundle(null, bundle))
      .toThrow('[applyBundle] First argument must be a HookRegistry')

    expect(() => applyBundle({}, bundle))
      .toThrow('[applyBundle] First argument must be a HookRegistry')
  })

  it('throws if bundle is invalid', () => {
    expect(() => applyBundle(hooks, null))
      .toThrow('[applyBundle] Second argument must be a bundle instance')

    expect(() => applyBundle(hooks, {}))
      .toThrow('[applyBundle] Second argument must be a bundle instance')
  })

  it('handlers are invoked with correct event data', async () => {
    let receivedEvent = null
    const bundle = createHookBundle('test', (register) => {
      register('test:hook', (event) => {
        receivedEvent = event
      })
    })()

    applyBundle(hooks, bundle)
    await hooks.invoke('test:hook', { entity: { id: 1 } })

    expect(receivedEvent.data.entity.id).toBe(1)
  })

  it('supports hook priority option', async () => {
    const callOrder = []
    const bundle = createHookBundle('test', (register) => {
      register('test:hook', () => callOrder.push('low'), { priority: HOOK_PRIORITY.LOW })
      register('test:hook', () => callOrder.push('high'), { priority: HOOK_PRIORITY.HIGH })
    })()

    applyBundle(hooks, bundle)
    await hooks.invoke('test:hook', {})

    expect(callOrder).toEqual(['high', 'low'])
  })
})

describe('applyBundles', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('applies multiple bundles', () => {
    const bundle1 = createHookBundle('b1', (register) => {
      register('hook:a', () => {})
    })()

    const bundle2 = createHookBundle('b2', (register) => {
      register('hook:b', () => {})
    })()

    const cleanup = applyBundles(hooks, [bundle1, bundle2])

    expect(hooks.hasHook('hook:a')).toBe(true)
    expect(hooks.hasHook('hook:b')).toBe(true)
    expect(typeof cleanup).toBe('function')
  })

  it('cleanup removes all bundles hooks', () => {
    const bundle1 = createHookBundle('b1', (register) => {
      register('hook:a', () => {})
      register('hook:b', () => {})
    })()

    const bundle2 = createHookBundle('b2', (register) => {
      register('hook:c', () => {})
    })()

    const cleanup = applyBundles(hooks, [bundle1, bundle2])
    expect(hooks.getHandlerCount()).toBe(3)

    cleanup()
    expect(hooks.getHandlerCount()).toBe(0)
  })

  it('passes context to all bundles', () => {
    const contexts = []

    const bundle1 = createHookBundle('b1', (register, ctx) => {
      contexts.push(ctx)
    })()

    const bundle2 = createHookBundle('b2', (register, ctx) => {
      contexts.push(ctx)
    })()

    applyBundles(hooks, [bundle1, bundle2], { target: 'users' })

    expect(contexts[0].target).toBe('users')
    expect(contexts[1].target).toBe('users')
  })

  it('throws if bundles is not an array', () => {
    expect(() => applyBundles(hooks, 'not an array'))
      .toThrow('[applyBundles] Bundles must be an array')
  })

  it('works with empty array', () => {
    const cleanup = applyBundles(hooks, [])
    expect(typeof cleanup).toBe('function')
    cleanup() // Should not throw
  })
})

describe('withTimestamps bundle', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('sets created_at and updated_at on new entity', async () => {
    applyBundle(hooks, withTimestamps())

    const entity = { title: 'Test' }
    await hooks.invoke('entity:presave', { entity, isNew: true })

    expect(entity.created_at).toBeDefined()
    expect(entity.updated_at).toBeDefined()
    expect(entity.created_at).toBe(entity.updated_at)
  })

  it('only sets updated_at on existing entity', async () => {
    applyBundle(hooks, withTimestamps())

    const entity = { id: 1, title: 'Test', created_at: '2024-01-01' }
    await hooks.invoke('entity:presave', { entity, isNew: false })

    expect(entity.created_at).toBe('2024-01-01') // Unchanged
    expect(entity.updated_at).toBeDefined()
  })

  it('does not overwrite existing created_at on new entity', async () => {
    applyBundle(hooks, withTimestamps())

    const entity = { title: 'Test', created_at: 'custom-value' }
    await hooks.invoke('entity:presave', { entity, isNew: true })

    expect(entity.created_at).toBe('custom-value')
    expect(entity.updated_at).toBeDefined()
  })

  it('uses custom field names', async () => {
    applyBundle(hooks, withTimestamps({
      createdAtField: 'createdAt',
      updatedAtField: 'updatedAt'
    }))

    const entity = { title: 'Test' }
    await hooks.invoke('entity:presave', { entity, isNew: true })

    expect(entity.createdAt).toBeDefined()
    expect(entity.updatedAt).toBeDefined()
    expect(entity.created_at).toBeUndefined()
  })

  it('uses custom timestamp function', async () => {
    const customTimestamp = () => 'CUSTOM_TS'
    applyBundle(hooks, withTimestamps({ timestamp: customTimestamp }))

    const entity = { title: 'Test' }
    await hooks.invoke('entity:presave', { entity, isNew: true })

    expect(entity.created_at).toBe('CUSTOM_TS')
    expect(entity.updated_at).toBe('CUSTOM_TS')
  })
})

describe('withVersioning bundle', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('initializes version to 1 on new entity', async () => {
    applyBundle(hooks, withVersioning())

    const entity = { title: 'Test' }
    await hooks.invoke('entity:presave', { entity, isNew: true, manager: { name: 'books' } })

    expect(entity.version).toBe(1)
  })

  it('increments version on existing entity', async () => {
    applyBundle(hooks, withVersioning())

    const entity = { id: 1, title: 'Test', version: 3 }
    await hooks.invoke('entity:presave', { entity, isNew: false, manager: { name: 'books' } })

    expect(entity.version).toBe(4)
  })

  it('initializes version from 0 if not present', async () => {
    applyBundle(hooks, withVersioning())

    const entity = { id: 1, title: 'Test' }
    await hooks.invoke('entity:presave', { entity, isNew: false, manager: { name: 'books' } })

    expect(entity.version).toBe(1)
  })

  it('uses custom field name', async () => {
    applyBundle(hooks, withVersioning({ field: '_ver' }))

    const entity = { title: 'Test' }
    await hooks.invoke('entity:presave', { entity, isNew: true, manager: { name: 'books' } })

    expect(entity._ver).toBe(1)
    expect(entity.version).toBeUndefined()
  })

  it('throws VersionConflictError when versions mismatch', async () => {
    applyBundle(hooks, withVersioning())

    const entity = { id: 1, title: 'Test', version: 3 }
    const originalEntity = { id: 1, title: 'Original', version: 2 }

    await expect(
      hooks.invoke('entity:presave', {
        entity,
        isNew: false,
        originalEntity,
        manager: { name: 'books' }
      }, { throwOnError: true })
    ).rejects.toThrow('Version conflict')
  })

  it('does not validate when validateOnUpdate is false', async () => {
    applyBundle(hooks, withVersioning({ validateOnUpdate: false }))

    const entity = { id: 1, title: 'Test', version: 3 }
    const originalEntity = { id: 1, title: 'Original', version: 2 }

    // Should not throw
    await hooks.invoke('entity:presave', {
      entity,
      isNew: false,
      originalEntity,
      manager: { name: 'books' }
    })

    expect(entity.version).toBe(4)
  })

  it('does not validate when no originalEntity provided', async () => {
    applyBundle(hooks, withVersioning())

    const entity = { id: 1, title: 'Test', version: 5 }

    // Should not throw - no originalEntity means we can't validate
    await hooks.invoke('entity:presave', {
      entity,
      isNew: false,
      manager: { name: 'books' }
    })

    expect(entity.version).toBe(6)
  })
})

describe('withSoftDelete bundle', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('intercepts delete and calls cancel', async () => {
    applyBundle(hooks, withSoftDelete())

    let cancelCalled = false
    let patchCalled = false
    let patchArgs = null

    const mockManager = {
      name: 'books',
      idField: 'id',
      patch: (id, data) => {
        patchCalled = true
        patchArgs = { id, data }
      }
    }

    await hooks.invoke('entity:predelete', {
      entity: { id: 42 },
      manager: mockManager,
      cancel: () => { cancelCalled = true }
    })

    expect(cancelCalled).toBe(true)
    expect(patchCalled).toBe(true)
    expect(patchArgs.id).toBe(42)
    expect(patchArgs.data.deleted_at).toBeDefined()
  })

  it('uses custom field name', async () => {
    applyBundle(hooks, withSoftDelete({ field: 'removed_at' }))

    let patchArgs = null
    const mockManager = {
      name: 'books',
      idField: 'id',
      patch: (id, data) => { patchArgs = { id, data } }
    }

    await hooks.invoke('entity:predelete', {
      entity: { id: 1 },
      manager: mockManager,
      cancel: () => {}
    })

    expect(patchArgs.data.removed_at).toBeDefined()
    expect(patchArgs.data.deleted_at).toBeUndefined()
  })

  it('uses custom timestamp function', async () => {
    applyBundle(hooks, withSoftDelete({ timestamp: () => 'DELETED_NOW' }))

    let patchArgs = null
    const mockManager = {
      name: 'books',
      idField: 'id',
      patch: (id, data) => { patchArgs = { id, data } }
    }

    await hooks.invoke('entity:predelete', {
      entity: { id: 1 },
      manager: mockManager,
      cancel: () => {}
    })

    expect(patchArgs.data.deleted_at).toBe('DELETED_NOW')
  })

  it('adds filter to list:alter', async () => {
    applyBundle(hooks, withSoftDelete())

    const config = { columns: [] }
    const result = await hooks.alter('list:alter', config)

    expect(result.filters).toBeDefined()
    expect(result.filters).toHaveLength(1)
    expect(result.filters[0].field).toBe('deleted_at')
    expect(result.filters[0].operator).toBe('is_null')
  })

  it('skips filter when includeDeleted is true', async () => {
    applyBundle(hooks, withSoftDelete())

    const config = { columns: [], includeDeleted: true }
    const result = await hooks.alter('list:alter', config)

    // No filter should be added
    expect(result.filters).toBeUndefined()
  })

  it('uses custom field in filter', async () => {
    applyBundle(hooks, withSoftDelete({ field: 'removed_at' }))

    const config = { columns: [] }
    const result = await hooks.alter('list:alter', config)

    expect(result.filters[0].field).toBe('removed_at')
  })
})

describe('withAuditLog bundle', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('logs create operation', async () => {
    const logs = []
    applyBundle(hooks, withAuditLog({ logger: (entry) => logs.push(entry) }))

    await hooks.invoke('entity:postsave', {
      entity: { id: 1, title: 'Test' },
      isNew: true,
      manager: { name: 'books', idField: 'id' }
    })

    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('create')
    expect(logs[0].entity).toBe('books')
    expect(logs[0].id).toBe(1)
    expect(logs[0].timestamp).toBeDefined()
  })

  it('logs update operation', async () => {
    const logs = []
    applyBundle(hooks, withAuditLog({ logger: (entry) => logs.push(entry) }))

    await hooks.invoke('entity:postsave', {
      entity: { id: 1, title: 'Updated' },
      isNew: false,
      manager: { name: 'books', idField: 'id' }
    })

    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('update')
    expect(logs[0].id).toBe(1)
  })

  it('logs delete operation', async () => {
    const logs = []
    applyBundle(hooks, withAuditLog({ logger: (entry) => logs.push(entry) }))

    await hooks.invoke('entity:postdelete', {
      entity: { id: 1, title: 'Deleted' },
      manager: { name: 'books', idField: 'id' }
    })

    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('delete')
    expect(logs[0].id).toBe(1)
  })

  it('includes data when includeData is true', async () => {
    const logs = []
    applyBundle(hooks, withAuditLog({ logger: (entry) => logs.push(entry), includeData: true }))

    await hooks.invoke('entity:postsave', {
      entity: { id: 1, title: 'Test', secret: 'value' },
      isNew: true,
      manager: { name: 'books', idField: 'id' }
    })

    expect(logs[0].data).toBeDefined()
    expect(logs[0].data.title).toBe('Test')
    expect(logs[0].data.secret).toBe('value')
  })

  it('includes diff when includeDiff is true', async () => {
    const logs = []
    applyBundle(hooks, withAuditLog({
      logger: (entry) => logs.push(entry),
      includeDiff: true
    }))

    await hooks.invoke('entity:postsave', {
      entity: { id: 1, title: 'New Title', author: 'Same' },
      originalEntity: { id: 1, title: 'Old Title', author: 'Same' },
      isNew: false,
      manager: { name: 'books', idField: 'id' }
    })

    expect(logs[0].changes).toBeDefined()
    expect(logs[0].changes.title).toEqual({ from: 'Old Title', to: 'New Title' })
    expect(logs[0].changes.author).toBeUndefined() // No change
  })

  it('uses console.log as default logger', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    applyBundle(hooks, withAuditLog())

    await hooks.invoke('entity:postsave', {
      entity: { id: 1 },
      isNew: true,
      manager: { name: 'books', idField: 'id' }
    })

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('uses default idField "id" when not specified', async () => {
    const logs = []
    applyBundle(hooks, withAuditLog({ logger: (entry) => logs.push(entry) }))

    await hooks.invoke('entity:postsave', {
      entity: { id: 99, title: 'Test' },
      isNew: true,
      manager: { name: 'books' } // No idField specified
    })

    expect(logs[0].id).toBe(99)
  })
})

describe('bundle composition', () => {
  let hooks

  beforeEach(() => {
    hooks = createHookRegistry()
  })

  afterEach(() => {
    hooks.dispose()
  })

  it('multiple bundles can register handlers for same hook', async () => {
    const callOrder = []

    const bundle1 = createHookBundle('b1', (register) => {
      register('entity:presave', () => callOrder.push('b1'), { priority: HOOK_PRIORITY.HIGH })
    })()

    const bundle2 = createHookBundle('b2', (register) => {
      register('entity:presave', () => callOrder.push('b2'), { priority: HOOK_PRIORITY.LOW })
    })()

    applyBundles(hooks, [bundle1, bundle2])

    await hooks.invoke('entity:presave', {})

    expect(callOrder).toEqual(['b1', 'b2'])
  })

  it('timestamps and versioning work together', async () => {
    applyBundles(hooks, [
      withTimestamps(),
      withVersioning()
    ])

    const entity = { title: 'Test' }
    await hooks.invoke('entity:presave', { entity, isNew: true, manager: { name: 'books' } })

    expect(entity.created_at).toBeDefined()
    expect(entity.updated_at).toBeDefined()
    expect(entity.version).toBe(1)
  })

  it('audit log captures changes from other bundles', async () => {
    const logs = []

    applyBundles(hooks, [
      withTimestamps(), // Runs first (HIGH priority) on entity:presave
      withAuditLog({ logger: (e) => logs.push(e), includeData: true }) // Runs last (LAST priority) on entity:postsave
    ])

    const entity = { title: 'Test' }
    // First invoke presave to add timestamps
    await hooks.invoke('entity:presave', { entity, isNew: true, manager: { name: 'books', idField: 'id' } })
    // Then invoke postsave to trigger audit logging
    await hooks.invoke('entity:postsave', { entity, isNew: true, manager: { name: 'books', idField: 'id' } })

    // Audit log should see the timestamped entity
    expect(logs[0].data.created_at).toBeDefined()
  })

  it('individual bundles can be cleaned up independently', async () => {
    const bundle1 = createHookBundle('b1', (register) => {
      register('hook:a', () => {})
    })()

    const bundle2 = createHookBundle('b2', (register) => {
      register('hook:b', () => {})
    })()

    const cleanup1 = applyBundle(hooks, bundle1)
    const cleanup2 = applyBundle(hooks, bundle2)

    expect(hooks.hasHook('hook:a')).toBe(true)
    expect(hooks.hasHook('hook:b')).toBe(true)

    cleanup1()
    expect(hooks.hasHook('hook:a')).toBe(false)
    expect(hooks.hasHook('hook:b')).toBe(true)

    cleanup2()
    expect(hooks.hasHook('hook:b')).toBe(false)
  })
})
