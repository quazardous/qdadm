/**
 * Unit tests for AppLayout — View↔Edit mode toggle in the INLINE breadcrumb
 * (#1341: the #1332 toggle was wired only in DefaultBreadcrumb, leaving
 * `breadcrumbModeToggle` inert for AppLayout consumers).
 *
 * Same rendering contract as DefaultBreadcrumb.test.js: the feature flag
 * gates the affordance, a null toggle renders nothing.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AppLayout from '../../src/components/layout/AppLayout.vue'

const modeLinksRef = ref([])

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/bots/1', name: 'bots-show', params: {}, query: {} }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a class="router-link"><slot /></a>',
  },
  RouterView: { name: 'RouterView', template: '<div class="router-view" />' },
}))

vi.mock('../../src/composables/useNavigation', () => ({
  useNavigation: () => ({
    navSections: ref([]),
    isNavActive: () => false,
    sectionHasActiveItem: () => false,
    handleNavClick: vi.fn(),
  }),
}))

vi.mock('../../src/composables/useNavContext', () => ({
  useNavContext: () => ({
    breadcrumb: ref([{ label: 'Bots', to: { name: 'bots' } }, { label: 'Bot 1' }]),
    navlinks: ref([]),
    modeLinks: modeLinksRef,
  }),
}))

vi.mock('../../src/composables/useApp', () => ({
  useApp: () => ({ name: 'Test', shortName: 'T', version: '0.0.0', logo: null }),
}))

vi.mock('../../src/composables/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: ref(false),
    user: ref(null),
    logout: vi.fn(),
    authEnabled: false,
  }),
}))

vi.mock('../../src/composables/useGuardStore', () => ({
  useGuardDialog: () => null,
}))

vi.mock('primevue/breadcrumb', () => ({
  default: {
    name: 'Breadcrumb',
    props: ['model'],
    template: '<nav class="mock-breadcrumb"></nav>',
  },
}))

vi.mock('primevue/button', () => ({
  default: { name: 'Button', template: '<button><slot /></button>' },
}))

function mountLayout({ features } = {}) {
  return mount(AppLayout, {
    global: {
      provide: features === undefined ? {} : { qdadmFeatures: features },
      stubs: {
        UnsavedChangesDialog: true,
        SidebarBox: true,
        Zone: true,
      },
    },
  })
}

describe('AppLayout inline breadcrumb mode links (#1341/#1353)', () => {
  it('renders the toggle in the right-side navlinks block, no icon (#ctgnc4)', () => {
    modeLinksRef.value = [
      { current: 'show', target: 'edit', to: { name: 'bots-edit', params: { id: '1' } }, label: 'Edit' },
    ]
    const wrapper = mountLayout({
      features: { breadcrumb: true, breadcrumbModeToggle: true },
    })

    const toggle = wrapper.find('.layout-navlinks .breadcrumb-mode-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toBe('Edit')
    expect(toggle.classes()).toContain('layout-navlink')
    expect(toggle.find('i').exists()).toBe(false)
  })

  it('renders the parent View|Edit pair on child pages (#1353)', () => {
    modeLinksRef.value = [
      { target: 'show', to: { name: 'book-show', params: { bookId: '1' } }, label: 'View' },
      { target: 'edit', to: { name: 'book-edit', params: { bookId: '1' } }, label: 'Edit' },
    ]
    const wrapper = mountLayout({
      features: { breadcrumb: true, breadcrumbModeToggle: true },
    })

    const links = wrapper.findAll('.layout-navlinks .breadcrumb-mode-toggle')
    expect(links.map((l) => l.text())).toEqual(['View', 'Edit'])
    // pipe separator between the two entries
    expect(wrapper.findAll('.layout-navlinks .layout-navlinks-separator')).toHaveLength(1)
  })

  it('renders nothing without the opt-in flag (default features)', () => {
    modeLinksRef.value = [
      { current: 'show', target: 'edit', to: { name: 'bots-edit', params: { id: '1' } }, label: 'Edit' },
    ]
    const wrapper = mountLayout()

    expect(wrapper.find('.breadcrumb-mode-toggle').exists()).toBe(false)
    // The inline breadcrumb itself still renders — the toggle is the only delta
    expect(wrapper.find('.mock-breadcrumb').exists()).toBe(true)
  })

  it('renders nothing when no link resolves even with the feature on', () => {
    modeLinksRef.value = []
    const wrapper = mountLayout({
      features: { breadcrumb: true, breadcrumbModeToggle: true },
    })

    expect(wrapper.find('.breadcrumb-mode-toggle').exists()).toBe(false)
  })
})
