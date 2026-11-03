/**
 * Columns declared with addColumn / generateColumns are shown (#4685).
 *
 * ListPage rendered only its #columns slot: the credo's "ideal page"
 * (addColumn, no slot) showed a table with no data column, and
 * generateColumns(), documented and used by the module template, did not
 * exist. A slot still wins; #column-<field> still customises one cell.
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'
import Column from 'primevue/column'
import { useListPage } from '../../src/composables/useListPage'
import ListPage from '../../src/components/lists/ListPage.vue'

window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ name: 'supplier', params: {}, query: {}, meta: {} }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const FIELDS = {
  name: { type: 'text', label: 'Name', sortable: true },
  active: { type: 'boolean', label: 'Active' },
  status: { type: 'select', label: 'Status', options: [{ label: 'Open', value: 'open' }] },
  notes: { type: 'textarea', label: 'Notes' },
  secret: { type: 'password', label: 'Secret' },
  internal: { type: 'text', label: 'Internal', listable: false },
}
const ROWS = [{ id: 1, name: 'Acme', active: true, status: 'open', notes: 'long', secret: 'x', internal: 'y' }]

const manager = {
  name: 'suppliers',
  label: 'Supplier',
  labelPlural: 'Suppliers',
  routePrefix: 'supplier',
  idField: 'id',
  localFilterThreshold: 100,
  getListFields: () => Object.entries(FIELDS).filter(([, c]) => c.listable !== false).map(([name, c]) => ({ name, ...c })),
  getFieldConfig: (name) => FIELDS[name] ?? null,
  hasSeverityMap: () => false,
  list: vi.fn().mockResolvedValue({ items: ROWS, total: 1 }),
  query: vi.fn().mockResolvedValue({ items: ROWS, total: 1, fromCache: false }),
  delete: vi.fn(),
  invalidateCache: vi.fn(),
  canCreate: () => true,
  canUpdate: () => true,
  canDelete: () => true,
}
const global = { plugins: [PrimeVue], provide: { qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {} }, directives: { tooltip: {} } }

async function page(setup, slots = {}) {
  const w = mount(defineComponent({
    setup() {
      const list = setup()
      return () => h(ListPage, { ...list.props.value, ...list.events }, slots)
    },
  }), { global })
  await flushPromises()
  return w
}
// The row actions' column aside
const headers = (w) => w.findAll('th').map((th) => th.text()).filter((t) => t && t !== 'Actions')

describe('declared columns (#4685)', () => {
  it('generateColumns: one per listable field, without password, textarea or listable: false', async () => {
    const w = await page(() => {
      const list = useListPage({ entity: 'suppliers' })
      list.generateColumns()
      return list
    })
    expect(headers(w)).toEqual(['Name', 'Active', 'Status'])
    // Cells by type: the option's label, not its value
    expect(w.find('tbody tr').text()).toContain('Acme')
    expect(w.find('tbody tr').text()).toContain('Open')
  })

  it("addColumn alone, as in the credo's ideal page, shows its column", async () => {
    const w = await page(() => {
      const list = useListPage({ entity: 'suppliers' })
      list.addColumn('name', { header: 'Supplier' })
      return list
    })
    expect(headers(w)[0]).toBe('Supplier')
    expect(w.find('tbody tr').text()).toContain('Acme')
  })

  it('#column-<field> customises one cell; a #columns slot replaces them all', async () => {
    const custom = await page(() => {
      const list = useListPage({ entity: 'suppliers' })
      list.generateColumns({ only: ['name', 'status'] })
      return list
    }, { 'column-status': ({ value }) => h('b', { class: 'mine' }, `[${value}]`) })
    expect(custom.find('.mine').text()).toBe('[open]')

    const slot = await page(() => {
      const list = useListPage({ entity: 'suppliers' })
      list.generateColumns()
      return list
    }, { columns: () => h(Column, { field: 'name', header: 'Only this' }) })
    expect(headers(slot)).toEqual(['Only this'])
  })
})
