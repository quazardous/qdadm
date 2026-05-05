import { describe, it, expect, vi } from 'vitest'

import { DebugBridge, createDebugBridge } from '../DebugBridge'
import { Collector, type CollectorContext } from '../Collector'

class TestCollector extends Collector {
  static override collectorName = 'test'
  installCount = 0
  uninstallCount = 0

  protected override _doInstall(_ctx: CollectorContext): void {
    this.installCount++
  }

  protected override _doUninstall(): void {
    this.uninstallCount++
  }
}

class OtherCollector extends Collector {
  static override collectorName = 'other'
}

describe('DebugBridge — collector registration', () => {
  it('addCollector indexes by collectorName', () => {
    const bridge = new DebugBridge()
    const c = new TestCollector()
    bridge.addCollector(c)
    expect(bridge.getCollector('test')).toBe(c)
    expect(bridge.getAllCollectors().size).toBe(1)
  })

  it('addCollector wires the collector back to this bridge', () => {
    const bridge = new DebugBridge()
    const c = new TestCollector()
    bridge.addCollector(c)
    expect(c._bridge).toBe(bridge)
  })

  it('chains (returns this)', () => {
    const bridge = new DebugBridge()
    expect(bridge.addCollector(new TestCollector())).toBe(bridge)
    expect(bridge.addCollector(new OtherCollector())).toBe(bridge)
  })
})

describe('DebugBridge — install / uninstall lifecycle', () => {
  it('install runs each collectors install when enabled', () => {
    const bridge = new DebugBridge({ enabled: true })
    const a = new TestCollector()
    const b = new TestCollector()
    bridge.addCollector(a)
    bridge.addCollector(b) // overrides 'test' since same collectorName — keep one
    bridge.install({ signals: null })
    expect(b.installCount).toBe(1)
  })

  it('install does not call _doInstall when disabled', () => {
    const bridge = new DebugBridge({ enabled: false })
    const c = new TestCollector()
    bridge.addCollector(c)
    bridge.install({ signals: null })
    expect(c.installCount).toBe(0)
  })

  it('uninstall calls _doUninstall on every collector and clears the map', () => {
    const bridge = new DebugBridge({ enabled: true })
    const a = new TestCollector()
    const b = new OtherCollector()
    bridge.addCollector(a)
    bridge.addCollector(b)
    bridge.install({ signals: null })
    bridge.uninstall()
    expect(a.uninstallCount).toBe(1)
    expect(bridge.getAllCollectors().size).toBe(0)
  })

  it('addCollector after install installs the new collector right away when enabled', () => {
    const bridge = new DebugBridge({ enabled: true })
    bridge.install({ signals: null })
    const c = new TestCollector()
    bridge.addCollector(c)
    expect(c.installCount).toBe(1)
  })
})

describe('DebugBridge — toggle / notify / clearAll', () => {
  it('toggle flips enabled and runs install/uninstall when already installed', () => {
    const bridge = new DebugBridge({ enabled: false })
    const c = new TestCollector()
    bridge.addCollector(c)
    bridge.install({ signals: null })

    expect(bridge.toggle()).toBe(true)
    expect(c.installCount).toBe(1)
    expect(bridge.toggle()).toBe(false)
    expect(c.uninstallCount).toBe(1)
  })

  it('notify increments tick (used by debug bar reactivity)', () => {
    const bridge = new DebugBridge()
    const start = bridge.tick.value
    bridge.notify()
    bridge.notify()
    expect(bridge.tick.value).toBe(start + 2)
  })

  it('clearAll wipes entries from every collector', () => {
    const bridge = new DebugBridge()
    const a = new TestCollector()
    const b = new OtherCollector()
    a.record({ x: 1 })
    a.record({ x: 2 })
    b.record({ x: 1 })
    bridge.addCollector(a)
    bridge.addCollector(b)

    bridge.clearAll()
    expect(a.entries).toEqual([])
    expect(b.entries).toEqual([])
  })

  it('getTotalBadge sums every collector badge (unseen by default)', () => {
    const bridge = new DebugBridge()
    const a = new TestCollector()
    const b = new OtherCollector()
    a.record({ x: 1 })
    a.record({ x: 2 })
    b.record({ x: 1 })
    bridge.addCollector(a)
    bridge.addCollector(b)

    expect(bridge.getTotalBadge()).toBe(3)
    a.markAsSeen()
    expect(bridge.getTotalBadge()).toBe(1)
    expect(bridge.getTotalBadge(true)).toBe(3)
  })
})

describe('DebugBridge — describe / dump', () => {
  it('describe returns a versioned manifest with one entry per collector', () => {
    const bridge = new DebugBridge()
    bridge.addCollector(new TestCollector())
    bridge.addCollector(new OtherCollector())
    const m = bridge.describe()
    expect(m.version).toBe('1')
    expect(Object.keys(m.collectors).sort()).toEqual(['other', 'test'])
    expect(m.collectors.test?.name).toBe('test')
  })

  it('dump returns a versioned snapshot with entries + count + unseen', () => {
    const bridge = new DebugBridge()
    const c = new TestCollector()
    c.record({ a: 1 })
    c.record({ a: 2 })
    bridge.addCollector(c)
    const dumped = bridge.dump()
    expect(dumped.version).toBe('1')
    expect(typeof dumped.takenAt).toBe('number')
    expect(dumped.collectors.test?.count).toBe(2)
    expect(dumped.collectors.test?.unseen).toBe(2)
  })

  it('describe surfaces a fallback manifest when a collector throws', () => {
    const bridge = new DebugBridge()
    const c = new TestCollector()
    vi.spyOn(c, 'describe').mockImplementation(() => {
      throw new Error('manifest failure')
    })
    bridge.addCollector(c)
    const m = bridge.describe()
    expect(m.collectors.test?.summary).toMatch(/manifest failure/)
  })
})

describe('DebugBridge — call', () => {
  it('forwards to the named collectors action', async () => {
    const bridge = new DebugBridge()
    const c = new TestCollector()
    c.record({ x: 1 })
    bridge.addCollector(c)
    const out = (await bridge.call('test', 'getEntries')) as unknown[]
    expect(out.length).toBe(1)
  })

  it('throws on unknown collector with the available list', async () => {
    const bridge = new DebugBridge()
    bridge.addCollector(new TestCollector())
    await expect(bridge.call('nope', 'clear')).rejects.toThrow(
      /unknown collector "nope"\. Available: test/
    )
  })

  it('createDebugBridge factory matches the class', () => {
    expect(createDebugBridge()).toBeInstanceOf(DebugBridge)
  })
})
