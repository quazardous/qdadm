/**
 * Unit tests for SignalCollector
 *
 * Tests the SignalCollector debug collector that captures SignalBus events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignalCollector } from '../../src/modules/debug/SignalCollector'
import { createSignalBus, SIGNAL_ACTIONS } from '../../src/kernel/SignalBus'

describe('SignalCollector', () => {
  let collector
  let signalBus

  beforeEach(() => {
    collector = new SignalCollector()
    signalBus = createSignalBus()
  })

  afterEach(() => {
    collector.uninstall()
  })

  describe('static collectorName', () => {
    it('has static collectorName property set to "signals"', () => {
      expect(SignalCollector.collectorName).toBe('signals')
    })

    it('name getter returns static collectorName', () => {
      expect(collector.name).toBe('signals')
    })
  })

  describe('install', () => {
    it('subscribes to signals when installed with valid context', () => {
      collector.install({ signals: signalBus })

      expect(collector._unsubscribe).toBeTypeOf('function')
    })

    it('warns when signals not in context', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      collector.install({})

      expect(warnSpy).toHaveBeenCalledWith(
        '[SignalCollector] No signals bus found in context'
      )
      expect(collector._unsubscribe).toBeNull()

      warnSpy.mockRestore()
    })

    it('warns when context is undefined', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      collector.install(undefined)

      expect(warnSpy).toHaveBeenCalledWith(
        '[SignalCollector] No signals bus found in context'
      )

      warnSpy.mockRestore()
    })
  })

  describe('uninstall', () => {
    it('removes subscription when uninstalled', async () => {
      collector.install({ signals: signalBus })

      await signalBus.emit('test:signal', { value: 1 })
      expect(collector.getEntries()).toHaveLength(1)

      collector.uninstall()

      await signalBus.emit('test:signal', { value: 2 })
      expect(collector.getEntries()).toHaveLength(1) // Still 1, not 2
    })

    it('is safe to call uninstall multiple times', () => {
      collector.install({ signals: signalBus })

      expect(() => {
        collector.uninstall()
        collector.uninstall()
        collector.uninstall()
      }).not.toThrow()
    })

    it('is safe to call uninstall without install', () => {
      expect(() => {
        collector.uninstall()
      }).not.toThrow()
    })
  })

  describe('signal recording', () => {
    beforeEach(() => {
      collector.install({ signals: signalBus })
    })

    it('records signals with name and data', async () => {
      await signalBus.emit('books:created', { id: 1, title: 'Test Book' })

      const entries = collector.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('books:created')
      expect(entries[0].data).toEqual({ id: 1, title: 'Test Book' })
    })

    it('records signal timestamp', async () => {
      const before = Date.now()
      await signalBus.emit('test:signal', { value: 42 })
      const after = Date.now()

      const entries = collector.getEntries()
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(entries[0].timestamp).toBeLessThanOrEqual(after)
    })

    it('records source when present in data', async () => {
      await signalBus.emit('test:signal', { value: 42, source: 'TestComponent' })

      const entries = collector.getEntries()
      expect(entries[0].source).toBe('TestComponent')
    })

    it('records null source when not present in data', async () => {
      await signalBus.emit('test:signal', { value: 42 })

      const entries = collector.getEntries()
      expect(entries[0].source).toBeNull()
    })

    it('records multiple signals in order', async () => {
      await signalBus.emit('first:signal', { order: 1 })
      await signalBus.emit('second:signal', { order: 2 })
      await signalBus.emit('third:signal', { order: 3 })

      const entries = collector.getEntries()
      expect(entries).toHaveLength(3)
      expect(entries[0].name).toBe('first:signal')
      expect(entries[1].name).toBe('second:signal')
      expect(entries[2].name).toBe('third:signal')
    })

    it('captures entity lifecycle signals', async () => {
      await signalBus.emitEntity('books', SIGNAL_ACTIONS.CREATED, { id: 1 })

      const entries = collector.getEntries()
      // emitEntity emits generic signal with entity name in payload
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('entity:created')
      expect(entries[0].data.entity).toBe('books')
      expect(entries[0].data.data.id).toBe(1)
    })
  })

  describe('ring buffer behavior', () => {
    it('respects maxEntries option', async () => {
      collector = new SignalCollector({ maxEntries: 3 })
      collector.install({ signals: signalBus })

      await signalBus.emit('signal:1', { n: 1 })
      await signalBus.emit('signal:2', { n: 2 })
      await signalBus.emit('signal:3', { n: 3 })
      await signalBus.emit('signal:4', { n: 4 })
      await signalBus.emit('signal:5', { n: 5 })

      const entries = collector.getEntries()
      expect(entries).toHaveLength(3)
      expect(entries[0].name).toBe('signal:3')
      expect(entries[1].name).toBe('signal:4')
      expect(entries[2].name).toBe('signal:5')
    })

    it('uses default maxEntries of 100', () => {
      expect(collector.maxEntries).toBe(100)
    })
  })

  describe('getByPattern', () => {
    beforeEach(() => {
      collector.install({ signals: signalBus })
    })

    it('filters entries by string pattern', async () => {
      await signalBus.emit('books:created', { id: 1 })
      await signalBus.emit('users:created', { id: 2 })
      await signalBus.emit('books:updated', { id: 1 })

      const bookSignals = collector.getByPattern('books')
      expect(bookSignals).toHaveLength(2)
      expect(bookSignals.every((e) => e.name.includes('books'))).toBe(true)
    })

    it('filters entries by RegExp', async () => {
      await signalBus.emit('books:created', { id: 1 })
      await signalBus.emit('users:created', { id: 2 })
      await signalBus.emit('posts:created', { id: 3 })

      const createdSignals = collector.getByPattern(/:created$/)
      expect(createdSignals).toHaveLength(3)
      expect(createdSignals.every((e) => e.name.endsWith(':created'))).toBe(true)
    })
  })

  describe('getByDomain', () => {
    beforeEach(() => {
      collector.install({ signals: signalBus })
    })

    it('filters entries by domain prefix', async () => {
      await signalBus.emit('auth:login', { user: 'test' })
      await signalBus.emit('auth:logout', {})
      await signalBus.emit('books:created', { id: 1 })

      const authSignals = collector.getByDomain('auth')
      expect(authSignals).toHaveLength(2)
      expect(authSignals.every((e) => e.name.startsWith('auth:'))).toBe(true)
    })

    it('returns empty array for non-matching domain', async () => {
      await signalBus.emit('books:created', { id: 1 })

      const userSignals = collector.getByDomain('users')
      expect(userSignals).toHaveLength(0)
    })
  })

  describe('inherited Collector methods', () => {
    beforeEach(() => {
      collector.install({ signals: signalBus })
    })

    it('getBadge returns entry count', async () => {
      await signalBus.emit('signal:1', {})
      await signalBus.emit('signal:2', {})

      expect(collector.getBadge()).toBe(2)
    })

    it('clear removes all entries', async () => {
      await signalBus.emit('signal:1', {})
      await signalBus.emit('signal:2', {})

      collector.clear()
      expect(collector.getEntries()).toHaveLength(0)
    })

    it('getLatest returns most recent entries', async () => {
      await signalBus.emit('signal:1', {})
      await signalBus.emit('signal:2', {})
      await signalBus.emit('signal:3', {})

      const latest = collector.getLatest(2)
      expect(latest).toHaveLength(2)
      expect(latest[0].name).toBe('signal:2')
      expect(latest[1].name).toBe('signal:3')
    })
  })
})
