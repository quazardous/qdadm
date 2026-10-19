/**
 * The debug bar component is kept raw (#4117): stored in a deep ref it became
 * a reactive proxy, and Vue warned "received a Component that was made a
 * reactive object" on every page load.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, isProxy, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { getQdadmDebugBarRef, setQdadmDebugBar, createDebugBarBoundary } from '../../src/kernel/Kernel.vue'

const Bar = defineComponent({ name: 'Bar', render: () => h('div', { class: 'bar' }, 'bar') })

afterEach(() => {
  setQdadmDebugBar(null)
  vi.restoreAllMocks()
})

describe('debug bar reference (#4117)', () => {
  it('holds the component as is, not as a reactive proxy', () => {
    setQdadmDebugBar(Bar)
    expect(isProxy(getQdadmDebugBarRef().value)).toBe(false)
    expect(getQdadmDebugBarRef().value).toBe(Bar)
  })

  it('renders the bar without the reactive-component warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setQdadmDebugBar(Bar)
    const wrapper = mount(createDebugBarBoundary(getQdadmDebugBarRef().value))
    expect(wrapper.find('.bar').exists()).toBe(true)
    expect(warn.mock.calls.some(([m]) => String(m).includes('made a reactive object'))).toBe(false)
  })

  it('stays raw even through a deep ref left on window by an older copy of the module', () => {
    const w = window
    const previous = w.__qdadmDebugBarRef
    w.__qdadmDebugBarRef = ref(null)
    try {
      setQdadmDebugBar(Bar)
      expect(isProxy(getQdadmDebugBarRef().value)).toBe(false)
    } finally {
      w.__qdadmDebugBarRef = previous
    }
  })
})
