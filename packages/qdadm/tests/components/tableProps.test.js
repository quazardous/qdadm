/**
 * Unit tests for the tableProps passthrough (qdadm #1217).
 *
 * ListPage and DefaultTable forward `tableProps` verbatim to the
 * underlying PrimeVue DataTable — e.g. { nullSortOrder: -1 } to sort
 * null values last. Bound last, so they may override defaults.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import DataTable from 'primevue/datatable'
import DefaultTable from '../../src/components/layout/defaults/DefaultTable.vue'
import ListPage from '../../src/components/lists/ListPage.vue'

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })))
})

const globalConfig = {
  plugins: [PrimeVue],
  provide: { qdadmOrchestrator: null },
  stubs: { RouterLink: true, teleport: true },
}

describe('tableProps passthrough (#1217)', () => {
  it('DefaultTable forwards tableProps to the DataTable', () => {
    const wrapper = mount(DefaultTable, {
      props: {
        items: [{ id: '1', seen: null }],
        tableProps: { nullSortOrder: -1 },
      },
      global: globalConfig,
    })

    const table = wrapper.findComponent(DataTable)
    expect(table.exists()).toBe(true)
    expect(table.props('nullSortOrder')).toBe(-1)
  })

  it('ListPage forwards tableProps to the DataTable', () => {
    const wrapper = mount(ListPage, {
      props: {
        items: [{ id: '1' }],
        tableProps: { nullSortOrder: -1 },
      },
      global: globalConfig,
    })

    const table = wrapper.findComponent(DataTable)
    expect(table.exists()).toBe(true)
    expect(table.props('nullSortOrder')).toBe(-1)
  })

  it('defaults leave the DataTable untouched (nullSortOrder = PrimeVue default 1)', () => {
    const wrapper = mount(DefaultTable, {
      props: { items: [] },
      global: globalConfig,
    })

    expect(wrapper.findComponent(DataTable).props('nullSortOrder')).toBe(1)
  })
})
