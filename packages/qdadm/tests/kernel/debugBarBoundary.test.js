/**
 * The debug bar must not take down the app it observes (#1900 lot C.1).
 *
 * A consumer watched their admin die because the diagnostic tool bolted to it
 * threw during render. Their only exit was to rebuild without the bar. These
 * tests pin the guard that makes that impossible.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createDebugBarBoundary } from '../../src/kernel/Kernel.vue'

const AppBody = defineComponent({
  name: 'AppBody',
  render: () => h('main', 'the application'),
})

/** Mounts an app body next to a boundary-wrapped bar, as the Kernel does. */
function mountApp(Bar) {
  const Boundary = createDebugBarBoundary(Bar)
  return mount(
    defineComponent({
      render: () => h('div', [h(AppBody), h(Boundary)]),
    })
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('debug bar error boundary', () => {
  it('renders the bar when it behaves', () => {
    const Bar = defineComponent({ render: () => h('aside', 'debug bar') })

    const wrapper = mountApp(Bar)

    expect(wrapper.text()).toContain('debug bar')
    expect(wrapper.text()).toContain('the application')
  })

  it('keeps the app alive when the bar throws on first render', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Bar = defineComponent({
      render() {
        throw new Error('bar exploded')
      },
    })

    const wrapper = mountApp(Bar)

    // The point of the whole guard: the app is still there.
    expect(wrapper.text()).toContain('the application')
    expect(wrapper.find('aside').exists()).toBe(false)
    expect(spy).toHaveBeenCalled()
  })

  it('drops the bar when it throws on a LATER render, app untouched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = ref(false)
    const Bar = defineComponent({
      render() {
        if (boom.value) throw new Error('bar exploded later')
        return h('aside', 'debug bar')
      },
    })

    const wrapper = mountApp(Bar)
    expect(wrapper.text()).toContain('debug bar')

    boom.value = true
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('the application')
    expect(wrapper.text()).not.toContain('debug bar')
  })

  it('reports the failure once, not on every frame', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Bar = defineComponent({
      render() {
        throw new Error('bar exploded')
      },
    })

    const wrapper = mountApp(Bar)
    await nextTick()
    await nextTick()

    const ours = spy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[qdadm] The debug bar threw')
    )
    expect(ours).toHaveLength(1)
    expect(wrapper.text()).toContain('the application')
  })

  it('names the escape hatch in the message it logs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Bar = defineComponent({
      render() {
        throw new Error('bar exploded')
      },
    })

    mountApp(Bar)

    // Whoever reads this console line is looking for a way out.
    const message = spy.mock.calls.map((args) => String(args[0])).join('\n')
    expect(message).toContain('?qddebug=off')
  })
})
