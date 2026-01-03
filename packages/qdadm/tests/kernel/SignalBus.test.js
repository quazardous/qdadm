/**
 * Unit tests for SignalBus
 *
 * Tests the SignalBus wrapper around QuarKernel for qdadm's event-driven architecture.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SignalBus,
  createSignalBus,
  SIGNALS,
  SIGNAL_ACTIONS,
  buildSignal
} from '../../src/kernel/SignalBus.js'

describe('SignalBus', () => {
  describe('factory function', () => {
    it('createSignalBus returns SignalBus instance', () => {
      const bus = createSignalBus()
      expect(bus).toBeInstanceOf(SignalBus)
    })

    it('accepts debug option', () => {
      const bus = createSignalBus({ debug: true })
      expect(bus).toBeInstanceOf(SignalBus)
    })
  })

  describe('constants', () => {
    it('SIGNALS exports standard signal names', () => {
      expect(SIGNALS.ENTITY_CREATED).toBe('entity:created')
      expect(SIGNALS.ENTITY_UPDATED).toBe('entity:updated')
      expect(SIGNALS.ENTITY_DELETED).toBe('entity:deleted')
    })

    it('SIGNAL_ACTIONS exports action names', () => {
      expect(SIGNAL_ACTIONS.CREATED).toBe('created')
      expect(SIGNAL_ACTIONS.UPDATED).toBe('updated')
      expect(SIGNAL_ACTIONS.DELETED).toBe('deleted')
    })
  })

  describe('buildSignal helper', () => {
    it('builds entity-specific signal names', () => {
      expect(buildSignal('books', 'created')).toBe('books:created')
      expect(buildSignal('users', 'updated')).toBe('users:updated')
      expect(buildSignal('posts', 'deleted')).toBe('posts:deleted')
    })
  })

  describe('emit and on', () => {
    let bus

    beforeEach(() => {
      bus = createSignalBus()
    })

    it('emit triggers subscribed handlers', async () => {
      const handler = vi.fn()
      bus.on('test:signal', handler)

      await bus.emit('test:signal', { foo: 'bar' })

      expect(handler).toHaveBeenCalled()
      const event = handler.mock.calls[0][0]
      expect(event.data.foo).toBe('bar')
    })

    it('on returns unsubscribe function', async () => {
      const handler = vi.fn()
      const unsubscribe = bus.on('test:signal', handler)

      unsubscribe()
      await bus.emit('test:signal', { value: 1 })

      expect(handler).not.toHaveBeenCalled()
    })

    it('supports multiple subscribers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.on('multi:signal', handler1)
      bus.on('multi:signal', handler2)

      await bus.emit('multi:signal', { value: 42 })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('supports priority ordering', async () => {
      const order = []
      bus.on('priority:test', () => order.push('low'), { priority: 1 })
      bus.on('priority:test', () => order.push('high'), { priority: 100 })
      bus.on('priority:test', () => order.push('medium'), { priority: 50 })

      await bus.emit('priority:test', {})

      expect(order).toEqual(['high', 'medium', 'low'])
    })

    it('supports once option', async () => {
      const handler = vi.fn()
      bus.on('once:signal', handler, { once: true })

      await bus.emit('once:signal', { first: true })
      await bus.emit('once:signal', { second: true })

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('off', () => {
    let bus

    beforeEach(() => {
      bus = createSignalBus()
    })

    it('removes specific handler', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.on('test:signal', handler1)
      bus.on('test:signal', handler2)

      bus.off('test:signal', handler1)
      await bus.emit('test:signal', {})

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe('once (Promise-based)', () => {
    let bus

    beforeEach(() => {
      bus = createSignalBus()
    })

    it('returns promise that resolves on signal', async () => {
      const promise = bus.once('future:signal')

      // Emit after a short delay
      setTimeout(() => bus.emit('future:signal', { resolved: true }), 10)

      const event = await promise
      expect(event.data.resolved).toBe(true)
    })

    it('supports timeout option', async () => {
      const promise = bus.once('never:signal', { timeout: 50 })

      await expect(promise).rejects.toThrow()
    })
  })

  describe('wildcard subscriptions', () => {
    let bus

    beforeEach(() => {
      bus = createSignalBus()
    })

    it('entity:* matches all entity signals', async () => {
      const handler = vi.fn()
      bus.on('entity:*', handler)

      await bus.emit('entity:created', { id: 1 })
      await bus.emit('entity:updated', { id: 2 })
      await bus.emit('entity:deleted', { id: 3 })

      expect(handler).toHaveBeenCalledTimes(3)
    })

    it('*:created matches any entity creation', async () => {
      const handler = vi.fn()
      bus.on('*:created', handler)

      await bus.emit('books:created', { id: 1 })
      await bus.emit('users:created', { id: 2 })
      await bus.emit('posts:created', { id: 3 })

      expect(handler).toHaveBeenCalledTimes(3)
    })

    it('books:* matches all books signals', async () => {
      const handler = vi.fn()
      bus.on('books:*', handler)

      await bus.emit('books:created', { id: 1 })
      await bus.emit('books:updated', { id: 2 })
      await bus.emit('users:created', { id: 3 }) // Should not match

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('emitEntity', () => {
    let bus

    beforeEach(() => {
      bus = createSignalBus()
    })

    it('emits generic signal with entity name in payload', async () => {
      const handler = vi.fn()

      bus.on('entity:created', handler)

      await bus.emitEntity('books', 'created', { id: 1, title: 'Test' })

      expect(handler).toHaveBeenCalled()
      const event = handler.mock.calls[0][0]
      expect(event.data.entity).toBe('books')
    })

    it('does not emit entity-specific signal', async () => {
      const specificHandler = vi.fn()
      const genericHandler = vi.fn()

      bus.on('books:created', specificHandler)
      bus.on('entity:created', genericHandler)

      await bus.emitEntity('books', 'created', { id: 1 })

      expect(specificHandler).not.toHaveBeenCalled()
      expect(genericHandler).toHaveBeenCalled()
    })

    it('payload contains entity name and data', async () => {
      const handler = vi.fn()
      bus.on('entity:updated', handler)

      await bus.emitEntity('users', 'updated', { id: 1, name: 'Test' })

      const event = handler.mock.calls[0][0]
      expect(event.data.entity).toBe('users')
      expect(event.data.data.id).toBe(1)
      expect(event.data.data.name).toBe('Test')
    })

    it('works with all CRUD actions', async () => {
      const createdHandler = vi.fn()
      const updatedHandler = vi.fn()
      const deletedHandler = vi.fn()

      bus.on('entity:created', createdHandler)
      bus.on('entity:updated', updatedHandler)
      bus.on('entity:deleted', deletedHandler)

      await bus.emitEntity('products', SIGNAL_ACTIONS.CREATED, { id: 1 })
      await bus.emitEntity('products', SIGNAL_ACTIONS.UPDATED, { id: 1 })
      await bus.emitEntity('products', SIGNAL_ACTIONS.DELETED, { id: 1 })

      expect(createdHandler).toHaveBeenCalledTimes(1)
      expect(updatedHandler).toHaveBeenCalledTimes(1)
      expect(deletedHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('utility methods', () => {
    let bus

    beforeEach(() => {
      bus = createSignalBus()
    })

    it('listenerCount returns count for specific signal', () => {
      bus.on('test:a', () => {})
      bus.on('test:a', () => {})
      bus.on('test:b', () => {})

      expect(bus.listenerCount('test:a')).toBe(2)
      expect(bus.listenerCount('test:b')).toBe(1)
    })

    it('listenerCount returns total when no signal specified', () => {
      bus.on('test:a', () => {})
      bus.on('test:b', () => {})
      bus.on('test:c', () => {})

      expect(bus.listenerCount()).toBe(3)
    })

    it('signalNames returns registered signal names', () => {
      bus.on('signal:one', () => {})
      bus.on('signal:two', () => {})

      const names = bus.signalNames()
      expect(names).toContain('signal:one')
      expect(names).toContain('signal:two')
    })

    it('offAll removes all listeners for a signal', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.on('test:signal', handler1)
      bus.on('test:signal', handler2)

      bus.offAll('test:signal')
      await bus.emit('test:signal', {})

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('offAll with no argument removes all listeners', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.on('test:a', handler1)
      bus.on('test:b', handler2)

      bus.offAll()
      await bus.emit('test:a', {})
      await bus.emit('test:b', {})

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('getKernel returns underlying QuarKernel instance', () => {
      const kernel = bus.getKernel()
      expect(kernel).toBeDefined()
      expect(typeof kernel.emit).toBe('function')
      expect(typeof kernel.on).toBe('function')
    })
  })

  describe('debug mode', () => {
    it('can toggle debug mode', () => {
      const bus = createSignalBus({ debug: false })
      // Should not throw
      bus.debug(true)
      bus.debug(false)
    })
  })
})
