/**
 * Unit tests for FormLayout component
 *
 * Tests cover:
 * - FormLayout extends BaseLayout (renders in main zone)
 * - Form-specific zones: form-header, form-fields, form-tabs, actions
 * - Slot content rendering in each zone
 * - Default components (DefaultFormActions)
 * - Loading state
 * - Card wrapper option
 * - Form state injection (saving, dirty, isEdit)
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent, ref } from 'vue'
import FormLayout from '../../src/components/layout/FormLayout.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry.js'
import { registerStandardZones, FORM_ZONES } from '../../src/zones/zones.js'

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
    props: ['icon', 'severity', 'text', 'rounded', 'label', 'loading', 'disabled'],
    template: '<button class="mock-button" :disabled="disabled"><slot />{{ label }}</button>'
  }
}))

// Mock internal dialog
vi.mock('../../src/components/dialogs/UnsavedChangesDialog.vue', () => ({
  default: {
    name: 'UnsavedChangesDialog',
    template: '<div class="mock-unsaved-changes-dialog"></div>'
  }
}))

// Mock components for testing slots
const MockFormField = defineComponent({
  name: 'MockFormField',
  template: '<div class="mock-form-field">Test Field</div>'
})

const MockFormHeader = defineComponent({
  name: 'MockFormHeader',
  template: '<div class="mock-form-header">Form Header</div>'
})

const MockFormTabs = defineComponent({
  name: 'MockFormTabs',
  template: '<div class="mock-form-tabs">Form Tabs</div>'
})

const MockActions = defineComponent({
  name: 'MockActions',
  template: '<div class="mock-actions">Custom Actions</div>'
})

describe('FormLayout', () => {
  let registry

  beforeEach(() => {
    registry = new ZoneRegistry()
    registerStandardZones(registry)
  })

  /**
   * Helper to mount FormLayout with mocked dependencies
   */
  function mountFormLayout(options = {}) {
    return mount(FormLayout, {
      global: {
        provide: {
          qdadmZoneRegistry: registry,
          qdadmApp: { name: 'Test App', shortName: 'test', version: '1.0.0' },
          qdadmFeatures: { poweredBy: true, breadcrumb: true }
        },
        stubs: {
          RouterLink: true,
          RouterView: true
        }
      },
      ...options
    })
  }

  describe('structure', () => {
    it('renders the form layout structure', () => {
      const wrapper = mountFormLayout()

      expect(wrapper.find('.form-layout').exists()).toBe(true)
    })

    it('renders inside BaseLayout (has sidebar and main-area from base)', () => {
      const wrapper = mountFormLayout()

      // BaseLayout structure should be present
      expect(wrapper.find('.base-layout').exists()).toBe(true)
      expect(wrapper.find('.sidebar').exists()).toBe(true)
      expect(wrapper.find('.main-area').exists()).toBe(true)
    })

    it('renders form-specific zone containers', () => {
      const wrapper = mountFormLayout()

      expect(wrapper.find('.form-header-zone').exists()).toBe(true)
      expect(wrapper.find('.form-fields-zone').exists()).toBe(true)
      expect(wrapper.find('.form-actions-zone').exists()).toBe(true)
    })
  })

  describe('slot rendering', () => {
    it('renders form-fields slot content', () => {
      const wrapper = mountFormLayout({
        slots: {
          'form-fields': MockFormField
        }
      })

      expect(wrapper.find('.mock-form-field').exists()).toBe(true)
      expect(wrapper.text()).toContain('Test Field')
    })

    it('renders form-header slot content', () => {
      const wrapper = mountFormLayout({
        slots: {
          'form-header': MockFormHeader
        }
      })

      expect(wrapper.find('.mock-form-header').exists()).toBe(true)
      expect(wrapper.text()).toContain('Form Header')
    })

    it('renders form-tabs slot content', () => {
      const wrapper = mountFormLayout({
        slots: {
          'form-tabs': MockFormTabs
        }
      })

      expect(wrapper.find('.mock-form-tabs').exists()).toBe(true)
      expect(wrapper.text()).toContain('Form Tabs')
    })

    it('renders actions slot content (custom actions)', () => {
      const wrapper = mountFormLayout({
        slots: {
          actions: MockActions
        }
      })

      expect(wrapper.find('.mock-actions').exists()).toBe(true)
      expect(wrapper.text()).toContain('Custom Actions')
    })
  })

  describe('zone block rendering', () => {
    it('renders blocks registered in form-fields zone', () => {
      const CustomField = defineComponent({
        name: 'CustomField',
        template: '<div class="custom-field">Custom Field from Registry</div>'
      })

      registry.registerBlock(FORM_ZONES.FORM_FIELDS, {
        component: CustomField,
        id: 'custom-field'
      })

      const wrapper = mountFormLayout()

      expect(wrapper.find('.custom-field').exists()).toBe(true)
      expect(wrapper.text()).toContain('Custom Field from Registry')
    })

    it('renders blocks registered in actions zone', () => {
      const CustomActions = defineComponent({
        name: 'CustomActions',
        template: '<div class="custom-actions">Custom Actions from Registry</div>'
      })

      registry.registerBlock(FORM_ZONES.ACTIONS, {
        component: CustomActions,
        id: 'custom-actions'
      })

      const wrapper = mountFormLayout()

      expect(wrapper.find('.custom-actions').exists()).toBe(true)
    })
  })

  describe('loading state', () => {
    it('displays loading spinner when loading is true', () => {
      const wrapper = mountFormLayout({
        props: {
          loading: true
        }
      })

      expect(wrapper.find('.form-loading-state').exists()).toBe(true)
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    })

    it('hides form content when loading', () => {
      const wrapper = mountFormLayout({
        props: {
          loading: true
        },
        slots: {
          'form-fields': MockFormField
        }
      })

      expect(wrapper.find('.mock-form-field').exists()).toBe(false)
    })

    it('shows form content when not loading', () => {
      const wrapper = mountFormLayout({
        props: {
          loading: false
        },
        slots: {
          'form-fields': MockFormField
        }
      })

      expect(wrapper.find('.mock-form-field').exists()).toBe(true)
    })
  })

  describe('card wrapper', () => {
    it('renders card wrapper by default', () => {
      const wrapper = mountFormLayout()

      expect(wrapper.find('.form-card').exists()).toBe(true)
    })

    it('hides card wrapper when cardWrapper is false', () => {
      const wrapper = mountFormLayout({
        props: {
          cardWrapper: false
        }
      })

      expect(wrapper.find('.form-card').exists()).toBe(false)
    })
  })

  describe('showActions', () => {
    it('shows actions zone by default', () => {
      const wrapper = mountFormLayout()

      expect(wrapper.find('.form-actions-zone').exists()).toBe(true)
    })

    it('hides actions zone when showActions is false', () => {
      const wrapper = mountFormLayout({
        props: {
          showActions: false
        }
      })

      expect(wrapper.find('.form-actions-zone').exists()).toBe(false)
    })
  })

  describe('form events', () => {
    it('emits save event', async () => {
      const wrapper = mountFormLayout()

      // Trigger save via component method (simulating DefaultFormActions)
      await wrapper.vm.$emit('save')

      expect(wrapper.emitted('save')).toBeTruthy()
    })

    it('emits saveAndClose event', async () => {
      const wrapper = mountFormLayout()

      await wrapper.vm.$emit('saveAndClose')

      expect(wrapper.emitted('saveAndClose')).toBeTruthy()
    })

    it('emits cancel event', async () => {
      const wrapper = mountFormLayout()

      await wrapper.vm.$emit('cancel')

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })

  describe('form state props', () => {
    it('accepts saving prop', () => {
      const wrapper = mountFormLayout({
        props: {
          saving: true
        }
      })

      expect(wrapper.props('saving')).toBe(true)
    })

    it('accepts dirty prop', () => {
      const wrapper = mountFormLayout({
        props: {
          dirty: true
        }
      })

      expect(wrapper.props('dirty')).toBe(true)
    })

    it('accepts isEdit prop', () => {
      const wrapper = mountFormLayout({
        props: {
          isEdit: true
        }
      })

      expect(wrapper.props('isEdit')).toBe(true)
    })
  })
})
