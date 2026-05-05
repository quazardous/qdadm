import { describe, it, expect, vi } from 'vitest'

import { Collector, type CollectorContext, type CollectorEntry } from '../Collector'

class TestCollector extends Collector {
  static override collectorName = 'test'
  installed = false

  protected override _doInstall(_ctx: CollectorContext): void {
    this.installed = true
  }

  protected override _doUninstall(): void {
    this.installed = false
  }
}

interface NumericEntry extends CollectorEntry {
  n: number
}

describe('Collector — entries (record / clear / getLatest)', () => {
  it('record() pushes a timestamped entry and stamps _isNew', () => {
    const c = new TestCollector()
    c.record({ kind: 'a' })
    expect(c.entries.length).toBe(1)
    expect(c.entries[0]?.kind).toBe('a')
    expect(typeof c.entries[0]?.timestamp).toBe('number')
    expect(c.entries[0]?._isNew).toBe(true)
  })

  it('respects maxEntries (ring-buffer eviction)', () => {
    const c = new TestCollector({ maxEntries: 3 })
    for (let i = 0; i < 5; i++) c.record({ n: i } as Omit<NumericEntry, 'timestamp' | '_isNew'>)
    expect(c.entries.length).toBe(3)
    expect((c.entries as NumericEntry[]).map((e) => e.n)).toEqual([2, 3, 4])
  })

  it('clear() empties entries and resets seen counter', () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    c.record({ a: 2 })
    c.markAsSeen()
    c.clear()
    expect(c.entries).toEqual([])
    expect(c.getUnseenCount()).toBe(0)
  })

  it('getLatest(n) returns the n most recent entries', () => {
    const c = new TestCollector()
    for (let i = 0; i < 5; i++) c.record({ n: i } as Omit<NumericEntry, 'timestamp' | '_isNew'>)
    expect((c.getLatest(2) as NumericEntry[]).map((e) => e.n)).toEqual([3, 4])
  })

  it('getEntries() returns a snapshot copy (mutating it does not affect state)', () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    const snap = c.getEntries()
    snap.length = 0
    expect(c.entries.length).toBe(1)
  })
})

describe('Collector — badge / unseen counters', () => {
  it('getUnseenCount counts records since the last markAsSeen', () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    c.record({ a: 2 })
    expect(c.getUnseenCount()).toBe(2)
    c.markAsSeen()
    expect(c.getUnseenCount()).toBe(0)
    c.record({ a: 3 })
    expect(c.getUnseenCount()).toBe(1)
  })

  it('getBadge() returns unseen by default, total with countAll=true', () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    c.record({ a: 2 })
    c.markAsSeen()
    c.record({ a: 3 })
    expect(c.getBadge()).toBe(1)
    expect(c.getBadge(true)).toBe(3)
  })

  it('markAsSeen drops _isNew flags on existing entries', () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    expect(c.entries[0]?._isNew).toBe(true)
    c.markAsSeen()
    expect(c.entries[0]?._isNew).toBeUndefined()
  })
})

describe('Collector — install lifecycle', () => {
  it('install() runs _doInstall and sets context', () => {
    const c = new TestCollector()
    const ctx: CollectorContext = { signals: null, custom: 1 }
    c.install(ctx)
    expect(c.installed).toBe(true)
  })

  it('uninstall() runs _doUninstall', () => {
    const c = new TestCollector()
    c.install({ signals: null })
    c.uninstall()
    expect(c.installed).toBe(false)
  })

  it('enabled = false during install skips _doInstall, but install records context', () => {
    const c = new TestCollector({ enabled: false })
    c.install({ signals: null })
    expect(c.installed).toBe(false)
  })

  it('toggling enabled after install runs install/uninstall transitions', () => {
    const c = new TestCollector({ enabled: false })
    c.install({ signals: null })
    expect(c.installed).toBe(false)
    c.enabled = true
    expect(c.installed).toBe(true)
    c.enabled = false
    expect(c.installed).toBe(false)
  })

  it('toggle() flips enabled and returns the new state', () => {
    const c = new TestCollector()
    expect(c.toggle()).toBe(false)
    expect(c.enabled).toBe(false)
    expect(c.toggle()).toBe(true)
  })
})

describe('Collector — notify', () => {
  it('record() triggers onNotify subscribers', () => {
    const c = new TestCollector()
    const cb = vi.fn()
    c.onNotify(cb)
    c.record({ a: 1 })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('notifyChange() forwards to bridge.notify()', () => {
    const c = new TestCollector()
    const notify = vi.fn()
    c._bridge = { notify }
    c.notifyChange()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('onNotify returns an unbind that removes the callback', () => {
    const c = new TestCollector()
    const cb = vi.fn()
    const unbind = c.onNotify(cb)
    unbind()
    c.notifyChange()
    expect(cb).not.toHaveBeenCalled()
  })

  it('errors thrown by notify callbacks are swallowed', () => {
    const c = new TestCollector()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    c.onNotify(() => {
      throw new Error('boom')
    })
    expect(() => c.notifyChange()).not.toThrow()
    warn.mockRestore()
  })
})

describe('Collector — actions', () => {
  it('builtin clear action empties entries', async () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    await c.call('clear')
    expect(c.entries).toEqual([])
  })

  it('builtin markSeen marks all entries as seen', async () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    await c.call('markSeen')
    expect(c.getUnseenCount()).toBe(0)
  })

  it('builtin getEntries returns entries (and respects limit)', async () => {
    const c = new TestCollector()
    c.record({ n: 1 })
    c.record({ n: 2 })
    c.record({ n: 3 })
    const all = (await c.call('getEntries')) as NumericEntry[]
    expect(all.length).toBe(3)
    const limited = (await c.call('getEntries', { limit: 2 })) as NumericEntry[]
    expect(limited.map((e) => e.n)).toEqual([2, 3])
  })

  it('registerAction adds a custom action callable via call()', async () => {
    const c = new TestCollector()
    c.registerAction(
      { name: 'echo', summary: 'echo args', args: { msg: 'string' } },
      (args) => ({ echoed: args?.msg })
    )
    const out = await c.call('echo', { msg: 'hello' })
    expect(out).toEqual({ echoed: 'hello' })
  })

  it('call() throws on unknown action with a list of available actions', async () => {
    const c = new TestCollector()
    await expect(c.call('nope')).rejects.toThrow(/unknown action "nope"/)
  })

  it('describe() lists builtin + registered actions', () => {
    const c = new TestCollector()
    c.registerAction(
      { name: 'echo', summary: 'echo args' },
      () => ({})
    )
    const manifest = c.describe()
    const names = manifest.actions.map((a) => a.name)
    expect(names).toContain('clear')
    expect(names).toContain('markSeen')
    expect(names).toContain('getEntries')
    expect(names).toContain('echo')
  })
})

describe('Collector — snapshot', () => {
  it('returns name, entries, count, unseen', () => {
    const c = new TestCollector()
    c.record({ a: 1 })
    c.record({ a: 2 })
    const snap = c.snapshot()
    expect(snap.name).toBe('test')
    expect(snap.count).toBe(2)
    expect(snap.unseen).toBe(2)
    expect(snap.entries.length).toBe(2)
  })
})
