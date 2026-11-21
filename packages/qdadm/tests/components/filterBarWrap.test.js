/**
 * The filter bar wraps and keeps its buttons inside (#5432): "clear filters"
 * and the search's bookmark sit together in one group at the end of the
 * filters, which the bar's CSS lets flow onto as many lines as needed.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ListPage from '../../src/components/lists/ListPage.vue'

window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ name: 'book', params: {}, query: {}, meta: {}, path: '/books' }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const select = (name) => ({ name, type: 'select', placeholder: name, options: [{ label: 'All', value: null }, { label: 'One', value: 'one' }] })

describe('the filter bar (#5432)', () => {
  it('groups clear (and the bookmark) after the filters, inside the bar', () => {
    const filters = ['state', 'provider', 'type', 'universe', 'criticality', 'appeared', 'late'].map(select)
    const wrapper = mount(ListPage, {
      props: { items: [], columns: [{ name: 'title', label: 'Title' }], dataKey: 'id', filters, filterValues: { state: 'one' } },
      global: { plugins: [PrimeVue], directives: { tooltip: {} } },
    })
    const left = wrapper.find('.filter-bar-left')
    const group = left.find('[data-filter-actions]')
    expect(group.exists()).toBe(true)
    expect(group.find('.pi-filter-slash').exists()).toBe(true)
    // The group comes after every filter
    const children = left.element.children
    expect(children[children.length - 1]).toBe(group.element)
    wrapper.unmount()
  })

  it('no active filter and no bookmark: no empty group', () => {
    const wrapper = mount(ListPage, {
      props: { items: [], columns: [{ name: 'title', label: 'Title' }], dataKey: 'id', filters: [select('state')], filterValues: {} },
      global: { plugins: [PrimeVue], directives: { tooltip: {} } },
    })
    expect(wrapper.find('[data-filter-actions]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('the bar and its filters wrap', () => {
    const scss = readFileSync(`${process.cwd()}/src/styles/_filter-bar.scss`, 'utf8')
    const block = (sel) => scss.slice(scss.indexOf(`${sel} {`), scss.indexOf('}', scss.indexOf(`${sel} {`)))
    expect(block('.filter-bar')).toContain('flex-wrap: wrap')
    expect(block('.filter-bar-left')).toContain('flex-wrap: wrap')
    expect(block('.filter-bar-actions')).toContain('flex: none')
  })
})
