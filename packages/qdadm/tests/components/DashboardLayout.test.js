/**
 * Unit tests for DashboardLayout component
 *
 * Tests cover:
 * - Rendering dashboard-specific zones (stats, widgets, recent-activity)
 * - Zone rendering from registry
 * - Slot overrides for zones
 * - Empty zones render nothing
 * - Integration with BaseLayout
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import DashboardLayout from '../../src/components/layout/DashboardLayout.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry.js'
import { registerStandardZones, DASHBOARD_ZONES } from '../../src/zones/zones.js'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useRoute: () => ({
    path: '/',
    name: 'dashboard',
    params: {},
    query: {}
  }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a class="router-link"><slot /></a>'
  },
  RouterView: {
    name: 'RouterView',
    template: '<div class="router-view">Router View Content</div>'
  }
}))

// Mock composables
vi.mock('../../src/composables/useNavigation', () => ({
  useNavigation: () => ({
    navSections: ref([]),
    isNavActive: () => false,
    sectionHasActiveItem: () => false,
    handleNavClick: vi.fn()
  })
}))

vi.mock('../../src/composables/useNavContext', () => ({
  useNavContext: () => ({
    breadcrumb: ref([]),
    navlinks: ref([])
  })
}))

vi.mock('../../src/composables/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: ref(false),
    user: ref(null),
    logout: vi.fn(),
    authEnabled: false
  })
}))

vi.mock('../../src/composables/useGuardStore', () => ({
  useGuardDialog: () => null
}))

// Mock PrimeVue components
vi.mock('primevue/toast', () => ({
  default: {
    name: 'Toast',
    template: '<div class="mock-toast"></div>'
  }
}))

vi.mock('primevue/breadcrumb', () => ({
  default: {
    name: 'Breadcrumb',
    props: ['model'],
    template: '<nav class="mock-breadcrumb"><slot name="item" /></nav>'
  }
}))

vi.mock('primevue/confirmdialog', () => ({
  default: {
    name: 'ConfirmDialog',
    template: '<div class="mock-confirm-dialog"></div>'
  }
}))

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    props: ['icon', 'severity', 'text', 'rounded'],
    template: '<button class="mock-button"><slot /></button>'
  }
}))

// Mock internal dialog
vi.mock('../../src/components/dialogs/UnsavedChangesDialog.vue', () => ({
  default: {
    name: 'UnsavedChangesDialog',
    template: '<div class="mock-unsaved-changes-dialog"></div>'
  }
}))

// Mock components for testing
const StatsWidget = defineComponent({
  name: 'StatsWidget',
  template: '<div class="stats-widget">Stats Widget</div>'
})

const DashboardWidget = defineComponent({
  name: 'DashboardWidget',
  props: ['title'],
  template: '<div class="dashboard-widget">{{ title || "Widget" }}</div>'
})

const ActivityLog = defineComponent({
  name: 'ActivityLog',
  template: '<div class="activity-log">Recent Activity</div>'
})

describe('DashboardLayout', () => {
  let registry

  beforeEach(() => {
    registry = new ZoneRegistry()
    registerStandardZones(registry)
  })

  /**
   * Helper to mount DashboardLayout with mocked dependencies
   */
  function mountDashboardLayout(options = {}) {
    return mount(DashboardLayout, {
      global: {
        provide: {
          qdadmZoneRegistry: registry,
          qdadmApp: { name: 'Test App', shortName: 'test', version: '1.0.0' },
          qdadmFeatures: { poweredBy: false, breadcrumb: false }
        },
        stubs: {
          RouterLink: true,
          RouterView: true
        }
      },
      ...options
    })
  }

  describe('layout structure', () => {
    it('renders the dashboard layout structure', () => {
      const wrapper = mountDashboardLayout()

      expect(wrapper.find('.dashboard-layout').exists()).toBe(true)
      expect(wrapper.find('.dashboard-stats').exists()).toBe(true)
      expect(wrapper.find('.dashboard-widgets').exists()).toBe(true)
      expect(wrapper.find('.dashboard-recent-activity').exists()).toBe(true)
    })

    it('extends BaseLayout', () => {
      const wrapper = mountDashboardLayout()

      // BaseLayout structure should be present
      expect(wrapper.find('.base-layout').exists()).toBe(true)
      expect(wrapper.find('.sidebar').exists()).toBe(true)
      expect(wrapper.find('.main-area').exists()).toBe(true)
    })

    it('renders dashboard content in BaseLayout main zone', () => {
      const wrapper = mountDashboardLayout()

      // Dashboard layout should be inside main-content
      expect(wrapper.find('.main-content .dashboard-layout').exists()).toBe(true)
    })
  })

  describe('zone rendering', () => {
    it('renders blocks registered in stats zone', () => {
      registry.registerBlock(DASHBOARD_ZONES.STATS, {
        component: StatsWidget,
        id: 'stats-widget'
      })

      const wrapper = mountDashboardLayout()

      expect(wrapper.find('.stats-widget').exists()).toBe(true)
      expect(wrapper.text()).toContain('Stats Widget')
    })

    it('renders blocks registered in widgets zone', () => {
      registry.registerBlock(DASHBOARD_ZONES.WIDGETS, {
        component: DashboardWidget,
        id: 'main-widget',
        props: { title: 'Main Dashboard Widget' }
      })

      const wrapper = mountDashboardLayout()

      expect(wrapper.find('.dashboard-widget').exists()).toBe(true)
      expect(wrapper.text()).toContain('Main Dashboard Widget')
    })

    it('renders blocks registered in recent-activity zone', () => {
      registry.registerBlock(DASHBOARD_ZONES.RECENT_ACTIVITY, {
        component: ActivityLog,
        id: 'activity-log'
      })

      const wrapper = mountDashboardLayout()

      expect(wrapper.find('.activity-log').exists()).toBe(true)
      expect(wrapper.text()).toContain('Recent Activity')
    })

    it('renders multiple blocks in order by weight', () => {
      registry.registerBlock(DASHBOARD_ZONES.WIDGETS, {
        component: DashboardWidget,
        id: 'widget-b',
        weight: 20,
        props: { title: 'Widget B' }
      })
      registry.registerBlock(DASHBOARD_ZONES.WIDGETS, {
        component: DashboardWidget,
        id: 'widget-a',
        weight: 10,
        props: { title: 'Widget A' }
      })

      const wrapper = mountDashboardLayout()

      const widgets = wrapper.findAll('.dashboard-widget')
      expect(widgets).toHaveLength(2)
      expect(widgets[0].text()).toBe('Widget A')
      expect(widgets[1].text()).toBe('Widget B')
    })
  })

  describe('empty zones', () => {
    it('empty zones render nothing (no default content)', () => {
      // No blocks registered in any zone
      const wrapper = mountDashboardLayout()

      // Zones exist but are empty (Zone renders nothing)
      expect(wrapper.find('.dashboard-stats').exists()).toBe(true)
      expect(wrapper.find('.dashboard-widgets').exists()).toBe(true)
      expect(wrapper.find('.dashboard-recent-activity').exists()).toBe(true)

      // Check that Zone rendered empty comment nodes
      const statsZone = wrapper.find('.dashboard-stats')
      expect(statsZone.text()).toBe('')
    })
  })

  describe('slot overrides', () => {
    it('renders stats slot content when provided', () => {
      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="custom-stats">Custom Stats</div>'
      })

      const wrapper = mount(DashboardLayout, {
        global: {
          provide: {
            qdadmZoneRegistry: registry,
            qdadmApp: { name: 'Test', shortName: 'test' },
            qdadmFeatures: { poweredBy: false, breadcrumb: false }
          },
          stubs: {
            RouterLink: true,
            RouterView: true
          }
        },
        slots: {
          stats: SlotContent
        }
      })

      expect(wrapper.find('.custom-stats').exists()).toBe(true)
      expect(wrapper.text()).toContain('Custom Stats')
    })

    it('renders widgets slot content when provided', () => {
      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="custom-widgets">Custom Widgets</div>'
      })

      const wrapper = mount(DashboardLayout, {
        global: {
          provide: {
            qdadmZoneRegistry: registry,
            qdadmApp: { name: 'Test', shortName: 'test' },
            qdadmFeatures: { poweredBy: false, breadcrumb: false }
          },
          stubs: {
            RouterLink: true,
            RouterView: true
          }
        },
        slots: {
          widgets: SlotContent
        }
      })

      expect(wrapper.find('.custom-widgets').exists()).toBe(true)
    })

    it('renders recent-activity slot content when provided', () => {
      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="custom-activity">Custom Activity</div>'
      })

      const wrapper = mount(DashboardLayout, {
        global: {
          provide: {
            qdadmZoneRegistry: registry,
            qdadmApp: { name: 'Test', shortName: 'test' },
            qdadmFeatures: { poweredBy: false, breadcrumb: false }
          },
          stubs: {
            RouterLink: true,
            RouterView: true
          }
        },
        slots: {
          'recent-activity': SlotContent
        }
      })

      expect(wrapper.find('.custom-activity').exists()).toBe(true)
    })

    it('slot content takes precedence over registered blocks', () => {
      registry.registerBlock(DASHBOARD_ZONES.STATS, {
        component: StatsWidget,
        id: 'stats-widget'
      })

      const SlotContent = defineComponent({
        name: 'SlotContent',
        template: '<div class="slot-stats">Slot Stats</div>'
      })

      const wrapper = mount(DashboardLayout, {
        global: {
          provide: {
            qdadmZoneRegistry: registry,
            qdadmApp: { name: 'Test', shortName: 'test' },
            qdadmFeatures: { poweredBy: false, breadcrumb: false }
          },
          stubs: {
            RouterLink: true,
            RouterView: true
          }
        },
        slots: {
          stats: SlotContent
        }
      })

      expect(wrapper.find('.slot-stats').exists()).toBe(true)
      expect(wrapper.find('.stats-widget').exists()).toBe(false)
    })
  })

  describe('zone constants', () => {
    it('uses DASHBOARD_ZONES constants', () => {
      expect(DASHBOARD_ZONES.STATS).toBe('dashboard-stats')
      expect(DASHBOARD_ZONES.WIDGETS).toBe('dashboard-widgets')
      expect(DASHBOARD_ZONES.RECENT_ACTIVITY).toBe('dashboard-recent-activity')
    })

    it('dashboard zones are registered by registerStandardZones', () => {
      // These should not throw
      expect(() => registry.getBlocks(DASHBOARD_ZONES.STATS)).not.toThrow()
      expect(() => registry.getBlocks(DASHBOARD_ZONES.WIDGETS)).not.toThrow()
      expect(() => registry.getBlocks(DASHBOARD_ZONES.RECENT_ACTIVITY)).not.toThrow()
    })
  })
})
