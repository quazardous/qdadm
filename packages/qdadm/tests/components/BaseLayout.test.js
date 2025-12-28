/**
 * Unit tests for BaseLayout component
 *
 * Tests cover:
 * - Rendering all standard zones
 * - Default components for zones
 * - Slot override for main zone
 * - Zone component integration
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent, ref } from 'vue'
import BaseLayout from '../../src/components/layout/BaseLayout.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry.js'
import { registerStandardZones } from '../../src/zones/zones.js'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useRoute: () => ({
    path: '/test',
    name: 'test',
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

// Mock composables that use vue-router
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
const MockComponent = defineComponent({
  name: 'MockComponent',
  props: ['content'],
  template: '<div class="mock-component">{{ content || "Mock" }}</div>'
})

const MockPageContent = defineComponent({
  name: 'MockPageContent',
  template: '<div class="page-content">Page Content</div>'
})

describe('BaseLayout', () => {
  let registry

  beforeEach(() => {
    registry = new ZoneRegistry()
    registerStandardZones(registry)
  })

  /**
   * Helper to mount BaseLayout with mocked dependencies
   */
  function mountBaseLayout(options = {}) {
    return mount(BaseLayout, {
      global: {
        provide: {
          qdadmZoneRegistry: registry,
          qdadmApp: { name: 'Test App', shortName: 'test', version: '1.0.0' },
          qdadmFeatures: { poweredBy: true, breadcrumb: true }
        },
        stubs: {
          RouterLink: true,
          RouterView: {
            template: '<div class="router-view">Router View Content</div>'
          }
        }
      },
      ...options
    })
  }

  describe('zone structure', () => {
    it('renders the base layout structure', () => {
      const wrapper = mountBaseLayout()

      expect(wrapper.find('.base-layout').exists()).toBe(true)
      expect(wrapper.find('.sidebar').exists()).toBe(true)
      expect(wrapper.find('.main-area').exists()).toBe(true)
      expect(wrapper.find('.main-content').exists()).toBe(true)
    })

    it('renders sidebar with correct structure', () => {
      const wrapper = mountBaseLayout()

      const sidebar = wrapper.find('.sidebar')
      expect(sidebar.exists()).toBe(true)
    })
  })

  describe('zone rendering', () => {
    it('uses Zone component for standard zones', () => {
      const wrapper = mountBaseLayout()

      // The wrapper should contain the main content structure
      expect(wrapper.find('.main-content').exists()).toBe(true)
    })

    it('renders default header component when no blocks registered', () => {
      const wrapper = mountBaseLayout()

      // Default header should show app name
      expect(wrapper.html()).toContain('Test App')
    })

    it('renders custom blocks when registered in zone', () => {
      registry.registerBlock('header', {
        component: MockComponent,
        id: 'custom-header',
        props: { content: 'Custom Header' }
      })

      const wrapper = mountBaseLayout()

      expect(wrapper.text()).toContain('Custom Header')
    })
  })

  describe('main zone slot', () => {
    it('renders slot content in main zone when provided', () => {
      const wrapper = mount(BaseLayout, {
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
          main: MockPageContent
        }
      })

      expect(wrapper.find('.page-content').exists()).toBe(true)
      expect(wrapper.text()).toContain('Page Content')
    })

    it('renders RouterView in main zone when no slot provided', () => {
      const wrapper = mountBaseLayout()

      expect(wrapper.find('.router-view').exists()).toBe(true)
    })
  })

  describe('zone blocks override defaults', () => {
    it('renders registered blocks instead of default components', () => {
      const CustomFooter = defineComponent({
        name: 'CustomFooter',
        template: '<div class="custom-footer">Custom Footer Content</div>'
      })

      registry.registerBlock('footer', {
        component: CustomFooter,
        id: 'custom-footer'
      })

      const wrapper = mountBaseLayout()

      expect(wrapper.find('.custom-footer').exists()).toBe(true)
      expect(wrapper.text()).toContain('Custom Footer Content')
    })
  })

  describe('dialogs', () => {
    it('renders ConfirmDialog for global confirmations', () => {
      const wrapper = mountBaseLayout()

      expect(wrapper.find('.mock-confirm-dialog').exists()).toBe(true)
    })
  })

  describe('content-with-sidebar', () => {
    it('has content-with-sidebar container for sidebar zone support', () => {
      const wrapper = mountBaseLayout()

      expect(wrapper.find('.content-with-sidebar').exists()).toBe(true)
    })
  })
})
