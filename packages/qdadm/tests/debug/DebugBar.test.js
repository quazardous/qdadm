/**
 * Unit tests for DebugBar component
 *
 * Tests the DebugBar Vue component that displays debug information
 * from registered collectors.
 */

// Mock ResizeObserver (not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, reactive } from 'vue'
import DebugBar from '../../src/modules/debug/components/DebugBar.vue'

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

// Mock panel components to avoid complex dependencies
vi.mock('../../src/modules/debug/components/panels', () => ({
  ZonesPanel: { template: '<div class="zones-panel">Zones</div>' },
  AuthPanel: { template: '<div class="auth-panel">Auth</div>' },
  EntitiesPanel: { template: '<div class="entities-panel">Entities</div>' },
  ToastsPanel: { template: '<div class="toasts-panel">Toasts</div>' },
  EntriesPanel: { template: '<div class="entries-panel">Entries</div>' },
  SignalsPanel: { template: '<div class="signals-panel">Signals</div>' }
}))

/**
 * Create a mock DebugBridge for testing
 */
function createMockBridge(options = {}) {
  const enabled = ref(options.enabled ?? true)
  const tick = ref(0)
  const collectors = reactive(new Map())

  return {
    enabled,
    tick,
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
    getTotalBadge: vi.fn((countAll = false) => {
      let total = 0
      for (const collector of collectors.values()) {
        total += collector.getBadge(countAll)
      }
      return total
    }),
    notify: vi.fn(() => {
      tick.value++
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
    records: true,
    enabled: true,
    getBadge: vi.fn(function() { return this.entries.length }),
    getTotalCount: vi.fn(function() { return this.entries.length }),
    getEntries: vi.fn(function() { return this.entries }),
    clear: vi.fn(function() { this.entries = [] }),
    markAsSeen: vi.fn(),
    toggle: vi.fn(function() { this.enabled = !this.enabled })
  }
}

describe('DebugBar', () => {
  let bridge

  beforeEach(() => {
    bridge = createMockBridge()
    // Clear localStorage to avoid persisted state affecting tests
    localStorage.removeItem('qdadm-debug-bar')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('minimized state', () => {
    it('renders minimized button by default', () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      expect(wrapper.find('.debug-minimized').exists()).toBe(true)
      expect(wrapper.find('.debug-panel').exists()).toBe(false)
    })

    it('shows QD logo in minimized state', () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      expect(wrapper.find('.debug-minimized svg').exists()).toBe(true)
    })

    it('expands when minimized button is clicked', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      expect(wrapper.find('.debug-minimized').exists()).toBe(false)
      expect(wrapper.find('.debug-panel').exists()).toBe(true)
    })

    it('applies custom zIndex to minimized button', () => {
      const wrapper = mount(DebugBar, {
        props: { bridge, zIndex: 5000 },
        global: { stubs: { Teleport: true } }
      })

      expect(wrapper.find('.debug-minimized').attributes('style')).toContain('z-index: 5000')
    })
  })

  describe('expanded panel', () => {
    it('renders panel header when expanded', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      expect(wrapper.find('.debug-header').exists()).toBe(true)
      expect(wrapper.find('.debug-title').exists()).toBe(true)
    })

    it('shows Debug label in title', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      expect(wrapper.find('.debug-title').text()).toContain('Debug')
    })

    it('applies custom zIndex to panel', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge, zIndex: 5000 },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      expect(wrapper.find('.debug-panel').attributes('style')).toContain('z-index: 5000')
    })
  })

  describe('minimize from panel', () => {
    it('minimizes when minimize button is clicked', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      // Expand first
      await wrapper.find('.debug-minimized').trigger('click')
      expect(wrapper.find('.debug-panel').exists()).toBe(true)

      // Click minimize button
      const minimizeBtn = wrapper.find('[title="Minimize"]')
      await minimizeBtn.trigger('click')

      expect(wrapper.find('.debug-minimized').exists()).toBe(true)
      expect(wrapper.find('.debug-panel').exists()).toBe(false)
    })
  })

  describe('collectors display', () => {
    it('shows tabs for each collector', async () => {
      bridge.addCollector(createMockCollector('errors'))
      bridge.addCollector(createMockCollector('signals'))

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const tabs = wrapper.findAll('.debug-tab')
      expect(tabs.length).toBe(2)
    })

    it('shows entry count badge for collectors with entries', async () => {
      const collector = createMockCollector('errors', [
        { message: 'Error 1', timestamp: Date.now() },
        { message: 'Error 2', timestamp: Date.now() }
      ])
      bridge.addCollector(collector)

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const badge = wrapper.find('.debug-tab .p-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.attributes('data-value')).toBe('2')
    })

    it('shows content area when expanded with collectors', async () => {
      bridge.addCollector(createMockCollector('errors', [{ message: 'Test' }]))

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      expect(wrapper.find('.debug-content').exists()).toBe(true)
    })
  })

  describe('enable/disable toggle', () => {
    it('shows pause button when enabled', async () => {
      bridge.enabled.value = true

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const toggleBtn = wrapper.find('[title="Pause"]')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.attributes('data-icon')).toBe('pi pi-pause')
    })

    it('shows play button when disabled', async () => {
      bridge.enabled.value = false

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const toggleBtn = wrapper.find('[title="Resume"]')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.attributes('data-icon')).toBe('pi pi-play')
    })

    it('calls bridge.toggle when toggle button clicked', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const toggleBtn = wrapper.find('[title="Pause"]')
      await toggleBtn.trigger('click')

      expect(bridge.toggle).toHaveBeenCalled()
    })
  })

  describe('clear functionality', () => {
    it('calls bridge.clearAll when clear button clicked', async () => {
      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const clearBtn = wrapper.find('[title="Clear all"]')
      await clearBtn.trigger('click')

      expect(bridge.clearAll).toHaveBeenCalled()
    })
  })

  describe('collector icons', () => {
    it('shows correct icon for errors collector', async () => {
      bridge.addCollector(createMockCollector('errors'))

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const tab = wrapper.find('.debug-tab')
      expect(tab.find('.pi-exclamation-triangle').exists()).toBe(true)
    })

    it('shows correct icon for signals collector', async () => {
      bridge.addCollector(createMockCollector('signals'))

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const tab = wrapper.find('.debug-tab')
      expect(tab.find('.pi-bolt').exists()).toBe(true)
    })

    it('shows correct icon for toasts collector', async () => {
      bridge.addCollector(createMockCollector('toasts'))

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      await wrapper.find('.debug-minimized').trigger('click')

      const tab = wrapper.find('.debug-tab')
      expect(tab.find('.pi-bell').exists()).toBe(true)
    })
  })

  describe('minimized badges', () => {
    it('shows error badge on minimized button when errors exist', () => {
      const collector = createMockCollector('errors', [{ message: 'Error' }])
      bridge.addCollector(collector)

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      const errorBadge = wrapper.find('.debug-badge-error')
      expect(errorBadge.exists()).toBe(true)
    })

    it('shows signal badge on minimized button when signals exist', () => {
      const collector = createMockCollector('signals', [{ signal: 'test' }])
      bridge.addCollector(collector)

      const wrapper = mount(DebugBar, {
        props: { bridge },
        global: { stubs: { Teleport: true } }
      })

      const signalBadge = wrapper.find('.debug-badge-signal')
      expect(signalBadge.exists()).toBe(true)
    })
  })
})
