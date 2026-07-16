/**
 * Unit tests for NavlinksGroup (#1357)
 *
 * The shared right-side breadcrumb group: mode links lead, sibling navlinks
 * follow, and a navlink whose target route is already covered by a shown
 * mode link is deduped (the auto "Details" link resolves to the parent's
 * edit route and rendered twice as "Details" + "Edit").
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import NavlinksGroup from '../../src/components/layout/NavlinksGroup.vue'

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a class="router-link"><slot /></a>',
  },
}))

const MODE_LINKS = [
  { target: 'show', to: { name: 'genres-show', params: { id: 'fiction' } }, label: 'View' },
  { target: 'edit', to: { name: 'genres-edit', params: { id: 'fiction' } }, label: 'Edit' },
]

const NAVLINKS = [
  // the auto "Details" link — same route as the Edit mode link
  { label: 'Details', to: { name: 'genres-edit', params: { id: 'fiction' } }, active: false },
  { label: 'Books', to: { name: 'genre-books', params: { id: 'fiction' } }, active: true },
]

function mountGroup(props, { features } = {}) {
  return mount(NavlinksGroup, {
    props,
    global: {
      provide: features === undefined ? {} : { qdadmFeatures: features },
    },
  })
}

describe('NavlinksGroup dedup (#1357)', () => {
  it('drops a navlink whose route a shown mode link already covers', () => {
    const wrapper = mountGroup(
      { modeLinks: MODE_LINKS, navlinks: NAVLINKS, variant: 'breadcrumb' },
      { features: { breadcrumbModeToggle: true } }
    )

    const labels = wrapper.findAll('a').map((a) => a.text())
    expect(labels).toEqual(['View', 'Edit', 'Books'])
    expect(labels).not.toContain('Details')
  })

  it('keeps every navlink when the feature is off (no mode links shown)', () => {
    const wrapper = mountGroup({ modeLinks: MODE_LINKS, navlinks: NAVLINKS })

    expect(wrapper.findAll('a').map((a) => a.text())).toEqual(['Details', 'Books'])
    expect(wrapper.find('.breadcrumb-mode-toggle').exists()).toBe(false)
  })

  it('keeps navlinks that target uncovered routes', () => {
    const wrapper = mountGroup(
      {
        modeLinks: [MODE_LINKS[1]], // Edit only
        navlinks: [{ label: 'Details', to: { name: 'genres-show', params: { id: 'fiction' } }, active: false }],
      },
      { features: { breadcrumbModeToggle: true } }
    )

    expect(wrapper.findAll('a').map((a) => a.text())).toEqual(['Edit', 'Details'])
  })
})

describe('NavlinksGroup rendering contract', () => {
  it('mode links lead, separators between every pair, variant classes applied', () => {
    const wrapper = mountGroup(
      { modeLinks: MODE_LINKS, navlinks: [NAVLINKS[1]], variant: 'layout' },
      { features: { breadcrumbModeToggle: true } }
    )

    expect(wrapper.find('.layout-navlinks').exists()).toBe(true)
    const links = wrapper.findAll('a')
    expect(links.map((a) => a.text())).toEqual(['View', 'Edit', 'Books'])
    expect(links[0].classes()).toContain('layout-navlink')
    expect(links[0].classes()).toContain('breadcrumb-mode-toggle')
    expect(links[2].classes()).toContain('layout-navlink--active')
    expect(wrapper.findAll('.layout-navlinks-separator')).toHaveLength(2)
  })

  it('renders nothing when both lists are empty after gating', () => {
    const wrapper = mountGroup({ modeLinks: MODE_LINKS, navlinks: [] })

    expect(wrapper.find('div').exists()).toBe(false)
  })
})
