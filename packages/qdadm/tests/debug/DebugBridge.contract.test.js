/**
 * Contract tests for DebugBridge: describe / dump / call.
 *
 * Verifies the agent-facing JSON surface stays stable: every collector
 * publishes a manifest, every snapshot is JSON-serializable, and call()
 * routes to the universal verbs and any registered actions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createDebugBridge } from '../../src/modules/debug/DebugBridge'
import { Collector } from '../../src/modules/debug/Collector'
import { SignalCollector } from '../../src/modules/debug/SignalCollector'
import { ErrorCollector } from '../../src/modules/debug/ErrorCollector'
import { createSignalBus } from '../../src/kernel/SignalBus'

class CounterCollector extends Collector {
  static collectorName = 'counter'
  static records = false
  constructor() {
    super()
    this.count = 0
  }
  describe() {
    return {
      name: this.name,
      records: false,
      summary: 'A trivial counter.',
      stateShape: { count: 'number' },
      actions: [
        ...this._builtinActionManifests(),
        { name: 'inc', summary: 'Increment the counter.', mutates: true },
        { name: 'set', summary: 'Set the counter.', args: { value: 'number' }, mutates: true },
      ],
    }
  }
  snapshot() {
    return {
      name: this.name,
      entries: [],
      count: 0,
      unseen: 0,
      state: { count: this.count },
    }
  }
  async call(action, args = {}) {
    if (action === 'inc') {
      this.count++
      return { ok: true, count: this.count }
    }
    if (action === 'set') {
      this.count = Number(args.value ?? 0)
      return { ok: true, count: this.count }
    }
    return super.call(action, args)
  }
}

describe('DebugBridge contract (describe/dump/call)', () => {
  let bridge
  let signalBus

  beforeEach(() => {
    bridge = createDebugBridge({ enabled: true })
    signalBus = createSignalBus()
    bridge.addCollector(new SignalCollector())
    bridge.addCollector(new ErrorCollector())
    bridge.addCollector(new CounterCollector())
    bridge.install({ signals: signalBus })
  })

  describe('describe()', () => {
    it('returns version 1 manifest', () => {
      const m = bridge.describe()
      expect(m.version).toBe('1')
      expect(typeof m.tick).toBe('number')
      expect(typeof m.enabled).toBe('boolean')
    })

    it('includes every collector', () => {
      const m = bridge.describe()
      expect(Object.keys(m.collectors).sort()).toEqual(['counter', 'errors', 'signals'])
    })

    it('every collector advertises the universal verbs', () => {
      const m = bridge.describe()
      for (const c of Object.values(m.collectors)) {
        const names = c.actions.map((a) => a.name)
        expect(names).toContain('clear')
        expect(names).toContain('markSeen')
        expect(names).toContain('getEntries')
      }
    })

    it('signals collector advertises its custom actions', () => {
      const sig = bridge.describe().collectors.signals
      const names = sig.actions.map((a) => a.name)
      expect(names).toContain('getByDomain')
      expect(names).toContain('getByPattern')
      expect(names).toContain('emit')
    })

    it('manifest is JSON-serializable', () => {
      expect(() => JSON.stringify(bridge.describe())).not.toThrow()
    })
  })

  describe('dump()', () => {
    it('returns version 1 snapshot with takenAt', () => {
      const d = bridge.dump()
      expect(d.version).toBe('1')
      expect(typeof d.takenAt).toBe('number')
    })

    it('exposes state for stateful collectors', () => {
      const d = bridge.dump()
      expect(d.collectors.counter.state).toEqual({ count: 0 })
    })

    it('captures recorded entries', () => {
      signalBus.emit('test:foo', { a: 1 })
      signalBus.emit('test:bar', { b: 2 })
      const d = bridge.dump()
      const sigEntries = d.collectors.signals.entries
      expect(sigEntries.length).toBeGreaterThanOrEqual(2)
      expect(sigEntries.map((e) => e.name)).toEqual(
        expect.arrayContaining(['test:foo', 'test:bar'])
      )
    })

    it('snapshot is JSON-serializable', () => {
      signalBus.emit('test:foo', { a: 1 })
      expect(() => JSON.stringify(bridge.dump())).not.toThrow()
    })
  })

  describe('call() — universal verbs', () => {
    it('clear() empties entries', async () => {
      signalBus.emit('test:foo', { a: 1 })
      expect(bridge.dump().collectors.signals.count).toBeGreaterThan(0)
      const r = await bridge.call('signals', 'clear')
      expect(r).toEqual({ ok: true })
      expect(bridge.dump().collectors.signals.count).toBe(0)
    })

    it('getEntries returns the latest N when limit is given', async () => {
      signalBus.emit('test:1', {})
      signalBus.emit('test:2', {})
      signalBus.emit('test:3', {})
      const r = await bridge.call('signals', 'getEntries', { limit: 2 })
      expect(r).toHaveLength(2)
      expect(r[1].name).toBe('test:3')
    })

    it('rejects unknown collector', async () => {
      await expect(bridge.call('nope', 'getEntries')).rejects.toThrow(/unknown collector/)
    })

    it('rejects unknown action', async () => {
      await expect(bridge.call('signals', 'noSuchAction')).rejects.toThrow(/unknown action/)
    })
  })

  describe('call() — custom actions', () => {
    it('routes to subclass-defined actions', async () => {
      const r1 = await bridge.call('counter', 'inc')
      expect(r1).toEqual({ ok: true, count: 1 })
      const r2 = await bridge.call('counter', 'set', { value: 42 })
      expect(r2).toEqual({ ok: true, count: 42 })
      expect(bridge.dump().collectors.counter.state.count).toBe(42)
    })

    it('signals.getByDomain filters entries', async () => {
      signalBus.emit('a:one', {})
      signalBus.emit('a:two', {})
      signalBus.emit('b:three', {})
      const r = await bridge.call('signals', 'getByDomain', { domain: 'a' })
      expect(r).toHaveLength(2)
      expect(r.every((e) => e.name.startsWith('a:'))).toBe(true)
    })

    it('signals.emit pushes through the bus', async () => {
      const r = await bridge.call('signals', 'emit', { name: 'foo:bar', data: { x: 1 } })
      expect(r).toEqual({ ok: true, name: 'foo:bar' })
      const entries = bridge.dump().collectors.signals.entries
      expect(entries.some((e) => e.name === 'foo:bar')).toBe(true)
    })
  })
})
