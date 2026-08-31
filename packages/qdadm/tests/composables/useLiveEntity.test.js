/**
 * useLiveEntity (#1888 lot D, reported in #1887).
 *
 * Invalidating marks a cache stale; it does not repaint. This is what makes an
 * already-mounted screen follow a change made elsewhere — which is the case a
 * pushing backend exists for: someone is looking at the screen right now.
 *
 * Run: npm test
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useLiveEntity } from '../../src/composables/useLiveEntity'
import { createSignalBus } from '../../src/kernel/SignalBus'

/** Mount a component that subscribes, so onUnmounted is exercised for real. */
function mountWatcher(signals, { entity = 'runs', manager = null, reload, options = {} } = {}) {
  const Comp = defineComponent({
    setup() {
      useLiveEntity(entity, manager, reload, options)
      return () => h('div')
    },
  })
  return mount(Comp, { global: { provide: { qdadmSignals: signals } } })
}

const remote = (entity, extra = {}) => ({ entity, action: 'updated', source: 'remote', ...extra })

describe('useLiveEntity', () => {
  let signals
  let reload

  beforeEach(() => {
    vi.useFakeTimers()
    signals = createSignalBus()
    reload = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads when the entity changed remotely', () => {
    mountWatcher(signals, { reload })

    signals.emit('entity:data-invalidate', remote('runs'))
    vi.advanceTimersByTime(300)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores a local echo — the page that wrote already reloads its own way', () => {
    mountWatcher(signals, { reload })

    signals.emit('entity:data-invalidate', { entity: 'runs', source: 'local' })
    vi.advanceTimersByTime(300)

    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores another entity', () => {
    mountWatcher(signals, { reload })

    signals.emit('entity:data-invalidate', remote('jobs'))
    vi.advanceTimersByTime(300)

    expect(reload).not.toHaveBeenCalled()
  })

  describe('coalescing', () => {
    it('collapses a burst into a single reload', () => {
      mountWatcher(signals, { reload })

      for (let i = 0; i < 50; i++) signals.emit('entity:data-invalidate', remote('runs'))
      vi.advanceTimersByTime(300)

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('reloads again for a burst arriving after the window', () => {
      mountWatcher(signals, { reload })

      signals.emit('entity:data-invalidate', remote('runs'))
      vi.advanceTimersByTime(300)
      signals.emit('entity:data-invalidate', remote('runs'))
      vi.advanceTimersByTime(300)

      expect(reload).toHaveBeenCalledTimes(2)
    })

    it('honours the entity policy window', () => {
      mountWatcher(signals, { reload, manager: { live: { coalesceMs: 1000 } } })

      signals.emit('entity:data-invalidate', remote('runs'))
      vi.advanceTimersByTime(300)
      expect(reload).not.toHaveBeenCalled()

      vi.advanceTimersByTime(700)
      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('fires synchronously when the window is 0', () => {
      mountWatcher(signals, { reload, manager: { live: { coalesceMs: 0 } } })

      signals.emit('entity:data-invalidate', remote('runs'))

      expect(reload).toHaveBeenCalledTimes(1)
    })
  })

  describe('policy refresh: false', () => {
    it('does not reload — invalidation happened, the screen just does not chase it', () => {
      mountWatcher(signals, { reload, manager: { live: { refresh: false } } })

      signals.emit('entity:data-invalidate', remote('runs'))
      vi.advanceTimersByTime(1000)

      expect(reload).not.toHaveBeenCalled()
    })
  })

  describe('id scoping (detail screens)', () => {
    it('reloads for its own record', () => {
      mountWatcher(signals, { reload, options: { id: () => 42 } })

      signals.emit('entity:data-invalidate', remote('runs', { id: 42 }))
      vi.advanceTimersByTime(300)

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('ignores somebody else\'s record', () => {
      mountWatcher(signals, { reload, options: { id: () => 42 } })

      signals.emit('entity:data-invalidate', remote('runs', { id: 7 }))
      vi.advanceTimersByTime(300)

      expect(reload).not.toHaveBeenCalled()
    })

    it('matches loosely across string and number ids', () => {
      mountWatcher(signals, { reload, options: { id: () => '42' } })

      signals.emit('entity:data-invalidate', remote('runs', { id: 42 }))
      vi.advanceTimersByTime(300)

      expect(reload).toHaveBeenCalledTimes(1)
    })

    it('reloads on an id-less event — it concerns the whole entity', () => {
      mountWatcher(signals, { reload, options: { id: () => 42 } })

      signals.emit('entity:data-invalidate', remote('runs'))
      vi.advanceTimersByTime(300)

      expect(reload).toHaveBeenCalledTimes(1)
    })
  })

  describe('teardown', () => {
    it('stops on unmount', () => {
      const wrapper = mountWatcher(signals, { reload })
      wrapper.unmount()

      signals.emit('entity:data-invalidate', remote('runs'))
      vi.advanceTimersByTime(300)

      expect(reload).not.toHaveBeenCalled()
    })

    it('drops a reload already scheduled when the screen goes away', () => {
      const wrapper = mountWatcher(signals, { reload })

      signals.emit('entity:data-invalidate', remote('runs'))
      wrapper.unmount() // user navigated away mid-window
      vi.advanceTimersByTime(300)

      expect(reload).not.toHaveBeenCalled()
    })
  })

  it('is inert without a signal bus', () => {
    const Comp = defineComponent({
      setup() {
        const stop = useLiveEntity('runs', null, reload)
        expect(typeof stop).toBe('function')
        return () => h('div')
      },
    })
    mount(Comp)

    expect(reload).not.toHaveBeenCalled()
  })
})
