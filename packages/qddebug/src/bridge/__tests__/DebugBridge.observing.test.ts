/**
 * Observing must not perturb (#1896).
 *
 * A consumer's debug bar spun at ~8000 ticks/s and killed the page. The cycle:
 * a snapshot resolved i18n labels, resolving a MISSING key emits a signal, the
 * signal was recorded by two collectors, each notified, each notification
 * bumped the tick the snapshot pusher watches. One tick produced fourteen.
 *
 * Two locks are tested here. The re-entrance guard closes that cycle and every
 * future one shaped like it; the frame coalescing bounds the cost of any loop
 * that still gets through — the difference between a measurable slowdown and a
 * dead page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DebugBridge } from '../DebugBridge'
import { Collector } from '../Collector'

/** A collector that emits while being observed — the shape that bit us. */
class NoisyCollector extends Collector {
  static override collectorName = 'noisy'
  snapshotCount = 0

  override snapshot() {
    this.snapshotCount++
    // Resolving a missing label during a snapshot: looks like a read, isn't.
    this.notifyChange()
    this.notifyChange()
    return { name: this.name, entries: [], count: 0, unseen: 0 }
  }

  override describe() {
    this.notifyChange()
    return { name: this.name, records: false, summary: 'noisy', actions: [] }
  }
}

describe('DebugBridge — observing must not perturb', () => {
  let bridge: DebugBridge

  beforeEach(() => {
    vi.useFakeTimers()
    bridge = new DebugBridge({ enabled: true })
    bridge.addCollector(new NoisyCollector())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not tick for what a collector emits during dump()', () => {
    const before = bridge.tick.value
    bridge.dump()
    vi.advanceTimersByTime(50)

    expect(bridge.tick.value).toBe(before)
  })

  it('does not tick for what a collector emits during describe()', () => {
    const before = bridge.tick.value
    bridge.describe()
    vi.advanceTimersByTime(50)

    expect(bridge.tick.value).toBe(before)
  })

  it('still ticks normally once the snapshot is over', () => {
    bridge.dump()
    vi.advanceTimersByTime(50)
    const after = bridge.tick.value

    bridge.notify()
    vi.advanceTimersByTime(50)

    expect(bridge.tick.value).toBe(after + 1)
  })

  it('lifts the guard even when a collector throws mid-snapshot', () => {
    class ExplodingCollector extends Collector {
      static override collectorName = 'boom'
      override snapshot(): never {
        throw new Error('boom')
      }
    }
    bridge.addCollector(new ExplodingCollector())

    expect(() => bridge.dump()).not.toThrow()

    const after = bridge.tick.value
    bridge.notify()
    vi.advanceTimersByTime(50)
    expect(bridge.tick.value).toBe(after + 1)
  })

  describe('frame coalescing', () => {
    it('collapses a burst into a single tick', () => {
      const before = bridge.tick.value
      for (let i = 0; i < 5000; i++) bridge.notify()
      vi.advanceTimersByTime(50)

      expect(bridge.tick.value).toBe(before + 1)
    })

    it('ticks again on the next frame', () => {
      const before = bridge.tick.value
      bridge.notify()
      vi.advanceTimersByTime(50)
      bridge.notify()
      vi.advanceTimersByTime(50)

      expect(bridge.tick.value).toBe(before + 2)
    })

    it('notifySync bypasses the coalescing', () => {
      const before = bridge.tick.value
      bridge.notifySync()

      expect(bridge.tick.value).toBe(before + 1)
    })

    it('a runaway collector costs one tick per frame, not thousands', () => {
      // The property that makes the class survivable: even unbounded
      // notification produces bounded ticks.
      const before = bridge.tick.value
      for (let frame = 0; frame < 3; frame++) {
        for (let i = 0; i < 10_000; i++) bridge.notify()
        vi.advanceTimersByTime(20)
      }

      expect(bridge.tick.value).toBe(before + 3)
    })
  })
})
