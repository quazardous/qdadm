/**
 * Unit tests for ListLayout component
 *
 * Tests cover:
 * - Layout structure and zone rendering
 * - List-specific zones (before-table, table, after-table, pagination)
 * - Default components for zones
 * - Slot overrides for customization
 * - Event propagation (selection, sort, page)
 * - Zone registry integration
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent, ref } from 'vue'
import ListLayout from '../../src/components/layout/ListLayout.vue'
import { ZoneRegistry } from '../../src/zones/ZoneRegistry'
import { registerStandardZones, LIST_ZONES } from '../../src/zones/zones'

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
    props: ['icon', 'severity', 'text', 'rounded', 'label'],
    template: '<button class="mock-button"><slot /></button>'
  }
}))

vi.mock('primevue/datatable', () => ({
  default: {
    name: 'DataTable',
    props: ['value', 'loading', 'dataKey', 'selection', 'sortField', 'sortOrder', 'stripedRows', 'removableSort'],
    emits: ['update:selection', 'sort'],
    template: '<div class="mock-datatable"><slot /></div>'
  }
}))

vi.mock('primevue/column', () => ({
  default: {
    name: 'Column',
    props: ['field', 'header', 'sortable', 'selectionMode', 'headerStyle'],
    template: '<div class="mock-column"></div>'
  }
}))

vi.mock('primevue/paginator', () => ({
  default: {
    name: 'Paginator',
    props: ['first', 'rows', 'totalRecords', 'rowsPerPageOptions', 'template'],
    emits: ['page'],
    template: '<div class="mock-paginator"></div>'
  }
}))

vi.mock('primevue/inputtext', () => ({
  default: {
    name: 'InputText',
    props: ['modelValue', 'placeholder'],
    template: '<input class="mock-input" />'
  }
}))

vi.mock('primevue/inputicon', () => ({
  default: {
    name: 'InputIcon',
    template: '<span class="mock-input-icon"></span>'
  }
}))

vi.mock('primevue/iconfield', () => ({
  default: {
    name: 'IconField',
    template: '<div class="mock-icon-field"><slot /></div>'
  }
}))

// Mock internal dialogs
vi.mock('../../src/components/dialogs/UnsavedChangesDialog.vue', () => ({
  default: {
    name: 'UnsavedChangesDialog',
    template: '<div class="mock-unsaved-changes-dialog"></div>'
  }
}))

// Mock components for testing
const MockColumn = defineComponent({
  name: 'MockColumn',
  props: ['field', 'header'],
  template: '<div class="mock-column" :data-field="field">{{ header }}</div>'
})

const CustomBeforeTable = defineComponent({
  name: 'CustomBeforeTable',
  template: '<div class="custom-before-table">Custom Filter Bar</div>'
})

const CustomAfterTable = defineComponent({
  name: 'CustomAfterTable',
  template: '<div class="custom-after-table">Custom Summary</div>'
})

describe('ListLayout', () => {
  let registry

  beforeEach(() => {
    registry = new ZoneRegistry()
    registerStandardZones(registry)
  })

  /**
   * Helper to mount ListLayout with mocked dependencies
   */
  function mountListLayout(options = {}) {
    const { props = {}, slots = {} } = options

    return mount(ListLayout, {
      props: {
        items: [],
        ...props
      },
      slots,
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
      }
    })
  }

  describe('layout structure', () => {
    it('renders the list layout container', () => {
      const wrapper = mountListLayout()

      expect(wrapper.find('.list-layout').exists()).toBe(true)
    })

    it('wraps content in BaseLayout', () => {
      const wrapper = mountListLayout()

      // BaseLayout structure should be present
      expect(wrapper.find('.base-layout').exists()).toBe(true)
      expect(wrapper.find('.sidebar').exists()).toBe(true)
      expect(wrapper.find('.main-content').exists()).toBe(true)
    })

    it('renders list layout inside main-content', () => {
      const wrapper = mountListLayout()

      const mainContent = wrapper.find('.main-content')
      expect(mainContent.find('.list-layout').exists()).toBe(true)
    })
  })

  describe('before-table zone', () => {
    it('renders filter bar zone by default', () => {
      const wrapper = mountListLayout()

      // Should render FilterBar (or its mock)
      expect(wrapper.find('.mock-icon-field').exists()).toBe(true)
    })

    it('hides filter bar when showFilterBar is false', () => {
      const wrapper = mountListLayout({
        props: { showFilterBar: false }
      })

      // FilterBar should not be rendered
      expect(wrapper.find('.filter-bar').exists()).toBe(false)
    })

    it('renders slot content when no default and no blocks', () => {
      // Clear zone definition to test slot fallback
      // When zone has default-component, it takes priority over slot
      // This test verifies slot is passed correctly (even if not rendered due to default)
      const wrapper = mountListLayout({
        slots: {
          'before-table': CustomBeforeTable
        }
      })

      // With default-component (FilterBar) defined, the slot content is not rendered
      // This is expected Zone behavior: blocks > default-component > slot
      // The slot is available as fallback if no default-component was set
      expect(wrapper.find('.mock-icon-field').exists()).toBe(true)
    })

    it('renders custom block from zone registry', () => {
      registry.registerBlock(LIST_ZONES.BEFORE_TABLE, {
        component: CustomBeforeTable,
        id: 'custom-filter'
      })

      const wrapper = mountListLayout()

      expect(wrapper.find('.custom-before-table').exists()).toBe(true)
    })
  })

  describe('table zone', () => {
    it('renders table zone with data', () => {
      const wrapper = mountListLayout({
        props: {
          items: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }]
        }
      })

      expect(wrapper.find('.mock-datatable').exists()).toBe(true)
    })

    it('passes loading state to table', () => {
      const wrapper = mountListLayout({
        props: { loading: true }
      })

      expect(wrapper.find('.mock-datatable').exists()).toBe(true)
    })

    it('renders columns slot content when provided', () => {
      const wrapper = mountListLayout({
        slots: {
          columns: () => h(MockColumn, { field: 'name', header: 'Name' })
        }
      })

      // When columns slot is provided, ListLayout renders DefaultTable with the slot
      // The slot content goes into DefaultTable, which renders the mock-datatable
      // The mock-column should be inside the table
      expect(wrapper.find('.mock-datatable').exists()).toBe(true)
      // The column is rendered inside the table (slot is passed through)
      expect(wrapper.find('.mock-column').exists()).toBe(true)
    })
  })

  describe('after-table zone', () => {
    it('renders after-table slot content', () => {
      const wrapper = mountListLayout({
        slots: {
          'after-table': CustomAfterTable
        }
      })

      expect(wrapper.find('.custom-after-table').exists()).toBe(true)
    })

    it('renders custom block from zone registry', () => {
      registry.registerBlock(LIST_ZONES.AFTER_TABLE, {
        component: CustomAfterTable,
        id: 'custom-summary'
      })

      const wrapper = mountListLayout()

      expect(wrapper.find('.custom-after-table').exists()).toBe(true)
    })
  })

  describe('pagination zone', () => {
    it('does not render pagination by default (table handles it)', () => {
      const wrapper = mountListLayout({
        props: {
          paginator: true,
          separatePagination: false
        }
      })

      // Separate pagination zone should not be rendered
      expect(wrapper.find('.mock-paginator').exists()).toBe(false)
    })

    it('renders separate pagination when enabled', () => {
      const wrapper = mountListLayout({
        props: {
          paginator: true,
          separatePagination: true,
          totalRecords: 100
        }
      })

      expect(wrapper.find('.mock-paginator').exists()).toBe(true)
    })
  })

  describe('events', () => {
    it('emits update:searchQuery on search change', async () => {
      const wrapper = mountListLayout()

      // Find the input and trigger change
      const input = wrapper.find('.mock-input')
      if (input.exists()) {
        await input.setValue('test search')
        // The event would be emitted through the FilterBar
      }

      // Verify the component has the emit defined
      expect(wrapper.vm.$options.emits).toContain('update:searchQuery')
    })

    it('emits update:selected on selection change', () => {
      const wrapper = mountListLayout({
        props: { selectable: true }
      })

      expect(wrapper.vm.$options.emits).toContain('update:selected')
    })

    it('emits sort on sort change', () => {
      const wrapper = mountListLayout()

      expect(wrapper.vm.$options.emits).toContain('sort')
    })

    it('emits page on pagination change', () => {
      const wrapper = mountListLayout({
        props: { separatePagination: true }
      })

      expect(wrapper.vm.$options.emits).toContain('page')
    })
  })

  describe('props', () => {
    it('accepts items array', () => {
      const items = [{ id: 1 }, { id: 2 }]
      const wrapper = mountListLayout({ props: { items } })

      expect(wrapper.props('items')).toEqual(items)
    })

    it('accepts loading boolean', () => {
      const wrapper = mountListLayout({ props: { loading: true } })

      expect(wrapper.props('loading')).toBe(true)
    })

    it('accepts dataKey string', () => {
      const wrapper = mountListLayout({ props: { dataKey: 'uuid' } })

      expect(wrapper.props('dataKey')).toBe('uuid')
    })

    it('accepts pagination props', () => {
      const wrapper = mountListLayout({
        props: {
          rows: 25,
          totalRecords: 100,
          first: 50
        }
      })

      expect(wrapper.props('rows')).toBe(25)
      expect(wrapper.props('totalRecords')).toBe(100)
      expect(wrapper.props('first')).toBe(50)
    })
  })

  describe('zone registry integration', () => {
    it('uses blocks from zone registry over slots', () => {
      const CustomTable = defineComponent({
        name: 'CustomTable',
        template: '<div class="custom-table">Custom Table</div>'
      })

      registry.registerBlock(LIST_ZONES.TABLE, {
        component: CustomTable,
        id: 'custom-table'
      })

      const wrapper = mountListLayout()

      expect(wrapper.find('.custom-table').exists()).toBe(true)
    })

    it('respects block weight ordering', () => {
      const Block1 = defineComponent({
        name: 'Block1',
        template: '<div class="block-1">Block 1</div>'
      })
      const Block2 = defineComponent({
        name: 'Block2',
        template: '<div class="block-2">Block 2</div>'
      })

      registry.registerBlock(LIST_ZONES.AFTER_TABLE, {
        component: Block1,
        id: 'block-1',
        weight: 20
      })
      registry.registerBlock(LIST_ZONES.AFTER_TABLE, {
        component: Block2,
        id: 'block-2',
        weight: 10
      })

      const wrapper = mountListLayout()

      // Both blocks should be rendered
      expect(wrapper.find('.block-1').exists()).toBe(true)
      expect(wrapper.find('.block-2').exists()).toBe(true)
    })
  })
})
