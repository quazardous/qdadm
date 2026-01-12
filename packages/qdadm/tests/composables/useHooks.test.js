/**
 * Tests for useHooks composable
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useHooks } from '../../src/composables/useHooks'
import { createHookRegistry } from '../../src/hooks/HookRegistry'

describe('useHooks', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null and warns when hooks not provided', () => {
    const TestComponent = defineComponent({
      setup() {
        const hooks = useHooks()
        return () => h('div', hooks ? 'has-hooks' : 'no-hooks')
      }
    })

    const wrapper = mount(TestComponent)

    expect(wrapper.text()).toBe('no-hooks')
    expect(console.warn).toHaveBeenCalledWith(
      '[qdadm] useHooks: hook registry not available. Ensure Kernel is initialized.'
    )
  })

  it('returns hook registry when provided via injection', () => {
    const hookRegistry = createHookRegistry()

    const TestComponent = defineComponent({
      setup() {
        const hooks = useHooks()
        return () => h('div', hooks ? 'has-hooks' : 'no-hooks')
      }
    })

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          qdadmHooks: hookRegistry
        }
      }
    })

    expect(wrapper.text()).toBe('has-hooks')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('provides access to hook registry methods', () => {
    const hookRegistry = createHookRegistry()
    let capturedHooks = null

    const TestComponent = defineComponent({
      setup() {
        capturedHooks = useHooks()
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmHooks: hookRegistry
        }
      }
    })

    expect(capturedHooks).toBe(hookRegistry)
    expect(typeof capturedHooks.register).toBe('function')
    expect(typeof capturedHooks.invoke).toBe('function')
    expect(typeof capturedHooks.alter).toBe('function')
  })

  it('allows registering and invoking hooks from component', async () => {
    const hookRegistry = createHookRegistry()
    const handler = vi.fn()
    let capturedHooks = null

    const TestComponent = defineComponent({
      setup() {
        capturedHooks = useHooks()
        capturedHooks.register('test:hook', handler)
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmHooks: hookRegistry
        }
      }
    })

    await capturedHooks.invoke('test:hook', { value: 42 })

    expect(handler).toHaveBeenCalled()
    const event = handler.mock.calls[0][0]
    expect(event.data.value).toBe(42)
  })

  it('allows using alter hooks from component', async () => {
    const hookRegistry = createHookRegistry()
    let capturedHooks = null

    const TestComponent = defineComponent({
      setup() {
        capturedHooks = useHooks()
        capturedHooks.register('config:alter', (data) => ({
          ...data,
          modified: true
        }))
        return () => h('div', 'test')
      }
    })

    mount(TestComponent, {
      global: {
        provide: {
          qdadmHooks: hookRegistry
        }
      }
    })

    const result = await capturedHooks.alter('config:alter', { original: true })

    expect(result).toEqual({ original: true, modified: true })
  })
})
