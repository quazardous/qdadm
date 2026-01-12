/**
 * Tests for useSignals composable
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, onUnmounted } from 'vue'
import { useSignals } from '../../src/composables/useSignals'
import { createSignalBus, SIGNAL_ACTIONS } from '../../src/kernel/SignalBus'

describe('useSignals', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null and warns when signals not provided', () => {
    const TestComponent = defineComponent({
      setup() {
        const signals = useSignals()
        return () => h('div', signals ? 'has-signals' : 'no-signals')
      }
    })

    const wrapper = mount(TestComponent)

    expect(wrapper.text()).toBe('no-signals')
    expect(console.warn).toHaveBeenCalledWith(
      '[qdadm] useSignals: signal bus not available. Ensure Kernel is initialized.'
    )
  })

  it('returns signal bus when provided via injection', () => {
    const signalBus = createSignalBus()

    const TestComponent = defineComponent({
      setup() {
        const signals = useSignals()
        return () => h('div', signals ? 'has-signals' : 'no-signals')
      }
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    expect(wrapper.text()).toBe('has-signals')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('provides access to signal bus methods', () => {
    const signalBus = createSignalBus()
    let capturedSignals = null

    const TestComponent = defineComponent({
      setup() {
        capturedSignals = useSignals()
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    expect(capturedSignals).toBe(signalBus)
    expect(typeof capturedSignals.on).toBe('function')
    expect(typeof capturedSignals.off).toBe('function')
    expect(typeof capturedSignals.emit).toBe('function')
    expect(typeof capturedSignals.emitEntity).toBe('function')
  })

  it('allows subscribing to signals from component', async () => {
    const signalBus = createSignalBus()
    const handler = vi.fn()
    let capturedSignals = null

    const TestComponent = defineComponent({
      setup() {
        capturedSignals = useSignals()
        capturedSignals.on('test:signal', handler)
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    await capturedSignals.emit('test:signal', { value: 42 })

    expect(handler).toHaveBeenCalled()
    const event = handler.mock.calls[0][0]
    expect(event.data.value).toBe(42)
  })

  it('on() returns unbind function for cleanup', async () => {
    const signalBus = createSignalBus()
    const handler = vi.fn()
    let unbind = null

    const TestComponent = defineComponent({
      setup() {
        const signals = useSignals()
        unbind = signals.on('cleanup:test', handler)
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    // Handler should be called before unbind
    await signalBus.emit('cleanup:test', { before: true })
    expect(handler).toHaveBeenCalledTimes(1)

    // After unbind, handler should not be called
    unbind()
    await signalBus.emit('cleanup:test', { after: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('supports auto-cleanup on unmount pattern', async () => {
    const signalBus = createSignalBus()
    const handler = vi.fn()

    const TestComponent = defineComponent({
      setup() {
        const signals = useSignals()
        const unbind = signals.on('unmount:test', handler)
        onUnmounted(() => unbind())
        return () => h('div', 'test')
      }
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    // Before unmount, signal is received
    await signalBus.emit('unmount:test', { before: true })
    expect(handler).toHaveBeenCalledTimes(1)

    // Unmount component
    wrapper.unmount()

    // After unmount, signal is not received
    await signalBus.emit('unmount:test', { after: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('allows subscribing to entity signals with entity name in payload', async () => {
    const signalBus = createSignalBus()
    const handler = vi.fn()
    let capturedSignals = null

    const TestComponent = defineComponent({
      setup() {
        capturedSignals = useSignals()
        // Subscribe to generic entity signal
        capturedSignals.on('entity:created', handler)
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    await capturedSignals.emitEntity('books', SIGNAL_ACTIONS.CREATED, {
      id: 1,
      title: 'Test Book'
    })

    expect(handler).toHaveBeenCalled()
    const event = handler.mock.calls[0][0]
    expect(event.data.entity).toBe('books')
    expect(event.data.data.id).toBe(1)
  })

  it('allows subscribing to wildcard signals', async () => {
    const signalBus = createSignalBus()
    const handler = vi.fn()
    let capturedSignals = null

    const TestComponent = defineComponent({
      setup() {
        capturedSignals = useSignals()
        capturedSignals.on('entity:*', handler)
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    await capturedSignals.emitEntity('books', SIGNAL_ACTIONS.CREATED, { id: 1 })
    await capturedSignals.emitEntity('users', SIGNAL_ACTIONS.UPDATED, { id: 2 })

    // Wildcard on entity:* should match entity:created and entity:updated
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('multiple components can subscribe to same signal', async () => {
    const signalBus = createSignalBus()
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    const Component1 = defineComponent({
      setup() {
        const signals = useSignals()
        signals.on('shared:signal', handler1)
        return () => h('div', 'component1')
      }
    })

    const Component2 = defineComponent({
      setup() {
        const signals = useSignals()
        signals.on('shared:signal', handler2)
        return () => h('div', 'component2')
      }
    })

    const provide = { qdadmSignals: signalBus }

    mount(Component1, { global: { provide } })
    mount(Component2, { global: { provide } })

    await signalBus.emit('shared:signal', { shared: true })

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('provides access to listenerCount', () => {
    const signalBus = createSignalBus()
    let capturedSignals = null

    const TestComponent = defineComponent({
      setup() {
        capturedSignals = useSignals()
        capturedSignals.on('count:test', () => {})
        capturedSignals.on('count:test', () => {})
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    expect(capturedSignals.listenerCount('count:test')).toBe(2)
  })

  it('provides access to signalNames', () => {
    const signalBus = createSignalBus()
    let capturedSignals = null

    const TestComponent = defineComponent({
      setup() {
        capturedSignals = useSignals()
        capturedSignals.on('signal:one', () => {})
        capturedSignals.on('signal:two', () => {})
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmSignals: signalBus
        }
      }
    })

    const names = capturedSignals.signalNames()
    expect(names).toContain('signal:one')
    expect(names).toContain('signal:two')
  })
})
