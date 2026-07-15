/**
 * Unit tests for DefaultBreadcrumb — View↔Edit mode toggle rendering (#1332)
 *
 * The mechanism (twin route, permission, labels) is tested on
 * useNavContext.modeToggle; here we test the opt-in rendering contract:
 * qdadmFeatures.breadcrumbModeToggle gates the affordance, and a null
 * toggle renders nothing even when the feature is on.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DefaultBreadcrumb from '../../src/components/layout/defaults/DefaultBreadcrumb.vue'

const modeToggleRef = ref(null)

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/bots/1', name: 'bots-show', params: {}, query: {} }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a class="router-link"><slot /></a>',
  },
}))

vi.mock('../../src/composables/useNavContext', () => ({
  useNavContext: () => ({
    breadcrumb: ref([{ label: 'Bots', to: { name: 'bots' } }, { label: 'Bot 1' }]),
    navlinks: ref([]),
    modeToggle: modeToggleRef,
  }),
}))

vi.mock('primevue/breadcrumb', () => ({
  default: {
    name: 'Breadcrumb',
    props: ['model'],
    template: '<nav class="mock-breadcrumb"></nav>',
  },
}))

function mountBreadcrumb({ features } = {}) {
  return mount(DefaultBreadcrumb, {
    global: {
      provide: features === undefined ? {} : { qdadmFeatures: features },
    },
  })
}

describe('DefaultBreadcrumb mode toggle (#1332)', () => {
  it('renders the toggle in the right-side navlinks block, no icon (#ctgnc4)', () => {
    modeToggleRef.value = {
      current: 'show',
      target: 'edit',
      to: { name: 'bots-edit', params: { id: '1' } },
      label: 'Edit',
    }
    const wrapper = mountBreadcrumb({
      features: { breadcrumb: true, breadcrumbModeToggle: true },
    })

    const toggle = wrapper.find('.breadcrumb-navlinks .breadcrumb-mode-toggle')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toBe('Edit')
    expect(toggle.classes()).toContain('navlink')
    expect(toggle.find('i').exists()).toBe(false)
  })

  it('renders nothing without the opt-in flag (default features)', () => {
    modeToggleRef.value = {
      current: 'show',
      target: 'edit',
      to: { name: 'bots-edit', params: { id: '1' } },
      label: 'Edit',
    }
    const wrapper = mountBreadcrumb()

    expect(wrapper.find('.breadcrumb-mode-toggle').exists()).toBe(false)
    // The breadcrumb itself still renders — the toggle is the only delta
    expect(wrapper.find('.mock-breadcrumb').exists()).toBe(true)
  })

  it('renders nothing when the toggle is null even with the feature on', () => {
    modeToggleRef.value = null
    const wrapper = mountBreadcrumb({
      features: { breadcrumb: true, breadcrumbModeToggle: true },
    })

    expect(wrapper.find('.breadcrumb-mode-toggle').exists()).toBe(false)
  })

  it('renders the View direction as a plain text link', () => {
    modeToggleRef.value = {
      current: 'edit',
      target: 'show',
      to: { name: 'bots-show', params: { id: '1' } },
      label: 'View',
    }
    const wrapper = mountBreadcrumb({
      features: { breadcrumb: true, breadcrumbModeToggle: true },
    })

    const toggle = wrapper.find('.breadcrumb-mode-toggle')
    expect(toggle.text()).toBe('View')
    expect(toggle.find('i').exists()).toBe(false)
  })
})
