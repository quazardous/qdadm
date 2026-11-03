/**
 * Option labels in a list (#4686, found by the second blind-agent run): a
 * static filter's options looked up `entities.<label>.…` instead of
 * `entities.<entity>.…` and always missed; a severity tag showed the raw
 * value instead of the option's label.
 *
 * Run: npm test
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'
import { useListPage } from '../../src/composables/useListPage'
import SeverityTag from '../../src/components/SeverityTag.vue'
import { I18n } from '../../src/i18n/I18n'
import { I18N_INJECTION_KEY } from '../../src/i18n/useI18n'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ name: 'delivery', params: {}, query: {}, meta: {} }),
  RouterLink: { name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' },
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('primevue/useconfirm', () => ({ useConfirm: () => ({ require: vi.fn() }) }))

const STATUS = [{ label: 'Ordered', value: 'ordered' }, { label: 'Shipped', value: 'shipped' }]
const manager = {
  name: 'deliveries',
  label: 'Delivery',
  labelPlural: 'Deliveries',
  routePrefix: 'delivery',
  idField: 'id',
  localFilterThreshold: 100,
  getListFields: () => [{ name: 'status', type: 'select', options: STATUS }],
  getFieldConfig: (name) => (name === 'status' ? { type: 'select', options: STATUS } : null),
  hasSeverityMap: () => true,
  getSeverityDescriptor: () => ({ severity: 'info' }),
  list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  query: vi.fn().mockResolvedValue({ items: [], total: 0, fromCache: false }),
  canCreate: () => true,
  canUpdate: () => true,
  canDelete: () => true,
}

let i18n
beforeAll(async () => {
  i18n = new I18n({
    defaultLocale: 'fr',
    messages: { fr: { entities: { deliveries: { fields: { status: { _label: 'Statut', options: { ordered: 'Commandée', shipped: 'Expédiée' } } } } } } },
  })
  await i18n.bootstrap()
})
const provide = () => ({ qdadmOrchestrator: { get: () => manager }, qdadmEntityFilters: {}, [I18N_INJECTION_KEY]: i18n })

describe('option labels in a list (#4686)', () => {
  it("a static filter's options come from entities.<entity>.fields.<f>.options, not from the label", async () => {
    let list
    mount(defineComponent({ setup() { list = useListPage({ entity: 'deliveries' }); list.addFilter('status', { options: STATUS }); return () => h('div') } }), {
      global: { plugins: [PrimeVue], provide: provide() },
    })
    await flushPromises()
    const status = list.props.value.filters.find((f) => f.name === 'status')
    expect(status.options.filter((o) => o.value).map((o) => o.label)).toEqual(['Commandée', 'Expédiée'])
  })

  it('a severity tag shows the option, translated', () => {
    const w = mount(SeverityTag, { props: { entity: 'deliveries', field: 'status', value: 'shipped' }, global: { plugins: [PrimeVue], provide: provide() } })
    expect(w.text()).toBe('Expédiée')
  })
})
