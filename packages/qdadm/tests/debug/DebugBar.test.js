/**
 * Unit tests for DebugBar component
 *
 * Tests the DebugBar Vue component that displays debug information
 * from registered collectors.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import DebugBar from '../../src/debug/components/DebugBar.vue'

// Mock PrimeVue components
vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    props: ['value', 'severity'],
    template: '<span class="p-badge" :data-value="value" :data-severity="severity">{{ value }}</span>'
  }
}))

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    props: ['icon', 'severity', 'size', 'text', 'rounded', 'label', 'title'],
    template: '<button class="p-button" :data-icon="icon" :title="title" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  }
}))

vi.mock('primevue/tabview', () => ({
  default: {
    name: 'TabView',
    props: ['activeIndex'],
    template: '<div class="p-tabview"><slot /></div>',
    emits: ['update:activeIndex']
  }
}))

vi.mock('primevue/tabpanel', () => ({
  default: {
    name: 'TabPanel',
    template: '<div class="p-tabpanel"><slot name="header" /><slot /></div>'
  }
}))

/**
 * Create a mock DebugBridge for testing
 */
function createMockBridge(options = {}) {
  const enabled = ref(options.enabled ?? false)
  const collectors = reactive(new Map())

  return {
    enabled,
    collectors,
    toggle: vi.fn(() => {
      enabled.value = !enabled.value
      return enabled.value
    }),
    clearAll: vi.fn(() => {
      for (const collector of collectors.values()) {
        collector.entries = []
      }
    }),
    getTotalBadge: vi.fn(() => {
      let total = 0
      for (const collector of collectors.values()) {
        total += collector.entries.length
      }
      return total
    }),
    addCollector(collector) {
      collectors.set(collector.name, collector)
      return this
    }
  }
}

/**
 * Create a mock collector for testing
 */
function createMockCollector(name, entries = []) {
  return {
    name,
    entries: [...entries],
    getBadge: vi.fn(function() { return this.entries.length }),
    getEntries: vi.fn(function() { return this.entries }),
    clear: vi.fn(function() { this.entries = [] })
  }
}

describe('DebugBar', () => {
  let bridge

  beforeEach(() => {
    bridge = createMockBridge()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders the debug bar header', () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      expect(wrapper.find('.debug-bar').exists()).toBe(true)
      expect(wrapper.find('.debug-bar-header').exists()).toBe(true)
      expect(wrapper.find('.debug-bar-title').exists()).toBe(true)
    })

    it('shows Debug label in header', () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      expect(wrapper.find('.debug-bar-title').text()).toContain('Debug')
    })

    it('is collapsed by default', () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      expect(wrapper.find('.debug-bar-panel').exists()).toBe(false)
    })

    it('applies custom zIndex', () => {
      const wrapper = mount(DebugBar, {
        props: { bridge, zIndex: 5000 }
      })

      expect(wrapper.find('.debug-bar').attributes('style')).toContain('z-index: 5000')
    })
  })

  describe('expand/collapse', () => {
    it('expands when header is clicked', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      await wrapper.find('.debug-bar-header').trigger('click')

      expect(wrapper.find('.debug-bar-panel').exists()).toBe(true)
    })

    it('collapses when header is clicked again', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      await wrapper.find('.debug-bar-header').trigger('click')
      expect(wrapper.find('.debug-bar-panel').exists()).toBe(true)

      await wrapper.find('.debug-bar-header').trigger('click')
      expect(wrapper.find('.debug-bar-panel').exists()).toBe(false)
    })
  })

  describe('collectors display', () => {
    it('shows empty state when no collectors', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      await wrapper.find('.debug-bar-header').trigger('click')

      expect(wrapper.find('.debug-bar-empty').exists()).toBe(true)
      expect(wrapper.text()).toContain('No collectors registered')
    })

    it('shows tabs for each collector', async () => {
      bridge.addCollector(createMockCollector('ErrorCollector'))
      bridge.addCollector(createMockCollector('SignalCollector'))

      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      await wrapper.find('.debug-bar-header').trigger('click')

      expect(wrapper.find('.p-tabview').exists()).toBe(true)
      const tabHeaders = wrapper.findAll('.debug-bar-tab-header')
      expect(tabHeaders.length).toBe(2)
    })

    it('shows entry count badge for collectors with entries', async () => {
      const collector = createMockCollector('ErrorCollector', [
        { message: 'Error 1', timestamp: Date.now() },
        { message: 'Error 2', timestamp: Date.now() }
      ])
      bridge.addCollector(collector)

      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      await wrapper.find('.debug-bar-header').trigger('click')

      const badge = wrapper.find('.debug-bar-tab-header .p-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.attributes('data-value')).toBe('2')
    })
  })

  describe('enable/disable toggle', () => {
    it('shows play button when disabled', () => {
      bridge.enabled.value = false

      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      const toggleBtn = wrapper.find('[title="Enable collectors"]')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.attributes('data-icon')).toBe('pi pi-play')
    })

    it('shows pause button when enabled', () => {
      bridge.enabled.value = true

      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      const toggleBtn = wrapper.find('[title="Disable collectors"]')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.attributes('data-icon')).toBe('pi pi-pause')
    })

    it('calls bridge.toggle when toggle button clicked', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      const toggleBtn = wrapper.find('[title="Enable collectors"]')
      await toggleBtn.trigger('click')

      expect(bridge.toggle).toHaveBeenCalled()
    })
  })

  describe('clear functionality', () => {
    it('calls bridge.clearAll when clear button clicked', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      const clearBtn = wrapper.find('[title="Clear all entries"]')
      await clearBtn.trigger('click')

      expect(bridge.clearAll).toHaveBeenCalled()
    })
  })

  describe('total badge', () => {
    it('shows total badge when there are entries', () => {
      const collector = createMockCollector('ErrorCollector', [
        { message: 'Error 1', timestamp: Date.now() }
      ])
      bridge.addCollector(collector)

      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      // Force update tick
      vi.advanceTimersByTime(1000)

      const titleBadge = wrapper.find('.debug-bar-title .p-badge')
      expect(titleBadge.exists()).toBe(true)
    })
  })

  describe('collector icons', () => {
    it('shows correct icon for ErrorCollector', async () => {
      bridge.addCollector(createMockCollector('ErrorCollector'))

      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      await wrapper.find('.debug-bar-header').trigger('click')

      const tabHeader = wrapper.find('.debug-bar-tab-header')
      expect(tabHeader.find('.pi-exclamation-triangle').exists()).toBe(true)
    })

    it('shows correct icon for SignalCollector', async () => {
      bridge.addCollector(createMockCollector('SignalCollector'))

      const wrapper = mount(DebugBar, {
        props: { bridge }
      })

      await wrapper.find('.debug-bar-header').trigger('click')

      const tabHeader = wrapper.find('.debug-bar-tab-header')
      expect(tabHeader.find('.pi-bolt').exists()).toBe(true)
    })
  })
})
